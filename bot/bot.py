"""
Бот-компаньон приложения «Планер» (aiogram 3).

Возможности:
  * принимает данные из приложения (кнопка «Синхронизация») и сам присылает
    напоминания (в срок и заранее), предупреждения о событиях и расписании,
    дни рождения, напоминания о привычках и утренний дайджест
  * админ-панель /admin (ADMIN_ID), файл приложения /app, /id
  * команды: /add /list /clear /today /task /tasks /done /habit /water
    /expense /income /stats /digest /sync /resync
  * то, что создано в чате (задачи, расходы, вода, отметки привычек, напоминания),
    передаётся обратно в приложение командой /sync (кнопка «Принять пакет»)

Запуск:
  pip install -r requirements.txt
  export BOT_TOKEN="123:ABC"
  export WEBAPP_URL="https://<логин>.github.io/<репозиторий>/"
  export DEFAULT_TZ=420          # смещение от UTC в минутах до первой синхронизации
  python bot.py
"""
import asyncio
import base64
import gzip
import json
import logging
import os
import re
import sqlite3
import time
import zlib
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import (
    CallbackQuery,
    FSInputFile,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    Message,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    BotCommand,
    WebAppInfo,
)

TOKEN = os.environ.get("BOT_TOKEN", "")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "").rstrip("/")
DB_PATH = os.environ.get("DB_PATH", "planner.db")
DEFAULT_TZ = int(os.environ.get("DEFAULT_TZ", "420"))
ADMIN_IDS = {int(x) for x in re.split(r"[,\s]+", os.environ.get("ADMIN_IDS", os.environ.get("ADMIN_ID", ""))) if x.strip().lstrip("-").isdigit()}
APP_FILE = os.environ.get("APP_FILE", os.path.join(os.path.dirname(os.path.abspath(__file__)), "files", "planner.html"))
PRE_EVENT_MIN = 10
URL_LIMIT = 1800  # безопасный размер ссылки для кнопки

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("planner")

# ------------------------------------------------------------------ база данных
db = sqlite3.connect(DB_PATH, check_same_thread=False)
db.row_factory = sqlite3.Row
db.executescript(
    """
    CREATE TABLE IF NOT EXISTS users(
        uid INTEGER PRIMARY KEY,
        tz INTEGER NOT NULL,
        digest TEXT NOT NULL DEFAULT '08:00',
        digest_on INTEGER NOT NULL DEFAULT 1,
        last_digest TEXT NOT NULL DEFAULT '',
        sch TEXT NOT NULL DEFAULT '[]',
        ev TEXT NOT NULL DEFAULT '[]',
        hab TEXT NOT NULL DEFAULT '[]',
        tk TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS reminders(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid INTEGER NOT NULL,
        rid TEXT,                         -- id в приложении (NULL — создано в боте)
        title TEXT NOT NULL,
        at INTEGER NOT NULL,              -- unix-время, мс (UTC)
        repeat TEXT NOT NULL DEFAULT 'none',
        days TEXT NOT NULL DEFAULT '[]',
        pre INTEGER NOT NULL DEFAULT 0,   -- за сколько минут (0 — в срок)
        sent INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_rem_due ON reminders(sent, at);
    CREATE TABLE IF NOT EXISTS tasks(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid INTEGER NOT NULL, title TEXT NOT NULL, due TEXT,
        done INTEGER NOT NULL DEFAULT 0, done_ts INTEGER
    );
    CREATE TABLE IF NOT EXISTS inbox(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid INTEGER NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL,
        ts INTEGER NOT NULL, delivered INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS water(uid INTEGER, ts INTEGER, ml INTEGER);
    CREATE TABLE IF NOT EXISTS tx(uid INTEGER, ts INTEGER, type TEXT, amt REAL, cat TEXT, note TEXT);
    """
)
for _col, _ddl in [
    ("name", "TEXT NOT NULL DEFAULT ''"),
    ("username", "TEXT NOT NULL DEFAULT ''"),
    ("zone", "TEXT NOT NULL DEFAULT ''"),      # IANA-зона, например Asia/Krasnoyarsk
    ("reg", "INTEGER NOT NULL DEFAULT 0"),     # 1 — регистрация завершена
    ("joined", "INTEGER NOT NULL DEFAULT 0"),
    ("last_seen", "INTEGER NOT NULL DEFAULT 0"),  # последнее обращение к боту
    ("synced", "INTEGER NOT NULL DEFAULT 0"),     # последняя синхронизация из приложения
    ("app_id", "TEXT NOT NULL DEFAULT ''"),       # ID пользователя в приложении (PL-XXXXXX), бот его запоминает
    ("nt_on", "INTEGER NOT NULL DEFAULT 1"),      # присылать уведомления из приложения
    ("nt_ev", "INTEGER NOT NULL DEFAULT 10"),     # за сколько минут предупреждать о событиях
    ("nt_hab", "INTEGER NOT NULL DEFAULT 1"),     # напоминать о привычках
]:
    try:
        db.execute(f"ALTER TABLE users ADD COLUMN {_col} {_ddl}")
    except sqlite3.OperationalError:
        pass
db.commit()


# ------------------------------------------------------------------ время
def now_ms() -> int:
    return int(time.time() * 1000)


