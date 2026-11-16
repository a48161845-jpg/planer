"use strict";
/* ============ утилиты ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, "0");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DAYS_FULL = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_N = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pkey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayKey = () => dkey(new Date());
const fmtDate = k => { const d = pkey(k); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const fmtT = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDT = ts => { const d = new Date(ts); return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${fmtT(ts)}`; };
const fmtDur = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${pad(h)}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`; };
const toLocalInput = ts => { const d = new Date(ts); return `${dkey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const hm = t => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
const mh = n => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
const monIdx = d => (d.getDay() + 6) % 7;
const opt = (o, sel) => Object.entries(o).map(([k, v]) => `<option value="${esc(k)}" ${String(sel) === String(k) ? "selected" : ""}>${esc(v)}</option>`).join("");

const PRIOC = { 1: "#c76b6b", 2: "#d1a85b", 3: "#5fae8a" };
const PRIO = { 1: ["Высокий", "hi"], 2: ["Средний", "mid"], 3: ["Низкий", "lo"] };
const REPEAT = { none: "Без повтора", daily: "Каждый день", weekdays: "По будням", weekly: "Каждую неделю", monthly: "Каждый месяц", custom: "По дням недели" };
const FCATS_OUT = ["Еда", "Транспорт", "Дом", "Здоровье", "Развлечения", "Учёба", "Покупки", "Другое"];
const FCATS_IN = ["Зарплата", "Подработка", "Подарок", "Другое"];
const HOL = { "01-01": "Новый год", "01-07": "Рождество Христово", "02-23": "День защитника Отечества", "03-08": "Международный женский день", "05-01": "Праздник Весны и Труда", "05-09": "День Победы", "06-12": "День России", "11-04": "День народного единства" };

/* ============ состояние ============ */
const KEY = "planner.v2";
const CATS0 = [
  { id: "work", name: "Работа", color: "#5b8def" },
  { id: "study", name: "Учёба", color: "#a58bd0" },
  { id: "home", name: "Дом", color: "#d1a85b" },
  { id: "life", name: "Личное", color: "#5fae8a" }
];
/* разделы, которые можно вынести в нижнее меню */
const NAV_META = {
  home: ["Главная", "home"], cal: ["Календарь", "calendar"], tasks: ["Задачи", "tasks"], habits: ["Привычки", "flame"], fin: ["Финансы", "wallet"],
  reminders: ["Напоминания", "bell"], notes: ["Заметки", "note"], tools: ["Таймеры", "timer"], water: ["Вода", "drop"], goals: ["Цели", "target"],
  stats: ["Статистика", "chart"], diary: ["Дневник", "book"], bdays: ["Дни рождения", "cake"], counts: ["Отсчёт дат", "hourglass"], ai: ["Помощник", "sparkles"]
};
/* виджеты главного экрана: id, название, включён по умолчанию */
const WIDGET_DEF = [
  ["hero", "Часы и прогресс дня", true], ["acts", "Быстрые действия", true], ["qa", "Быстрый ввод", true], ["rem", "Напоминания", true],
  ["tasks", "Задачи на сегодня", true], ["water", "Вода", true], ["strip", "Неделя вперёд", true], ["habits", "Привычки", true],
  ["fin", "Финансы месяца", false], ["notes", "Заметки", false], ["bdays", "Дни рождения", false], ["goals", "Цели", false],
  ["pomo", "Фокус (Pomodoro)", false], ["counts", "Обратный отсчёт", false], ["tip", "Совет дня", true]
];
const def = () => ({
  rev: 0, account: null,
  settings: { theme: "dark", scheme: "ink", sound: true, pin: null, nav: ["home", "cal", "tasks", "habits", "fin"], widgets: WIDGET_DEF.map(w => ({ id: w[0], on: w[2] })), city: null, cur: "₽", waterGoal: 2000, pomo: { work: 25, brk: 5 } },
  cats: CATS0.map(c => ({ ...c })),
  reminders: [], tasks: [], events: [], schedule: [], habits: [], notes: [],
  tx: [], budget: 0, fgoals: [], timers: [], water: [], goals: [], diary: {}, counts: [],
  vault: null, sent: {}, seen: {}, pomo: { mode: "work", running: false, end: 0, left: 0 }, pomoLog: [], sw: { running: false, start: 0, acc: 0, laps: [] }
});
function migrate(s, o) {
  (o.reminders || []).forEach(r => s.reminders.push({ id: r.id, title: r.title, at: r.at, repeat: r.repeat || "none", days: [], prio: 2, cat: "life", pre: [0], done: !!r.done, fk: [] }));
  (o.tasks || []).forEach(t => s.tasks.push({ id: t.id, title: t.title, due: t.due, prio: t.prio || 2, cat: "life", project: "", subs: [], repeat: "none", done: !!t.done, doneAt: t.doneAt || null }));
  (o.notes || []).forEach(n => s.notes.push({ id: n.id, title: n.title, text: n.text, type: "note", items: [], tags: [], pin: !!n.pin, ts: n.ts, img: null }));
  (o.schedule || []).forEach(e => s.schedule.push({ ...e, cat: "work" }));
  (o.timers || []).forEach(t => s.timers.push(t));
  if (o.settings) s.settings.sound = o.settings.sound !== false;
}
function loadState() {
  let s = def();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const o = JSON.parse(raw); s = Object.assign(s, o); s.settings = Object.assign(def().settings, o.settings || {}); const st = s.settings; delete st.order; delete st.webhook; delete st.bot;
      if (!Array.isArray(st.nav) || !st.nav.length) st.nav = def().settings.nav;
      st.nav = st.nav.filter((x, i, ar) => NAV_META[x] && ar.indexOf(x) === i).slice(0, 5);
      const ws = Array.isArray(st.widgets) ? st.widgets.filter(w => WIDGET_DEF.some(d => d[0] === w.id)) : [];
      WIDGET_DEF.forEach(d => { if (!ws.some(w => w.id === d[0])) ws.push({ id: d[0], on: d[2] }); }); st.widgets = ws;
      if (st.scheme === "navy") st.scheme = "aurora"; }
    else { const old = localStorage.getItem("planner.v1"); if (old) migrate(s, JSON.parse(old)); }
  } catch (e) { /* пустое состояние */ }
  return s;
}
let S = loadState();
function save(sync = true) {
  S.rev = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { if (typeof toast === "function") toast("Не хватает места в хранилище"); }
  if (sync && typeof scheduleSync === "function") scheduleSync();
  if (typeof nativeSchedule === "function") nativeSchedule();
  if (typeof UNDO !== "undefined" && UNDO) { const u = UNDO; UNDO = null; if (Date.now() - u.t < 2500 && typeof toast === "function") toast("Удалено", "Отменить", () => undoNow(u.snap)); }
}
const catOf = id => S.cats.find(c => c.id === id) || S.cats[0] || { id: "x", name: "—", color: "#8fa0b8" };

