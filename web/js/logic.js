"use strict";
/* ============ разбор естественного языка (локальный, без ИИ-сервиса) ============ */
function parseNL(text, base) {
  base = base || new Date();
  let o = String(text).trim(), n = o.toLowerCase().replace(/ё/g, "е");
  const cut = re => {
    const m = re.exec(n); if (!m) return null;
    const a = m.index, b = a + m[0].length;
    n = n.slice(0, a) + " " + n.slice(b); o = o.slice(0, a) + " " + o.slice(b);
    return m;
  };
  cut(/^\s*(пожалуйста[,\s]+)?(напомни(ть)?|создай напоминание|добавь напоминание|поставь напоминание)(\s+мне)?(?![а-я])/);
  let repeat = "none";
  const reps = [[/каждый день|ежедневно/, "daily"], [/по будням|каждый будний день/, "weekdays"], [/каждую неделю|еженедельно/, "weekly"], [/каждый месяц|ежемесячно/, "monthly"]];
  for (const [re, v] of reps) if (cut(re)) { repeat = v; break; }

  let at = null, dateSet = null, timeSet = null;
  const rel = cut(/через\s+(\d+|полчаса|пол часа|час|пару часов|минуту|неделю|день)\s*(минут[а-яa-z]*|мин(?![а-я])|часа|часов|час(?![а-я])|ч(?![а-я])|дн[а-яa-z]*|день|недел[а-яa-z]*)?/);
  if (rel) {
    const w = rel[1], u = rel[2] || "";
    let ms;
    if (w === "полчаса" || w === "пол часа") ms = 30 * 60e3;
    else if (w === "час") ms = 3600e3;
    else if (w === "пару часов") ms = 7200e3;
    else if (w === "минуту") ms = 60e3;
    else if (w === "неделю") ms = 7 * 86400e3;
    else if (w === "день") ms = 86400e3;
    else {
      const k = +w;
      ms = /^м/.test(u) || !u ? k * 60e3 : /^ч/.test(u) ? k * 3600e3 : /^д/.test(u) ? k * 86400e3 : /^н/.test(u) ? k * 7 * 86400e3 : k * 60e3;
    }
    at = base.getTime() + ms;
  } else {
    if (cut(/послезавтра/)) dateSet = addDays(base, 2);
    else if (cut(/завтра/)) dateSet = addDays(base, 1);
    else if (cut(/сегодня/)) dateSet = new Date(base);
    else {
      const wd = cut(/(?:\b(?:в|во|на)\s+)?(понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье)(?![а-я])/);
      if (wd) {
        const t = wd[1], target = /^понед/.test(t) ? 1 : /^вто/.test(t) ? 2 : /^сре/.test(t) ? 3 : /^чет/.test(t) ? 4 : /^пят/.test(t) ? 5 : /^суб/.test(t) ? 6 : 0;
        let diff = (target - base.getDay() + 7) % 7; if (diff === 0) diff = 7;
        dateSet = addDays(base, diff);
      } else {
        const md = cut(new RegExp("(\\d{1,2})\\s+(" + MONTHS.join("|") + ")(?![а-я])(?:\\s+(\\d{4}))?"));
        if (md) {
          const mi = MONTHS.indexOf(md[2]);
          let y = md[3] ? +md[3] : base.getFullYear();
          let d = new Date(y, mi, +md[1]);
          if (!md[3] && dkey(d) < dkey(base)) d = new Date(y + 1, mi, +md[1]);
          dateSet = d;
        } else {
          const dm = cut(/(?<![\d:.])(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?!\d)/);
          if (dm) { let y = +dm[3]; if (y < 100) y += 2000; dateSet = new Date(y, +dm[2] - 1, +dm[1]); }
        }
      }
    }
    // время
    let tm = cut(/(?:(?<![а-я])в|(?<![а-я])к)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:час(?:а|ов)?(?![а-я]))?\s*(утра|дня|вечера|ночи)?(?![\d:])/);
    if (!tm) tm = cut(/(?<![\d.])(\d{1,2}):(\d{2})(?!\d)/);
    if (tm) {
      let h = +tm[1], mi = tm[2] ? +tm[2] : 0; const part = tm[3] || "";
      if ((part === "вечера" || part === "дня") && h < 12) h += 12;
      if (part === "ночи" && h === 12) h = 0;
      if (h < 24 && mi < 60) timeSet = [h, mi];
    } else if (cut(/в полдень/)) timeSet = [12, 0];
    else if (cut(/утром/)) timeSet = [9, 0];
    else if (cut(/днем/)) timeSet = [13, 0];
    else if (cut(/вечером/)) timeSet = [19, 0];
    else if (cut(/ночью/)) timeSet = [23, 0];

    if (dateSet || timeSet || repeat !== "none") {
      const d = dateSet ? new Date(dateSet) : new Date(base);
      if (timeSet) d.setHours(timeSet[0], timeSet[1], 0, 0); else d.setHours(9, 0, 0, 0);
      if (!dateSet && d.getTime() <= base.getTime()) d.setDate(d.getDate() + 1);
      at = d.getTime();
    }
  }
  let title = o.replace(/\s+/g, " ").trim()
    .replace(/^(?:о том,? ?(?:что|чтобы)|чтобы|что|про|надо|нужно)\s+/i, "")
    .replace(/^(?:в|во|на|к|и|,)\s+/i, "").replace(/\s+(?:в|во|на|к)$/i, "")
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "");
  if (title) title = title[0].toUpperCase() + title.slice(1);
  return { title, at, repeat, found: at !== null };
}