def zone_offset(zone: str):
    """Текущее смещение зоны от UTC в минутах или None, если зона неизвестна."""
    try:
        return int(datetime.now(ZoneInfo(zone)).utcoffset().total_seconds() // 60)
    except Exception:
        return None


def fmt_offset(minutes: int) -> str:
    sign = "+" if minutes >= 0 else "−"
    a = abs(minutes)
    return f"UTC{sign}{a // 60:02d}:{a % 60:02d}"


def get_user(uid: int) -> sqlite3.Row:
    row = db.execute("SELECT * FROM users WHERE uid=?", (uid,)).fetchone()
    if not row:
        db.execute("INSERT INTO users(uid,tz) VALUES(?,?)", (uid, DEFAULT_TZ))
        db.commit()
        row = db.execute("SELECT * FROM users WHERE uid=?", (uid,)).fetchone()
    if row["zone"]:
        off = zone_offset(row["zone"])
        if off is not None and off != row["tz"]:
            db.execute("UPDATE users SET tz=? WHERE uid=?", (off, uid))
            db.commit()
            row = db.execute("SELECT * FROM users WHERE uid=?", (uid,)).fetchone()
    return row


def local_dt(ms: int, tz: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc) + timedelta(minutes=tz)


def local_now(tz: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=tz)


def fmt_local(ms: int, tz: int) -> str:
    return local_dt(ms, tz).strftime("%d.%m %H:%M")


def js_dow(d: datetime) -> int:
    return (d.weekday() + 1) % 7  # 0 = воскресенье, как в приложении


def next_repeat(ms: int, rule: str, days: list, tz: int) -> int:
    d = local_dt(ms, tz)
    if rule == "daily":
        d += timedelta(days=1)
    elif rule == "weekly":
        d += timedelta(days=7)
    elif rule == "weekdays":
        d += timedelta(days=1)
        while d.weekday() >= 5:
            d += timedelta(days=1)
    elif rule == "custom" and days:
        for _ in range(8):
            d += timedelta(days=1)
            if js_dow(d) in days:
                break
    elif rule == "monthly":
        month = d.month % 12 + 1
        year = d.year + (1 if d.month == 12 else 0)
        d = d.replace(year=year, month=month, day=min(d.day, 28))
    else:
        return ms
    d -= timedelta(minutes=tz)
    return int(d.timestamp() * 1000)


# ------------------------------------------------------------------ кодирование
def b64u(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def unb64u(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def encode_payload(obj: dict) -> str:
    return b64u(gzip.compress(json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode()))


def decode_app_data(s: str) -> dict:
    if s.startswith("z:"):
        return json.loads(zlib.decompress(unb64u(s[2:]), 16 + zlib.MAX_WBITS).decode())
    if s.startswith("j:"):
        return json.loads(s[2:])
    return json.loads(s)


# ------------------------------------------------------------------ клавиатуры
def main_kb(registered: bool = True):
    if not WEBAPP_URL:
        return None
    if not registered:
        return None
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📋 Открыть Планер", web_app=WebAppInfo(url=WEBAPP_URL + "/"))],
            [KeyboardButton(text="🔄 Синхронизация", web_app=WebAppInfo(url=WEBAPP_URL + "/?screen=bot"))],
        ],
        resize_keyboard=True,
    )


def rem_kb(rem_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[
            InlineKeyboardButton(text="✅ Готово", callback_data=f"done:{rem_id}"),
            InlineKeyboardButton(text="⏰ +10 мин", callback_data=f"snz:{rem_id}:10"),
            InlineKeyboardButton(text="+1 час", callback_data=f"snz:{rem_id}:60"),
        ]]
    )


bot = Bot(TOKEN) if TOKEN else None
dp = Dispatcher()


def touch(uid: int):
    db.execute("UPDATE users SET last_seen=? WHERE uid=?", (now_ms(), uid))
    db.commit()


@dp.message.outer_middleware()
async def _seen_msg(handler, event, data):
    if getattr(event, "from_user", None):
        touch(event.from_user.id)
    return await handler(event, data)


@dp.callback_query.outer_middleware()
async def _seen_cb(handler, event, data):
    if getattr(event, "from_user", None):
        touch(event.from_user.id)
    return await handler(event, data)


def add_inbox(uid: int, kind: str, payload: dict):
    db.execute("INSERT INTO inbox(uid,kind,payload,ts) VALUES(?,?,?,?)", (uid, kind, json.dumps(payload, ensure_ascii=False), now_ms()))
    db.commit()


# ------------------------------------------------------------------ разбор времени для /add
DUR = re.compile(r"^(\d+)\s*(м|мин|m|min|ч|h|д|d)?$", re.I)
HM = re.compile(r"^(\d{1,2})[:.](\d{2})$")


def parse_when(args: str, tz: int):
    """Возвращает (at_ms, текст) или (None, None)."""
    parts = args.split()
    if len(parts) < 2:
        return None, None
    first = parts[0].lower()
    base = local_now(tz)
    m = DUR.match(first)
    if m:
        n, unit = int(m.group(1)), (m.group(2) or "м").lower()
        mult = {"м": 1, "мин": 1, "m": 1, "min": 1, "ч": 60, "h": 60, "д": 1440, "d": 1440}[unit]
        return now_ms() + n * mult * 60_000, " ".join(parts[1:])
    day = None
    rest = parts
    if first in ("сегодня", "завтра", "послезавтра"):
        day = {"сегодня": 0, "завтра": 1, "послезавтра": 2}[first]
        rest = parts[1:]
    if rest and HM.match(rest[0]):
        h, mi = map(int, HM.match(rest[0]).groups())
        if h > 23 or mi > 59:
            return None, None
        d = base.replace(hour=h, minute=mi, second=0, microsecond=0) + timedelta(days=day or 0)
        if day is None and d <= base:
            d += timedelta(days=1)
        text = " ".join(rest[1:])
    elif day is not None:
        d = base.replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=day)
        text = " ".join(rest)
    else:
        return None, None
    if not text:
        return None, None
    return int((d - timedelta(minutes=tz)).timestamp() * 1000), text


# ------------------------------------------------------------------ дайджест
def build_digest(uid: int) -> str:
    u = get_user(uid)
    tz = u["tz"]
    now = local_now(tz)
    today = now.strftime("%Y-%m-%d")
    md = now.strftime("%m-%d")
    start = int((now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(minutes=tz)).timestamp() * 1000)
    end = start + 86_400_000
    lines = [f"📅 {now.strftime('%d.%m.%Y')}"]

    rems = db.execute("SELECT * FROM reminders WHERE uid=? AND pre=0 AND sent=0 AND at>=? AND at<? ORDER BY at", (uid, start, end)).fetchall()
    if rems:
        lines.append("\n🔔 Напоминания:")
        lines += [f"• {local_dt(r['at'], tz).strftime('%H:%M')} — {r['title']}" for r in rems]

    plan = []
    for e in json.loads(u["sch"]):
        if e.get("d") == js_dow(now):
            plan.append((e.get("s", ""), f"{e.get('s')}–{e.get('e')} {e.get('t')}" + (f" ({e['pl']})" if e.get("pl") else "")))
    births = []
    for e in json.loads(u["ev"]):
        if e.get("k") == "birthday" and str(e.get("d", ""))[5:] == md:
            births.append(e.get("t"))
        elif not e.get("y") and e.get("d") == today:
            plan.append((e.get("s", "") or "99", (f"{e.get('s')}–{e.get('e')} " if e.get("s") else "весь день: ") + str(e.get("t"))))
    if plan:
        lines.append("\n🗓 Расписание:")
        lines += [f"• {t}" for _, t in sorted(plan)]
    if births:
        lines.append("\n🎂 Дни рождения: " + ", ".join(births))

    tks = [t for t in json.loads(u["tk"]) if t.get("d") and t["d"] <= today]
    mine = db.execute("SELECT * FROM tasks WHERE uid=? AND done=0 AND (due IS NULL OR due<=?)", (uid, today)).fetchall()
    if tks or mine:
        lines.append("\n☑ Задачи:")
        lines += [f"• {t['t']}" for t in tks] + [f"• #{t['id']} {t['title']}" for t in mine]

    habs = json.loads(u["hab"])
    if habs:
        lines.append("\n🧩 Привычки: " + ", ".join(h["n"] for h in habs) + "  (/habit — отметить)")
    if len(lines) == 1:
        lines.append("\nНа сегодня ничего не запланировано.")
    return "\n".join(lines)