/* ============ повторы ============ */
function nextRepeat(ts, rule, days) {
  const d = new Date(ts);
  if (rule === "daily") d.setDate(d.getDate() + 1);
  else if (rule === "weekly") d.setDate(d.getDate() + 7);
  else if (rule === "monthly") d.setMonth(d.getMonth() + 1);
  else if (rule === "weekdays") { do { d.setDate(d.getDate() + 1); } while ([0, 6].includes(d.getDay())); }
  else if (rule === "custom" && days && days.length) { let n = 0; do { d.setDate(d.getDate() + 1); n++; } while (!days.includes(d.getDay()) && n < 8); }
  else return ts;
  return d.getTime();
}

/* ============ элементы календаря ============ */
function itemsOn(key) {
  const d = pkey(key), md = key.slice(5), dow = d.getDay(), out = [];
  if (HOL[md]) out.push({ k: "hol", title: HOL[md], color: "#c76b6b", time: "", src: "hol" });
  for (const e of S.events) {
    const hit = (e.yearly || e.kind === "birthday") ? e.date.slice(5) === md : e.date === key;
    if (hit) out.push({ k: e.kind || "event", title: e.title, time: e.start || "", end: e.end || "", place: e.place, color: e.kind === "birthday" ? "#d1a85b" : catOf(e.cat).color, ref: e.id, src: "ev" });
  }
  for (const s of S.schedule) if (s.day === dow) out.push({ k: "sch", title: s.title, time: s.start, end: s.end, place: s.place, color: catOf(s.cat).color, ref: s.id, src: "sch" });
  for (const r of S.reminders) if (!r.done && dkey(new Date(r.at)) === key) out.push({ k: "rem", title: r.title, time: fmtT(r.at), color: PRIOC[r.prio || 2], ref: r.id, src: "rem" });
  for (const t of S.tasks) if (!t.done && !t.archived && t.due === key) out.push({ k: "task", title: t.title, time: "", color: catOf(t.cat).color, ref: t.id, src: "task" });
  return out.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
}