/* ============ свободные окна и планирование недели ============ */
function busyOn(key) {
  return itemsOn(key).filter(i => i.time && i.end && (i.src === "ev" || i.src === "sch")).map(i => [hm(i.time), hm(i.end)]).sort((a, b) => a[0] - b[0]);
}
function gapsOn(key, from = 540, to = 1200, min = 30) {
  let cur = from; const g = [];
  for (const [s, e] of busyOn(key)) { if (s > cur) g.push([cur, Math.min(s, to)]); cur = Math.max(cur, e); }
  if (cur < to) g.push([cur, to]);
  return g.filter(x => x[1] > x[0] && x[1] - x[0] >= min);
}
function parseGoals(text) {
  return String(text).split(/[,;.\n]|\sи\s/).map(s => s.trim())
    .map(s => { let p; do { p = s; s = s.replace(/^(на (следующей|этой) неделе|мне|нужно|надо|хочу|выделить время на|выделить время|успеть)\s+/i, "").trim(); } while (s !== p); return s; })
    .filter(s => s.length > 2)
    .map(s => {
      let mins = 60;
      const m = s.match(/(\d+)\s*(час[а-яa-z]*|ч(?![а-я])|мин[а-яa-z]*)/i);
      if (m) { mins = /^ч/i.test(m[2]) ? +m[1] * 60 : +m[1]; s = s.replace(m[0], "").trim(); }
      return { title: s[0].toUpperCase() + s.slice(1), mins: Math.max(15, Math.min(240, mins)) };
    });
}
function planWeek(items, startDate) {
  const start = startDate || (new Date().getHours() >= 18 ? addDays(new Date(), 1) : new Date());
  const days = Array.from({ length: 7 }, (_, i) => dkey(addDays(start, i)));
  const gaps = {}; days.forEach(k => { gaps[k] = gapsOn(k).map(g => g.slice()); });
  const placed = [], unplaced = [];
  items.forEach((it, i) => {
    let ok = false;
    for (let j = 0; j < 7 && !ok; j++) {
      const k = days[(i + j) % 7];
      for (const g of gaps[k]) {
        if (g[1] - g[0] >= it.mins) {
          placed.push({ title: it.title, date: k, start: mh(g[0]), end: mh(g[0] + it.mins) });
          g[0] += it.mins + 10; ok = true; break;
        }
      }
    }
    if (!ok) unplaced.push(it);
  });
  return { placed: placed.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)), unplaced };
}
function splitTask(title) {
  const t = title.toLowerCase();
  let steps;
  if (/проект|разработ|сделать приложение|сайт/.test(t)) steps = ["Определить цель и требования", "Разбить на этапы и сроки", "Сделать основную часть", "Проверить и исправить ошибки", "Оформить и сдать результат"];
  else if (/подготов|экзамен|контрольн|тест|физик|матем|хими|англ|истори|учить|выучить/.test(t)) steps = ["Собрать материалы и темы", "Повторить теорию", "Разобрать примеры", "Решить практические задания", "Проверить слабые места", "Пробный прогон перед сдачей"];
  else if (/уборк|порядок|убрать|разобрать/.test(t)) steps = ["Выделить зоны", "Убрать лишнее", "Протереть и вымыть", "Разложить вещи по местам"];
  else steps = ["Уточнить, что нужно получить в итоге", "Собрать всё необходимое", "Сделать первую часть", "Сделать вторую часть", "Проверить результат"];
  return steps;
}
function findConflicts(days = 14) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const k = dkey(addDays(new Date(), i));
    const it = itemsOn(k).filter(x => x.time && x.end && (x.src === "ev" || x.src === "sch"));
    for (let a = 0; a < it.length; a++) for (let b = a + 1; b < it.length; b++) {
      if (hm(it[a].time) < hm(it[b].end) && hm(it[b].time) < hm(it[a].end)) out.push({ date: k, a: it[a], b: it[b] });
    }
  }
  return out;
}
function weekSummary() {
  const now = new Date(), k7 = dkey(addDays(now, -6)), kp = dkey(addDays(now, -13));
  const inRange = (ts, a, b) => { const k = dkey(new Date(ts)); return k >= a && k <= b; };
  const tasksDone = S.tasks.filter(t => t.done && t.doneAt && inRange(t.doneAt, k7, dkey(now))).length;
  const tasksPrev = S.tasks.filter(t => t.done && t.doneAt && inRange(t.doneAt, kp, dkey(addDays(now, -7)))).length;
  const habRate = S.habits.length ? Math.round(S.habits.reduce((a, h) => a + habitRate(h, 7), 0) / S.habits.length * 100) : null;
  const spent = S.tx.filter(t => t.type === "out" && inRange(t.ts, k7, dkey(now))).reduce((a, t) => a + t.amt, 0);
  const earned = S.tx.filter(t => t.type === "in" && inRange(t.ts, k7, dkey(now))).reduce((a, t) => a + t.amt, 0);
  const water = Math.round(Array.from({ length: 7 }, (_, i) => waterOn(dkey(addDays(now, -i)))).reduce((a, b) => a + b, 0) / 7);
  const pomo = S.pomoLog.filter(ts => inRange(ts, k7, dkey(now))).length;
  const overdue = S.tasks.filter(t => !t.done && !t.archived && t.due && t.due < dkey(now)).length;
  const lines = [];
  lines.push(`Закрыто задач: ${tasksDone}` + (tasksPrev ? ` (неделей ранее: ${tasksPrev})` : ""));
  if (habRate !== null) lines.push(`Привычки: выполнение ${habRate}%`);
  if (overdue) lines.push(`Просрочено задач: ${overdue} — их можно перенести на сегодня`);
  if (pomo) lines.push(`Сессий Pomodoro: ${pomo}`);
  if (spent || earned) lines.push(`Расходы: ${money(spent)}, доходы: ${money(earned)}`);
  if (water) lines.push(`Вода: в среднем ${water} мл в день`);
  const tips = [];
  if (tasksDone < tasksPrev) tips.push("Задач закрыто меньше, чем на прошлой неделе: попробуйте ставить не больше 3 главных задач на день.");
  if (habRate !== null && habRate < 50) tips.push("Привычки выполняются реже половины дней: уменьшите цель или привяжите к фиксированному времени.");
  if (overdue > 3) tips.push("Накопились просроченные задачи: разберите их за один подход — перенесите или удалите лишние.");
  if (!tips.length) tips.push("Неделя идёт ровно, продолжайте в том же темпе.");
  return { lines, tips, tasksDone, habRate, spent, earned, water, pomo, overdue };
}