# ------------------------------------------------------------------ хендлеры
@dp.message(CommandStart())
async def cmd_start(m: Message):
    uid = m.from_user.id
    get_user(uid)
    db.execute(
        "UPDATE users SET name=?, joined=CASE WHEN joined=0 THEN ? ELSE joined END WHERE uid=?",
        (m.from_user.first_name or "", now_ms(), uid),
    )
    db.commit()
    u = get_user(uid)
    name = m.from_user.first_name or "друг"
    if not u["reg"]:
        await m.answer(
            f"Привет, {name}! Это Планер.\n\n"
            "Регистрация идёт только текстом, без перехода на сайты:\n"
            "1. В приложении на первом экране есть ваш ID вида PL-XXXXXX.\n"
            "2. Нажмите там «Скопировать команду» и отправьте её сюда.\n"
            "3. Я запомню ваш ID и пришлю код — вставьте его в приложение.\n\n"
            "Часовой пояс определится сам: он уже внутри команды.",
            reply_markup=ReplyKeyboardRemove(),
        )
    else:
        await m.answer(
            f"С возвращением, {name}! Вы уже зарегистрированы, часовой пояс: {u['zone'] or fmt_offset(u['tz'])}.\n"
            "Кнопки внизу: открыть приложение и синхронизация. Список команд: /help",
            reply_markup=main_kb(True),
        )


@dp.message(Command("me"))
async def cmd_me(m: Message):
    u = get_user(m.from_user.id)
    if not u["reg"]:
        await m.answer("Вы ещё не завершили регистрацию. Нажмите /start.")
        return
    await m.answer(
        f"Профиль\nИмя: {u['name'] or m.from_user.full_name}\nID в приложении: {u['app_id'] or '—'}\nTelegram ID: {u['uid']}\n"
        f"Уведомления: {'включены' if u['nt_on'] else 'выключены'} (/notify)\n"
        f"Часовой пояс: {u['zone'] or '—'} ({fmt_offset(u['tz'])})\n"
        f"Дайджест: {u['digest'] if u['digest_on'] else 'выключен'}\n"
        f"Регистрация: {local_dt(u['joined'], u['tz']).strftime('%d.%m.%Y') if u['joined'] else '—'}"
    )


@dp.message(Command("help"))
async def cmd_help(m: Message):
    get_user(m.from_user.id)
    await m.answer(
        "Команды:\n\n"
        "/add 15м текст — напоминание (также: 2ч, 1д, 16:30, завтра 9:00)\n"
        "/list — ближайшие напоминания · /clear — удалить созданные в боте\n"
        "/today — план на сегодня\n"
        "/task текст — задача · /tasks · /done номер\n"
        "/habit — отметить привычку\n"
        "/water 250 — вода\n"
        "/expense 450 еда обед · /income 5000 зарплата\n"
        "/stats — сводка за неделю\n"
        "/notify — настройки уведомлений\n"
        "/digest 08:00 — утренний дайджест (off — выключить)\n"
        "/sync — передать данные из бота в приложение\n"
        "/app — файл Планера (HTML)\n"
        "/apk — установочный файл для Android\n"
        "/id — ваш Telegram ID",
        reply_markup=main_kb(),
    )


# ------------------------------------------------------------------ файл приложения и админ-панель
@dp.message(Command("app"))
async def cmd_app(m: Message):
    get_user(m.from_user.id)
    if not os.path.isfile(APP_FILE):
        await m.answer("Файл приложения пока не загружен. Откройте Планер кнопкой ниже.", reply_markup=main_kb())
        return
    await m.answer_document(
        FSInputFile(APP_FILE, filename="planner.html"),
        caption="Файл Планера. Откройте его в браузере телефона. Для синхронизации по аккаунту открывайте приложение через этого бота.",
    )


@dp.message(Command("apk"))
async def cmd_apk(m: Message):
    get_user(m.from_user.id)
    path = os.path.join(os.path.dirname(APP_FILE), "planner.apk")
    if not os.path.isfile(path):
        await m.answer("Файл для Android пока не загружен.")
        return
    await m.answer_document(FSInputFile(path, filename="planner.apk"), caption="Планер для Android. Разрешите установку из неизвестных источников.")


@dp.message(Command("id"))
async def cmd_id(m: Message):
    await m.answer(f"Ваш Telegram ID: {m.from_user.id}")


def is_admin(uid: int) -> bool:
    return uid in ADMIN_IDS


def ago(ms: int) -> str:
    if not ms:
        return "—"
    d = (now_ms() - ms) // 1000
    if d < 90:
        return "сейчас"
    if d < 3600:
        return f"{d // 60} мин назад"
    if d < 86400:
        return f"{d // 3600} ч назад"
    return f"{d // 86400} дн назад"


def _cnt(sql: str, *a) -> int:
    return db.execute(sql, a).fetchone()[0] or 0


def admin_summary() -> str:
    now = now_ms()
    day = 86400000
    total = _cnt("SELECT COUNT(*) FROM users")
    reg = _cnt("SELECT COUNT(*) FROM users WHERE reg=1")
    act = lambda d: _cnt("SELECT COUNT(*) FROM users WHERE last_seen>=?", now - d * day)  # noqa: E731
    new = lambda d: _cnt("SELECT COUNT(*) FROM users WHERE joined>=? AND joined>0", now - d * day)  # noqa: E731
    synced = _cnt("SELECT COUNT(*) FROM users WHERE synced>0")
    lines = [
        "📊 Сводка по пользователям",
        "",
        f"Всего: {total}",
        f"Зарегистрировано: {reg}" + (f" ({round(reg * 100 / total)}%)" if total else ""),
        f"Не завершили регистрацию: {total - reg}",
        f"Синхронизировали данные: {synced}",
        "",
        f"Новые: сегодня {new(1)} · 7 дн {new(7)} · 30 дн {new(30)}",
        f"Активные: 24 ч {act(1)} · 7 дн {act(7)} · 30 дн {act(30)}",
        "",
        "Данные пользователей (из синхронизаций и бота):",
        f"• Напоминаний ожидает: {_cnt('SELECT COUNT(*) FROM reminders WHERE sent=0')}",
        f"• Задач: {_cnt('SELECT COUNT(*) FROM tasks')} (выполнено {_cnt('SELECT COUNT(*) FROM tasks WHERE done=1')})",
        f"• Записей о деньгах: {_cnt('SELECT COUNT(*) FROM tx')}",
        f"• Записей о воде: {_cnt('SELECT COUNT(*) FROM water')}",
        f"• Дайджест включён у: {_cnt('SELECT COUNT(*) FROM users WHERE digest_on=1')}",
    ]
    return "\n".join(lines)