/* ============ привычки ============ */
function weekKeys(d) { const s = addDays(d, -monIdx(d)); return Array.from({ length: 7 }, (_, i) => dkey(addDays(s, i))); }
function habitStreak(h) {
  const g = h.goal || { type: "daily", n: 1 };
  if (g.type !== "week") {
    let d = new Date(), c = 0;
    if (!h.log[dkey(d)]) d = addDays(d, -1);
    while (h.log[dkey(d)]) { c++; d = addDays(d, -1); }
    return { n: c, unit: "дн" };
  }
  let d = new Date(), c = 0, first = true;
  for (let i = 0; i < 260; i++) {
    const done = weekKeys(d).filter(k => h.log[k]).length;
    if (done >= g.n) c++; else if (!first) break;
    first = false; d = addDays(d, -7);
  }
  return { n: c, unit: "нед" };
}
function habitRate(h, days) {
  let c = 0;
  for (let i = 0; i < days; i++) if (h.log[dkey(addDays(new Date(), -i))]) c++;
  const target = (h.goal && h.goal.type === "week") ? Math.max(1, Math.round(days / 7 * h.goal.n)) : days;
  return Math.min(1, c / target);
}
function dayProgress() {
  const k = todayKey();
  const open = S.tasks.filter(t => !t.done && !t.archived && t.due && t.due <= k).length;
  const done = S.tasks.filter(t => t.done && t.doneAt && dkey(new Date(t.doneAt)) === k).length;
  const hDone = S.habits.filter(h => h.log[k]).length;
  const total = open + done + S.habits.length, ok = done + hDone;
  return { total, ok, pct: total ? Math.round(ok / total * 100) : 0, openTasks: open, doneTasks: done, hDone, hTotal: S.habits.length };
}

/* ============ деньги ============ */
const money = n => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " " + S.settings.cur;
const monthTx = (y, m) => S.tx.filter(t => { const d = new Date(t.ts); return d.getFullYear() === y && d.getMonth() === m; });
const waterOn = k => S.water.filter(w => dkey(new Date(w.ts)) === k).reduce((a, w) => a + w.ml, 0);

/* ============ сигналы ============ */
function beep() {
  if (!S.settings.sound) return;
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)();
    [0, .25, .5].forEach(t => {
      const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination);
      g.gain.setValueAtTime(.0001, a.currentTime + t); g.gain.exponentialRampToValueAtTime(.25, a.currentTime + t + .02); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + t + .2);
      o.start(a.currentTime + t); o.stop(a.currentTime + t + .22);
    });
  } catch (e) { /* без звука */ }
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* нет вибрации */ }
}
function notify(title, body) {
  beep();
  if (typeof toast === "function") toast(title + (body ? " — " + body : ""));
  try { if (typeof TG !== "undefined" && TG && TG.HapticFeedback) TG.HapticFeedback.notificationOccurred("warning"); } catch (e) { /* не в Telegram */ }
  if (typeof NATIVE !== "undefined" && NATIVE) return;
  if ("Notification" in window && Notification.permission === "granted") {
    navigator.serviceWorker && navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) reg.showNotification(title, { body, icon: "icon.svg", tag: title + body, vibrate: [200, 100, 200] });
      else new Notification(title, { body, icon: "icon.svg" });
    });
  }
}