/* ============ iCalendar (импорт / экспорт, в том числе из Google Календаря) ============ */
const icsEsc = s => String(s || "").replace(/[\\;,]/g, m => "\\" + m).replace(/\n/g, "\\n");
const icsD = k => k.replace(/-/g, "");
const icsDT = (k, t) => icsD(k) + "T" + t.replace(":", "") + "00";
function toICS() {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Planner//RU", "CALSCALE:GREGORIAN"];
  const BY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  for (const e of S.events) {
    L.push("BEGIN:VEVENT", "UID:" + e.id + "@planner");
    if (e.start) { L.push("DTSTART:" + icsDT(e.date, e.start)); L.push("DTEND:" + icsDT(e.date, e.end || e.start)); }
    else { L.push("DTSTART;VALUE=DATE:" + icsD(e.date)); }
    L.push("SUMMARY:" + icsEsc(e.title)); if (e.place) L.push("LOCATION:" + icsEsc(e.place));
    if (e.yearly || e.kind === "birthday") L.push("RRULE:FREQ=YEARLY");
    L.push("END:VEVENT");
  }
  for (const s of S.schedule) {
    let d = new Date(); while (d.getDay() !== s.day) d = addDays(d, 1);
    const k = dkey(d);
    L.push("BEGIN:VEVENT", "UID:" + s.id + "@planner", "DTSTART:" + icsDT(k, s.start), "DTEND:" + icsDT(k, s.end), "SUMMARY:" + icsEsc(s.title), "RRULE:FREQ=WEEKLY;BYDAY=" + BY[s.day]);
    if (s.place) L.push("LOCATION:" + icsEsc(s.place));
    L.push("END:VEVENT");
  }
  for (const r of S.reminders.filter(x => !x.done)) {
    const d = new Date(r.at), k = dkey(d);
    L.push("BEGIN:VEVENT", "UID:" + r.id + "@planner", "DTSTART:" + icsDT(k, fmtT(r.at)), "DTEND:" + icsDT(k, fmtT(r.at + 15 * 60e3)), "SUMMARY:" + icsEsc("🔔 " + r.title), "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}
function fromICS(text) {
  const lines = String(text).replace(/\r/g, "").replace(/\n[ \t]/g, "").split("\n");
  const out = []; let cur = null;
  const unesc = s => s.replace(/\\n/gi, "\n").replace(/\\([\\;,])/g, "$1");
  const parseDT = v => {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?(Z)?/.exec(v); if (!m) return null;
    if (m[4] === undefined) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: "" };
    if (m[6]) { const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])); return { date: dkey(d), time: fmtT(d.getTime()) }; }
    return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
  };
  for (const ln of lines) {
    if (ln === "BEGIN:VEVENT") cur = {};
    else if (ln === "END:VEVENT") { if (cur && cur.s) out.push(cur); cur = null; }
    else if (cur) {
      const i = ln.indexOf(":"); if (i < 0) continue;
      const key = ln.slice(0, i).split(";")[0].toUpperCase(), val = ln.slice(i + 1);
      if (key === "SUMMARY") cur.title = unesc(val);
      else if (key === "LOCATION") cur.place = unesc(val);
      else if (key === "DTSTART") cur.s = parseDT(val);
      else if (key === "DTEND") cur.e = parseDT(val);
      else if (key === "RRULE" && /FREQ=YEARLY/.test(val)) cur.yearly = true;
    }
  }
  return out.map(x => ({ id: uid(), title: x.title || "Событие", date: x.s.date, start: x.s.time || "", end: (x.e && x.e.date === x.s.date && x.e.time) || x.s.time || "", place: x.place || "", cat: "work", kind: "event", yearly: !!x.yearly }));
}