def admin_regs(days: int = 14) -> str:
    tz = DEFAULT_TZ
    today = local_now(tz).date()
    buckets = {today - timedelta(days=i): 0 for i in range(days)}
    for r in db.execute("SELECT joined FROM users WHERE joined>0"):
        d = local_dt(r["joined"], tz).date()
        if d in buckets:
            buckets[d] += 1
    mx = max(buckets.values()) or 1
    out = [f"📈 Регистрации за {days} дней", ""]
    for d in sorted(buckets):
        n = buckets[d]
        out.append(f"{d.strftime('%d.%m')}  {'█' * max(1 if n else 0, round(n * 12 / mx))} {n}")
    return "\n".join(out)


def admin_zones() -> str:
    rows = db.execute("SELECT zone, tz, COUNT(*) c FROM users GROUP BY zone, tz ORDER BY c DESC LIMIT 15").fetchall()
    if not rows:
        return "Пользователей пока нет."
    out = ["🌍 Часовые пояса", ""]
    for r in rows:
        out.append(f"{r['zone'] or 'без названия'} ({fmt_offset(r['tz'])}) — {r['c']}")
    return "\n".join(out)


def admin_user_line(r) -> str:
    return f"{r['name'] or 'без имени'} · {r['uid']} · {'✅' if r['reg'] else '⏳'} · {ago(r['last_seen'])}"


PAGE = 8


def admin_list(page: int):
    total = _cnt("SELECT COUNT(*) FROM users")
    pages = max(1, (total + PAGE - 1) // PAGE)
    page = min(max(page, 0), pages - 1)
    rows = db.execute("SELECT * FROM users ORDER BY last_seen DESC, joined DESC LIMIT ? OFFSET ?", (PAGE, page * PAGE)).fetchall()
    text = f"👥 Пользователи ({total}), страница {page + 1}/{pages}\n\n" + ("\n".join(admin_user_line(r) for r in rows) or "Пока никого.")
    kb = [[InlineKeyboardButton(text=f"{(r['name'] or 'без имени')[:22]} · {r['uid']}", callback_data=f"adm:u:{r['uid']}")] for r in rows]
    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton(text="◀️", callback_data=f"adm:l:{page - 1}"))
    nav.append(InlineKeyboardButton(text="В меню", callback_data="adm:m"))
    if page < pages - 1:
        nav.append(InlineKeyboardButton(text="▶️", callback_data=f"adm:l:{page + 1}"))
    kb.append(nav)
    return text, InlineKeyboardMarkup(inline_keyboard=kb)


def admin_user(uid: int):
    r = db.execute("SELECT * FROM users WHERE uid=?", (uid,)).fetchone()
    if not r:
        return "Пользователь не найден.", admin_menu_kb()
    j = lambda k: len(json.loads(r[k] or "[]"))  # noqa: E731
    text = (
        f"👤 {r['name'] or 'без имени'}\n"
        f"ID: {r['uid']}\n"
        f"Регистрация: {'завершена' if r['reg'] else 'не завершена'}\n"
        f"Зарегистрирован: {fmt_local(r['joined'], r['tz']) if r['joined'] else '—'}\n"
        f"Последнее обращение: {ago(r['last_seen'])}\n"
        f"Последняя синхронизация: {ago(r['synced'])}\n"
        f"Часовой пояс: {r['zone'] or 'не определён'} ({fmt_offset(r['tz'])})\n"
        f"Дайджест: {r['digest'] if r['digest_on'] else 'выключен'}\n\n"
        f"Напоминаний ожидает: {_cnt('SELECT COUNT(*) FROM reminders WHERE uid=? AND sent=0', uid)}\n"
        f"Задач: {_cnt('SELECT COUNT(*) FROM tasks WHERE uid=?', uid)} (выполнено {_cnt('SELECT COUNT(*) FROM tasks WHERE uid=? AND done=1', uid)})\n"
        f"Событий: {j('ev')} · расписание: {j('sch')} · привычек: {j('hab')} · таймеров: {j('tk')}\n"
        f"Операций по деньгам: {_cnt('SELECT COUNT(*) FROM tx WHERE uid=?', uid)} · записей воды: {_cnt('SELECT COUNT(*) FROM water WHERE uid=?', uid)}"
    )
    return text, InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="◀️ К списку", callback_data="adm:l:0")]])


def admin_menu_kb() -> InlineKeyboardMarkup:
    b = lambda t, d: InlineKeyboardButton(text=t, callback_data=d)  # noqa: E731
    return InlineKeyboardMarkup(inline_keyboard=[
        [b("📊 Сводка", "adm:s"), b("👥 Пользователи", "adm:l:0")],
        [b("📈 Регистрации", "adm:r"), b("🌍 Часовые пояса", "adm:z")],
    ])


@dp.message(Command("admin"))
async def cmd_admin(m: Message):
    if not is_admin(m.from_user.id):
        await m.answer("Нет доступа." if ADMIN_IDS else f"Админ не назначен. Задайте ADMIN_ID={m.from_user.id} и перезапустите бота.")
        return
    await m.answer("Панель администратора", reply_markup=admin_menu_kb())


@dp.callback_query(F.data.startswith("adm:"))
async def cb_admin(c: CallbackQuery):
    if not is_admin(c.from_user.id):
        await c.answer("Нет доступа", show_alert=True)
        return
    parts = c.data.split(":")
    kind = parts[1]
    back = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="◀️ В меню", callback_data="adm:m")]])
    kb = back
    if kind == "m":
        text, kb = "Панель администратора", admin_menu_kb()
    elif kind == "s":
        text = admin_summary()
    elif kind == "r":
        text = admin_regs()
    elif kind == "z":
        text = admin_zones()
    elif kind == "l":
        text, kb = admin_list(int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 0)
    elif kind == "u" and len(parts) > 2 and parts[2].lstrip("-").isdigit():
        text, kb = admin_user(int(parts[2]))
    else:
        await c.answer()
        return
    try:
        await c.message.edit_text(text, reply_markup=kb)
    except Exception:  # сообщение не изменилось
        pass
    await c.answer()


@dp.message(F.web_app_data)
async def on_webapp_data(m: Message):
    await apply_sync(m, m.web_app_data.data, False)


async def apply_sync(m: Message, raw: str, via_text: bool):
    uid = m.from_user.id
    if via_text and not get_user(uid)["reg"]:
        await m.answer("Сначала зарегистрируйтесь: отправьте сюда команду «/reg …» из приложения.")
        return
    try:
        data = decode_app_data(raw)
        tz = int(data.get("tz", DEFAULT_TZ))
    except Exception:
        log.exception("bad webapp data")
        await m.answer("Не удалось прочитать данные приложения.")
        return
    was_reg = bool(get_user(uid)["reg"])
    zone = str(data.get("zone", ""))[:64]
    off = zone_offset(zone) if zone else None
    if off is not None:
        tz = off  # точнее, чем смещение с телефона: бот сам учтёт переход на летнее время
    else:
        zone = ""
    db.execute(
        "UPDATE users SET tz=?, zone=?, reg=1, name=CASE WHEN name='' THEN ? ELSE name END, "
        "joined=CASE WHEN joined=0 THEN ? ELSE joined END, synced=?, sch=?, ev=?, hab=?, tk=? WHERE uid=?",
        (tz, zone, m.from_user.first_name or "", now_ms(), now_ms(),
         json.dumps(data.get("sch", []), ensure_ascii=False), json.dumps(data.get("ev", []), ensure_ascii=False),
         json.dumps(data.get("hab", []), ensure_ascii=False), json.dumps(data.get("tk", []), ensure_ascii=False), uid),
    )
    nt = data.get("nt") or {}
    nt_on = 0 if nt.get("on") is False else 1
    if nt:
        db.execute(
            "UPDATE users SET nt_on=?, nt_ev=?, nt_hab=? WHERE uid=?",
            (nt_on, max(1, min(1440, int(nt.get("ev", 10) or 10))), 0 if nt.get("hab") is False else 1, uid),
        )
    app_id = str(data.get("app", ""))[:12].upper()
    if re.fullmatch(r"PL-[A-Z2-9]{6}", app_id):
        free = db.execute("SELECT uid FROM users WHERE app_id=? AND uid<>?", (app_id, uid)).fetchone()
        if not free:
            db.execute("UPDATE users SET app_id=? WHERE uid=?", (app_id, uid))
    db.execute("DELETE FROM reminders WHERE uid=? AND rid IS NOT NULL", (uid,))
    added = 0
    t = now_ms()
    for r in (data.get("rem", []) if nt_on else []):
        try:
            repeat = r.get("r", "none")
            days = r.get("d", [])
            at = int(r["a"])
            for pre in sorted(set([0] + [int(x) for x in r.get("p", [0])])):
                when = at - pre * 60_000
                if repeat == "none" and when < t - 60_000:
                    continue
                while repeat != "none" and when < t - 60_000:
                    nxt = next_repeat(when, repeat, days, tz)
                    if nxt == when:
                        break
                    when = nxt
                title = str(r["t"])[:300]
                if pre:
                    title = f"Скоро: {title} (через {pre // 60} ч)" if pre % 60 == 0 else f"Скоро: {title} (через {pre} мин)"
                db.execute(
                    "INSERT INTO reminders(uid,rid,title,at,repeat,days,pre) VALUES(?,?,?,?,?,?,?)",
                    (uid, f"{r['i']}:{pre}", title, when, repeat, json.dumps(days), pre),
                )
                if pre == 0:
                    added += 1
        except (KeyError, ValueError, TypeError):
            continue
    db.commit()
    if data.get("reg") or not was_reg:
        await m.answer(
            "Регистрация завершена ✅\n"
            f"Часовой пояс определён автоматически: {zone or 'по устройству'} ({fmt_offset(tz)}).\n\n"
            "Теперь вам доступны все команды (/help). Напоминания придут в чат, даже когда приложение закрыто.",
            reply_markup=main_kb(True),
        )
        return
    await m.answer(
        f"Синхронизировано ✅\n⏰ напоминаний: {added}\n🗓 расписание: {len(data.get('sch', []))} · события: {len(data.get('ev', []))}\n"
        f"🧩 привычек: {len(data.get('hab', []))} · 📋 задач: {len(data.get('tk', []))}\n\n"
        + ("🔔 Уведомления включены" if nt_on else "🔕 Уведомления выключены (включите в приложении или /notify)") + "\nНастройки: /notify",
        reply_markup=main_kb(),
    )


@dp.message(Command("add"))
async def cmd_add(m: Message, command: CommandObject):
    uid = m.from_user.id
    tz = get_user(uid)["tz"]
    at, text = parse_when(command.args or "", tz)
    if not at:
        await m.answer("Формат: /add 15м текст\nЕщё можно: 2ч, 1д, 16:30, завтра 9:00 текст")
        return
    cur = db.execute("INSERT INTO reminders(uid,rid,title,at) VALUES(?,NULL,?,?)", (uid, text[:300], at))
    db.commit()
    add_inbox(uid, "rem", {"id": cur.lastrowid, "title": text[:300], "at": at, "repeat": "none", "prio": 2})
    await m.answer(f"Напомню {fmt_local(at, tz)}: {text}")


@dp.message(Command("list"))
async def cmd_list(m: Message):
    uid = m.from_user.id
    tz = get_user(uid)["tz"]
    rows = db.execute("SELECT * FROM reminders WHERE uid=? AND pre=0 AND sent=0 AND at>? ORDER BY at LIMIT 20", (uid, now_ms() - 60_000)).fetchall()
    if not rows:
        await m.answer("Активных напоминаний нет.")
        return
    await m.answer("\n".join(f"• {fmt_local(r['at'], tz)} — {r['title']}" for r in rows))


@dp.message(Command("clear"))
async def cmd_clear(m: Message):
    db.execute("DELETE FROM reminders WHERE uid=? AND rid IS NULL", (m.from_user.id,))
    db.commit()
    await m.answer("Напоминания, созданные в боте, удалены. Напоминания из приложения удаляются там же и обновляются синхронизацией.")


@dp.message(Command("today"))
async def cmd_today(m: Message):
    await m.answer(build_digest(m.from_user.id))


@dp.message(Command("task"))
async def cmd_task(m: Message, command: CommandObject):
    uid = m.from_user.id
    text = (command.args or "").strip()
    if not text:
        await m.answer("Формат: /task купить хлеб")
        return
    tz = get_user(uid)["tz"]
    today = local_now(tz).strftime("%Y-%m-%d")
    cur = db.execute("INSERT INTO tasks(uid,title,due) VALUES(?,?,?)", (uid, text[:300], today))
    db.commit()
    add_inbox(uid, "task", {"id": cur.lastrowid, "title": text[:300], "due": today, "prio": 2})
    await m.answer(f"Задача #{cur.lastrowid} добавлена на сегодня.")


@dp.message(Command("tasks"))
async def cmd_tasks(m: Message):
    uid = m.from_user.id
    rows = db.execute("SELECT * FROM tasks WHERE uid=? AND done=0 ORDER BY id", (uid,)).fetchall()
    app_tasks = json.loads(get_user(uid)["tk"])
    if not rows and not app_tasks:
        await m.answer("Открытых задач нет.")
        return
    out = [f"#{r['id']} {r['title']}" for r in rows]
    if app_tasks:
        out.append("\nИз приложения (на момент синхронизации):")
        out += [f"• {t['t']}" for t in app_tasks[:15]]
    await m.answer("\n".join(out) + "\n\nЗавершить: /done номер")


@dp.message(Command("done"))
async def cmd_done(m: Message, command: CommandObject):
    uid = m.from_user.id
    arg = (command.args or "").strip().lstrip("#")
    if not arg.isdigit():
        await m.answer("Формат: /done 3")
        return
    cur = db.execute("UPDATE tasks SET done=1, done_ts=? WHERE id=? AND uid=? AND done=0", (now_ms(), int(arg), uid))
    db.commit()
    await m.answer("Готово ✅" if cur.rowcount else "Такой открытой задачи нет.")


@dp.message(Command("habit"))
async def cmd_habit(m: Message):
    habs = json.loads(get_user(m.from_user.id)["hab"])
    if not habs:
        await m.answer("Привычек пока нет: добавьте их в приложении и нажмите «Синхронизация».")
        return
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text=f"✓ {h['n']}", callback_data=f"hb:{h['i']}")] for h in habs[:20]])
    await m.answer("Что выполнено сегодня?", reply_markup=kb)


@dp.callback_query(F.data.startswith("hb:"))
async def cb_habit(c: CallbackQuery):
    uid = c.from_user.id
    hid = c.data[3:]
    today = local_now(get_user(uid)["tz"]).strftime("%Y-%m-%d")
    add_inbox(uid, "hab", {"hid": hid, "date": today})
    await c.answer("Отмечено. Передайте в приложение: /sync")


@dp.message(Command("water"))
async def cmd_water(m: Message, command: CommandObject):
    uid = m.from_user.id
    arg = (command.args or "250").strip()
    if not arg.isdigit() or not (0 < int(arg) <= 3000):
        await m.answer("Формат: /water 250")
        return
    ts, ml = now_ms(), int(arg)
    db.execute("INSERT INTO water VALUES(?,?,?)", (uid, ts, ml))
    db.commit()
    add_inbox(uid, "water", {"id": ts, "ts": ts, "ml": ml})
    tz = get_user(uid)["tz"]
    start = int((local_now(tz).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(minutes=tz)).timestamp() * 1000)
    total = db.execute("SELECT COALESCE(SUM(ml),0) FROM water WHERE uid=? AND ts>=?", (uid, start)).fetchone()[0]
    await m.answer(f"💧 +{ml} мл. Сегодня в боте записано: {total} мл.")


async def add_money(m: Message, command: CommandObject, kind: str):
    uid = m.from_user.id
    parts = (command.args or "").split(maxsplit=2)
    try:
        amt = float(parts[0].replace(",", "."))
        assert amt > 0
    except Exception:
        await m.answer(f"Формат: /{'expense' if kind == 'out' else 'income'} 450 категория заметка")
        return
    cat = (parts[1] if len(parts) > 1 else "Другое").capitalize()
    note = parts[2] if len(parts) > 2 else ""
    ts = now_ms()
    db.execute("INSERT INTO tx VALUES(?,?,?,?,?,?)", (uid, ts, kind, amt, cat, note))
    db.commit()
    add_inbox(uid, "tx", {"id": ts, "type": kind, "amt": amt, "cat": cat, "note": note, "ts": ts})
    await m.answer(f"{'−' if kind == 'out' else '+'}{amt:g} · {cat}")


@dp.message(Command("expense"))
async def cmd_expense(m: Message, command: CommandObject):
    await add_money(m, command, "out")


@dp.message(Command("income"))
async def cmd_income(m: Message, command: CommandObject):
    await add_money(m, command, "in")


@dp.message(Command("stats"))
async def cmd_stats(m: Message):
    uid = m.from_user.id
    week = now_ms() - 7 * 86_400_000
    w = db.execute("SELECT COALESCE(SUM(ml),0) FROM water WHERE uid=? AND ts>=?", (uid, week)).fetchone()[0]
    out = db.execute("SELECT COALESCE(SUM(amt),0) FROM tx WHERE uid=? AND type='out' AND ts>=?", (uid, week)).fetchone()[0]
    inc = db.execute("SELECT COALESCE(SUM(amt),0) FROM tx WHERE uid=? AND type='in' AND ts>=?", (uid, week)).fetchone()[0]
    done = db.execute("SELECT COUNT(*) FROM tasks WHERE uid=? AND done=1 AND done_ts>=?", (uid, week)).fetchone()[0]
    left = db.execute("SELECT COUNT(*) FROM tasks WHERE uid=? AND done=0", (uid,)).fetchone()[0]
    await m.answer(
        "За 7 дней (по данным, внесённым через бота):\n"
        f"• выполнено задач: {done}, открыто: {left}\n• вода: {w} мл\n• расходы: {out:g}, доходы: {inc:g}\n\n"
        "Полная статистика — в приложении, раздел «Ещё → Статистика»."
    )


@dp.message(Command("digest"))
async def cmd_digest(m: Message, command: CommandObject):
    uid = m.from_user.id
    arg = (command.args or "").strip().lower()
    get_user(uid)
    if arg in ("off", "выкл"):
        db.execute("UPDATE users SET digest_on=0 WHERE uid=?", (uid,))
        db.commit()
        await m.answer("Утренний дайджест выключен.")
        return
    mt = HM.match(arg)
    if not mt or int(mt.group(1)) > 23 or int(mt.group(2)) > 59:
        await m.answer("Формат: /digest 08:00 или /digest off")
        return
    t = f"{int(mt.group(1)):02d}:{mt.group(2)}"
    db.execute("UPDATE users SET digest=?, digest_on=1, last_digest='' WHERE uid=?", (t, uid))
    db.commit()
    await m.answer(f"Дайджест будет приходить в {t} (по времени устройства из последней синхронизации).")


async def send_batches(m: Message, uid: int):
    rows = db.execute("SELECT * FROM inbox WHERE uid=? AND delivered=0 ORDER BY id", (uid,)).fetchall()
    if not rows:
        await m.answer("Новых данных из бота нет.")
        return
    key = {"rem": "rem", "task": "tasks", "water": "water", "tx": "tx", "hab": "hab"}
    batches, cur, ids, cur_ids = [], {"v": 2}, [], []

    def url_of(o):
        return f"{WEBAPP_URL}/?d={encode_payload(o)}"

    for r in rows:
        trial = json.loads(json.dumps(cur))
        trial.setdefault(key[r["kind"]], []).append(json.loads(r["payload"]))
        if len(url_of(trial)) > URL_LIMIT and cur_ids:
            batches.append((cur, cur_ids))
            cur, cur_ids = {"v": 2}, []
            trial = {"v": 2, key[r["kind"]]: [json.loads(r["payload"])]}
        cur, cur_ids = trial, cur_ids + [r["id"]]
    if cur_ids:
        batches.append((cur, cur_ids))
    kb = InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text=f"Принять пакет {i}/{len(batches)}", web_app=WebAppInfo(url=url_of(b)))] for i, (b, _) in enumerate(batches, 1)]
    )
    await m.answer(f"В приложение можно передать {len(rows)} записей. Нажмите кнопку (приложение откроется и примет данные):", reply_markup=kb)
    db.execute(f"UPDATE inbox SET delivered=1 WHERE id IN ({','.join('?' * len(rows))})", [r["id"] for r in rows])
    db.commit()


@dp.message(Command("sync"))
async def cmd_sync(m: Message):
    if not WEBAPP_URL:
        await m.answer("Не задан WEBAPP_URL.")
        return
    await send_batches(m, m.from_user.id)


@dp.message(Command("resync"))
async def cmd_resync(m: Message):
    if not WEBAPP_URL:
        await m.answer("Не задан WEBAPP_URL.")
        return
    db.execute("UPDATE inbox SET delivered=0 WHERE uid=? AND ts>?", (m.from_user.id, now_ms() - 3 * 86_400_000))
    db.commit()
    await send_batches(m, m.from_user.id)


@dp.callback_query(F.data.startswith("done:"))
async def cb_done(c: CallbackQuery):
    await c.message.edit_reply_markup(reply_markup=None)
    await c.answer("Отмечено")


@dp.callback_query(F.data.startswith("snz:"))
async def cb_snooze(c: CallbackQuery):
    _, rid, minutes = c.data.split(":")
    row = db.execute("SELECT * FROM reminders WHERE id=? AND uid=?", (int(rid), c.from_user.id)).fetchone()
    if row:
        db.execute("UPDATE reminders SET at=?, sent=0 WHERE id=?", (now_ms() + int(minutes) * 60_000, row["id"]))
        db.commit()
    await c.message.edit_reply_markup(reply_markup=None)
    await c.answer(f"Отложено на {minutes} мин")


# ------------------------------------------------------------------ планировщик
_sent: set = set()


async def safe_send(uid: int, text: str, **kw):
    try:
        await bot.send_message(uid, text, **kw)
    except Exception as e:
        log.warning("send failed uid=%s: %s", uid, e)


async def scheduler():
    while True:
        try:
            t = now_ms()
            for r in db.execute("SELECT * FROM reminders WHERE sent=0 AND at<=?", (t,)).fetchall():
                if r["rid"] and not get_user(r["uid"])["nt_on"]:
                    db.execute("UPDATE reminders SET sent=1 WHERE id=?", (r["id"],))
                    continue
                late = t - r["at"] > 6 * 3600_000 and r["pre"] > 0
                if not late:
                    await safe_send(r["uid"], f"⏰ {r['title']}", reply_markup=rem_kb(r["id"]))
                if r["repeat"] != "none":
                    tz = get_user(r["uid"])["tz"]
                    nxt = next_repeat(r["at"], r["repeat"], json.loads(r["days"]), tz)
                    db.execute("UPDATE reminders SET at=? WHERE id=?", (nxt if nxt != r["at"] else t + 86_400_000, r["id"]))
                else:
                    db.execute("UPDATE reminders SET sent=1 WHERE id=?", (r["id"],))
            db.commit()

            for u in db.execute("SELECT uid FROM users").fetchall():
                u = get_user(u["uid"])  # заодно обновит смещение по зоне
                now = local_now(u["tz"])
                today = now.strftime("%Y-%m-%d")
                hhmm = now.strftime("%H:%M")
                lead = u["nt_ev"] or PRE_EVENT_MIN
                target = (now + timedelta(minutes=lead)).strftime("%H:%M")
                on = bool(u["nt_on"])
                # расписание и события за 10 минут
                for e in (json.loads(u["sch"]) if on else []):
                    if e.get("d") == js_dow(now) and e.get("s") == target:
                        k = (u["uid"], "s", e.get("i"), today)
                        if k not in _sent:
                            _sent.add(k)
                            await safe_send(u["uid"], f"🗓 Через {lead} мин: {e.get('t')} ({e.get('s')}–{e.get('e')})" + (f"\n📍 {e['pl']}" if e.get("pl") else ""))
                for e in (json.loads(u["ev"]) if on else []):
                    if e.get("k") != "birthday" and not e.get("y") and e.get("d") == today and e.get("s") == target:
                        k = (u["uid"], "e", e.get("i"), today)
                        if k not in _sent:
                            _sent.add(k)
                            await safe_send(u["uid"], f"🗓 Через {lead} мин: {e.get('t')} ({e.get('s')}–{e.get('e')})")
                # привычки
                for h in (json.loads(u["hab"]) if on and u["nt_hab"] else []):
                    if h.get("r") == hhmm:
                        k = (u["uid"], "h", h.get("i"), today)
                        if k not in _sent:
                            _sent.add(k)
                            await safe_send(u["uid"], f"🧩 Привычка: {h.get('n')}  (/habit — отметить)")
                # утренний дайджест (или только дни рождения в 9:00, если дайджест выключен)
                if u["digest_on"] and hhmm >= u["digest"] and u["last_digest"] != today and hhmm < "23:00":
                    db.execute("UPDATE users SET last_digest=? WHERE uid=?", (today, u["uid"]))
                    db.commit()
                    await safe_send(u["uid"], build_digest(u["uid"]))
                elif not u["digest_on"] and hhmm == "09:00":
                    md = now.strftime("%m-%d")
                    births = [e.get("t") for e in json.loads(u["ev"]) if e.get("k") == "birthday" and str(e.get("d", ""))[5:] == md]
                    k = (u["uid"], "b", today)
                    if births and k not in _sent:
                        _sent.add(k)
                        await safe_send(u["uid"], "🎂 Сегодня день рождения: " + ", ".join(births))
            if len(_sent) > 5000:
                _sent.clear()
        except Exception:
            log.exception("scheduler error")
        await asyncio.sleep(15)


# ------------------------------------------------------------------ регистрация текстом (ID из приложения)
REG_RE = re.compile(r"^\s*(?:/reg\S*\s+)?(PL-[A-Z2-9]{6})\b\s*(-?\d{1,4})?\s*([A-Za-z_]+/[A-Za-z_\-/]+)?", re.I)


@dp.message(F.text.regexp(REG_RE))
async def on_reg(m: Message):
    mt = REG_RE.match(m.text)
    app_id = mt.group(1).upper()
    uid = m.from_user.id
    u = get_user(uid)
    owner = db.execute("SELECT uid FROM users WHERE app_id=? AND uid<>?", (app_id, uid)).fetchone()
    if owner:
        await m.answer("Этот ID уже привязан к другому аккаунту. Сбросьте данные в приложении (Настройки → Данные), чтобы получить новый ID.")
        return
    tz = max(-840, min(840, int(mt.group(2)))) if mt.group(2) else u["tz"]
    zone = mt.group(3) or ""
    off = zone_offset(zone) if zone else None
    if off is not None:
        tz = off
    else:
        zone = ""
    name = m.from_user.first_name or ""
    db.execute(
        "UPDATE users SET app_id=?, tz=?, zone=?, reg=1, name=?, joined=CASE WHEN joined=0 THEN ? ELSE joined END WHERE uid=?",
        (app_id, tz, zone, name, now_ms(), uid),
    )
    db.commit()
    token = "K1." + b64u(json.dumps({"a": app_id, "u": uid, "n": name}, ensure_ascii=False, separators=(",", ":")).encode())
    await m.answer(
        "Готово, регистрация завершена ✅\n"
        f"Ваш ID: <code>{app_id}</code> — я его запомнил.\n"
        f"Часовой пояс: {zone or 'по устройству'} ({fmt_offset(tz)})\n\n"
        "Код для приложения (нажмите на него, чтобы скопировать):\n"
        f"<code>{token}</code>\n\n"
        "Вставьте код в поле «Код от бота». Затем в приложении (Аккаунт → Уведомления через бота) "
        "нажмите «Скопировать данные для бота» и отправьте их мне — тогда напоминания будут приходить сюда.",
        parse_mode="HTML",
        reply_markup=main_kb(True),
    )


@dp.message(F.text.regexp(r"^(z:|j:)"))
async def on_text_sync(m: Message):
    await apply_sync(m, m.text.strip(), True)


# ------------------------------------------------------------------ настройка уведомлений
def nt_text(u) -> str:
    return (
        "🔔 Уведомления\n\n"
        f"Из приложения: {'включены' if u['nt_on'] else 'выключены'}\n"
        f"События и расписание: за {u['nt_ev']} мин\n"
        f"Привычки: {'напоминать' if u['nt_hab'] else 'не напоминать'}\n"
        f"Утренний дайджест: {u['digest'] if u['digest_on'] else 'выключен'}"
    )


def nt_kb(u) -> InlineKeyboardMarkup:
    ck = lambda on: "✅ " if on else ""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=("🔕 Выключить всё из приложения" if u["nt_on"] else "🔔 Включить"), callback_data="nt:on")],
        [InlineKeyboardButton(text=f"{ck(u['nt_ev'] == n)}{n} мин" if n < 60 else f"{ck(u['nt_ev'] == n)}1 ч", callback_data=f"nt:ev:{n}") for n in (5, 10, 30, 60)],
        [InlineKeyboardButton(text=f"🧩 Привычки: {'вкл' if u['nt_hab'] else 'выкл'}", callback_data="nt:hab"),
         InlineKeyboardButton(text=f"☀️ Дайджест: {'вкл' if u['digest_on'] else 'выкл'}", callback_data="nt:dg")],
    ])


@dp.message(Command("notify"))
async def cmd_notify(m: Message):
    u = get_user(m.from_user.id)
    await m.answer(nt_text(u), reply_markup=nt_kb(u))


@dp.callback_query(F.data.startswith("nt:"))
async def cb_notify(c: CallbackQuery):
    uid = c.from_user.id
    parts = c.data.split(":")
    if parts[1] == "on":
        db.execute("UPDATE users SET nt_on=1-nt_on WHERE uid=?", (uid,))
    elif parts[1] == "ev":
        db.execute("UPDATE users SET nt_ev=? WHERE uid=?", (int(parts[2]), uid))
    elif parts[1] == "hab":
        db.execute("UPDATE users SET nt_hab=1-nt_hab WHERE uid=?", (uid,))
    elif parts[1] == "dg":
        db.execute("UPDATE users SET digest_on=1-digest_on, last_digest='' WHERE uid=?", (uid,))
    db.commit()
    u = get_user(uid)
    try:
        await c.message.edit_text(nt_text(u), reply_markup=nt_kb(u))
    except Exception:
        pass
    await c.answer("Сохранено")


async def main():
    if not TOKEN:
        raise SystemExit("Задайте переменную окружения BOT_TOKEN")
    if not WEBAPP_URL:
        log.warning("WEBAPP_URL не задан — кнопки приложения и /sync недоступны")
    try:
        await bot.set_my_commands([
            BotCommand(command="notify", description="Настройки уведомлений"),
            BotCommand(command="today", description="План на сегодня"),
            BotCommand(command="add", description="Напоминание: /add 15м текст"),
            BotCommand(command="tasks", description="Список задач"),
            BotCommand(command="habit", description="Отметить привычку"),
            BotCommand(command="water", description="Вода: /water 250"),
            BotCommand(command="stats", description="Сводка за неделю"),
            BotCommand(command="me", description="Мой профиль и ID"),
            BotCommand(command="app", description="Файл приложения"),
            BotCommand(command="apk", description="Приложение для Android"),
            BotCommand(command="help", description="Все команды"),
        ])
    except Exception:
        log.warning("не удалось задать меню команд")
    asyncio.create_task(scheduler())
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
