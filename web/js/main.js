"use strict";
/* ============ маршрутизация ============ */
let R = { tab: "home", screen: null, arg: null };
const TABVIEWS = {}, SCREENS = {}, SCR_TITLES = {};
const NAVIC = { home: "home", cal: "calendar", tasks: "tasks", habits: "flame", fin: "wallet", more: "grid" };
const TAB_NAMES = { home: "Главная", cal: "Календарь", tasks: "Задачи", habits: "Привычки", fin: "Финансы", more: "Ещё" };
function go(tab, screen, arg) { R = { tab, screen: screen || null, arg: arg || null }; const mv = $("#view"); if (mv) { mv.classList.add("anim"); clearTimeout(go.t); go.t = setTimeout(() => mv.classList.remove("anim"), 600); } render(); const v = $("#view"); if (v) v.scrollTop = 0; }
function navGo(id) { if (id === "more" || TABVIEWS[id]) go(id); else go("more", id); }
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
}
function render() {
  const nav = $("#nav"), ids = [...S.settings.nav, "more"];
  const act = id => id === "more" ? (R.tab === "more" && !(R.screen && S.settings.nav.includes(R.screen))) : (R.screen ? R.screen === id : R.tab === id);
  nav.innerHTML = ids.map(id => `<button class="${act(id) ? "active" : ""}" data-t="${id}"><span class="nv">${sec(id, 23)}</span><span>${id === "more" ? "Ещё" : NAV_META[id][0]}</span></button>`).join("");
  $$("button", nav).forEach(b => b.onclick = () => { buzz(); navGo(b.dataset.t); });
  const n = new Date();
  const name = (inTG && TG.initDataUnsafe && TG.initDataUnsafe.user && TG.initDataUnsafe.user.first_name) || "";
  $("#hTitle").textContent = R.screen ? (SCR_TITLES[R.screen] || "") : (R.tab === "home" ? greeting() + (name ? ", " + name : "") : (TAB_NAMES[R.tab] || ""));
  $("#hSub").textContent = `${DAYS_FULL[n.getDay()].replace(/^./, c => c.toUpperCase())}, ${n.getDate()} ${MONTHS[n.getMonth()]}`;
  $("#hBack").classList.toggle("hidden", !R.screen || S.settings.nav.includes(R.screen));
  document.body.classList.toggle("sub", !!R.screen);
  $("#hLock").classList.toggle("hidden", !S.settings.pin);
  $("#hAcc").classList.toggle("hidden", !!R.screen && !S.settings.nav.includes(R.screen) ? true : !!R.screen);
  $("#hSearch").classList.toggle("hidden", R.screen === "search");
  const v = $("#view");
  const fn = R.screen ? SCREENS[R.screen] : TABVIEWS[R.tab];
  v.innerHTML = "";
  (fn || (() => { }))(v);
  applyTheme();
}
function applyTheme() {
  let th = S.settings.theme;
  if (th === "auto") th = window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.dataset.theme = th; document.documentElement.dataset.scheme = S.settings.scheme; document.documentElement.dataset.ui = S.settings.ui || "bento";
  const c = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  const m = $("#themeColor"); if (m && c) m.content = c;
  if (inTG) { try { TG.setHeaderColor(c); TG.setBackgroundColor(c); } catch (e) { /* игнор */ } }
}
function fab(fn) { const b = document.createElement("button"); b.className = "fab"; b.innerHTML = ic("plus", 26); b.setAttribute("aria-label", "Добавить"); b.onclick = fn; $("#view").appendChild(b); }
function dayLabel(ts) {
  const k = dkey(new Date(ts));
  if (k === todayKey()) return "Сегодня";
  if (k === dkey(addDays(new Date(), 1))) return "Завтра";
  if (k === dkey(addDays(new Date(), -1))) return "Вчера";
  return fmtDate(k);
}
const keyLabel = k => k === todayKey() ? "Сегодня" : k === dkey(addDays(new Date(), 1)) ? "Завтра" : k === dkey(addDays(new Date(), -1)) ? "Вчера" : fmtDate(k);
const empty = t => `<div class="empty">${t}</div>`;

/* ============ строки списков ============ */
function remRow(r) {
  const c = catOf(r.cat), p = PRIO[r.prio || 2];
  return `<div class="card li" data-id="${r.id}" data-k="rem">
    <div class="chk ${r.done ? "done" : ""}" data-act="done"></div>
    <div class="grow" data-act="edit"><div class="title ${r.done ? "done-t" : ""}">${esc(r.title)}</div>
    <div class="meta"><span class="cdot" style="background:${c.color}"></span>${dayLabel(r.at)}, ${fmtT(r.at)}${r.repeat !== "none" ? ` · ${ic("repeat", 13)}${REPEAT[r.repeat].toLowerCase()}` : ""} ${(r.prio || 2) !== 2 ? `· <span class="badge ${p[1]}">${p[0]}</span>` : ""}</div></div>
    ${r.done ? "" : `<button class="ibtn sm" data-act="snooze" aria-label="Отложить">${ic("clock", 17)}</button>`}</div>`;
}
function bindRem(root) {
  $$('[data-k="rem"] [data-act]', root).forEach(el => el.onclick = () => {
    const id = el.closest("[data-id]").dataset.id, r = S.reminders.find(x => x.id === id); if (!r) return;
    const a = el.dataset.act;
    if (a === "edit") return remForm(id);
    if (a === "snooze") return snoozeSheet(id);
    r.done = !r.done; r.doneAt = r.done ? Date.now() : null;
    if (r.done && r.repeat !== "none") { r.at = nextRepeat(r.at, r.repeat, r.days); r.done = false; r.fk = []; toast("Следующее: " + fmtDT(r.at)); }
    save(); render();
  });
}
const taskOpen = new Set();
function taskRow(t) {
  const p = PRIO[t.prio || 2], subs = t.subs || [], sd = subs.filter(s => s.done).length;
  const open = taskOpen.has(t.id), over = !t.done && t.due && t.due < todayKey();
  return `<div class="card li col" data-id="${t.id}" data-k="task">
    <div class="row"><div class="chk ${t.done ? "done" : ""}" data-act="done"></div>
    <div class="grow" data-act="open"><div class="title ${t.done ? "done-t" : ""}">${esc(t.title)}</div>
    <div class="meta"><span class="cdot" style="background:${catOf(t.cat).color}"></span>${t.due ? `<span style="${over ? "color:var(--bad);font-weight:600" : ""}">${keyLabel(t.due)}</span>` : ""}${(t.prio || 2) !== 2 ? ` · <span class="badge ${p[1]}">${p[0]}</span>` : ""}${t.project ? " · " + esc(t.project) : ""}${t.repeat && t.repeat !== "none" ? " · " + ic("repeat", 13) : ""}${subs.length ? ` · ${sd}/${subs.length}` : ""}</div></div>
    <button class="ibtn sm" data-act="edit" aria-label="Изменить">${ic("edit", 16)}</button></div>
    ${subs.length ? `<div class="bar ${sd === subs.length ? "ok" : ""}" style="margin-left:38px"><i style="width:${Math.round(sd / subs.length * 100)}%"></i></div>` : ""}
    ${open ? `<div style="margin:10px 0 0 38px">${subs.map(s => `<div class="row" style="margin:8px 0" data-sid="${s.id}"><div class="chk ${s.done ? "done" : ""}" data-act="sdone" style="width:21px;height:21px"></div><div class="grow ${s.done ? "done-t" : ""}">${esc(s.t)}</div><button class="ibtn sm" data-act="sdel" aria-label="Удалить">${ic("x", 15)}</button></div>`).join("")}
      <div class="row" style="margin-top:6px"><input data-sub placeholder="Новая подзадача" style="margin:0"><button class="ibtn acc" data-act="sadd" aria-label="Добавить">${ic("plus", 18)}</button></div></div>` : ""}</div>`;
}
function bindTask(root) {
  $$('[data-k="task"] [data-act]', root).forEach(el => el.onclick = ev => {
    ev.stopPropagation();
    const card = el.closest("[data-id]"), t = S.tasks.find(x => x.id === card.dataset.id); if (!t) return;
    const a = el.dataset.act, sid = el.closest("[data-sid]") && el.closest("[data-sid]").dataset.sid;
    if (a === "edit") return taskForm(t.id);
    if (a === "open") { taskOpen.has(t.id) ? taskOpen.delete(t.id) : taskOpen.add(t.id); return render(); }
    if (a === "done") toggleTask(t);
    else if (a === "sdone") { const s = t.subs.find(x => x.id === sid); if (s) s.done = !s.done; }
    else if (a === "sdel") t.subs = t.subs.filter(x => x.id !== sid);
    else if (a === "sadd") { const i = $("[data-sub]", card), txt = i.value.trim(); if (!txt) return; t.subs.push({ id: uid(), t: txt, done: false }); }
    save(); render();
  });
}

/* ============ ГЛАВНАЯ ============ */
let wxCache = null;
const WX = c => c === 0 ? "ясно" : c <= 3 ? "облачно" : c <= 48 ? "туман" : c <= 57 ? "морось" : c <= 67 ? "дождь" : c <= 77 ? "снег" : c <= 82 ? "ливень" : c >= 95 ? "гроза" : "пасмурно";
async function loadWeather(el) {
  const c = S.settings.city; if (!c || !el) return;
  if (wxCache && wxCache.k === c.name && Date.now() - wxCache.t < 30 * 60e3) { el.innerHTML = wxCache.h; return; }
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`);
    const j = (await r.json()).current;
    const h = `${esc(c.name)}: ${Math.round(j.temperature_2m)}°, ${WX(j.weather_code)}, ветер ${Math.round(j.wind_speed_10m)} км/ч`;
    wxCache = { k: c.name, t: Date.now(), h }; el.innerHTML = h;
  } catch (e) { el.textContent = "Погода недоступна офлайн"; }
}
let HT = "today";
const TIPS = [["Правило двух минут", "Если дело занимает меньше двух минут — сделайте его сразу."], ["Съешьте лягушку", "Начните день с самой неприятной задачи — дальше будет легче."], ["Один фокус", "Выберите на сегодня три главных дела, остальное — бонус."], ["Перерывы работают", "25 минут работы и 5 минут отдыха возвращают концентрацию."], ["Вечерний обзор", "Пять минут вечером на план завтра экономят час утром."], ["Маленькие шаги", "Привычка из двух минут в день закрепляется быстрее большой цели."], ["Вода и сон", "Стакан воды утром и сон до полуночи улучшают продуктивность."]];
function weekData() {
  const s = addDays(new Date(), -monIdx(new Date()));
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(s, i), k = dkey(d);
    const done = S.tasks.filter(t => t.done && t.doneAt && dkey(new Date(t.doneAt)) === k).length + S.habits.filter(h => h.log[k]).length;
    const spent = S.tx.filter(t => t.type !== "in" && dkey(new Date(t.ts)) === k).reduce((a, t) => a + t.amt, 0);
    return { k, d, done, spent, water: waterOn(k), foc: S.pomoLog.filter(ts => dkey(new Date(ts)) === k).length, today: k === todayKey() };
  });
}
const bars = (arr, key, fmt) => { const mx = Math.max(1, ...arr.map(x => x[key])); return `<div class="chart">${arr.map(x => `<div class="col ${x[key] ? "on" : ""} ${x.today ? "today" : ""}"><b>${x[key] ? (fmt ? fmt(x[key]) : x[key]) : ""}</b><i style="height:${Math.max(5, Math.round(x[key] / mx * 78))}px"></i><span>${DAYS[x.d.getDay()]}</span></div>`).join("")}</div>`; };
const kpi = (icn, c, val, lab, extra) => `<div class="kpi" style="--c:${c}">${tint(icn, c, 34)}<b>${val}</b><span>${lab}</span>${extra ? `<div><em>${extra}</em></div>` : ""}</div>`;
TABVIEWS.home = function (v) {
  const now = new Date(), k = todayKey(), pr = dayProgress();
  const seg = `<div class="chips seg">${[["today", "Сегодня"], ["week", "Неделя"], ["total", "Итоги"]].map(([a, l]) => `<span class="chip ${HT === a ? "active" : ""}" data-ht="${a}">${l}</span>`).join("")}</div>`;
  let body = "";
  if (HT === "today") {
    const next = S.reminders.filter(r => !r.done && r.at > Date.now() - 600e3).sort((a, b) => a.at - b.at).slice(0, 3);
    const todayTasks = S.tasks.filter(t => !t.done && !t.archived && t.due && t.due <= k).sort((a, b) => a.prio - b.prio);
    const todayEv = itemsOn(k).filter(x => x.src === "ev" || x.src === "sch").length;
    const strip = Array.from({ length: 7 }, (_, i) => { const d = addDays(now, i), key = dkey(d); return { d, key, n: itemsOn(key).filter(x => x.src !== "hol").length }; });
    const wl = waterOn(k), wg = S.settings.waterGoal || 2000, wp = Math.min(100, Math.round(wl / wg * 100));
    const tip = TIPS[(now.getDate() + now.getMonth()) % TIPS.length];
    const sec = (t, go, lab) => `<h2>${t}${go ? ` <a data-go="${go}">${lab || "Все"}</a>` : ""}</h2>`;
    const W = {
      hero: () => `<div class="card hero"><div class="grow"><div class="big-n" id="clk">${pad(now.getHours())}:${pad(now.getMinutes())}</div>
        <div class="meta" id="wx" style="margin-top:4px">${S.settings.city ? "Загрузка погоды…" : '<a href="#" id="wxSet" style="color:#fff;font-weight:600;text-decoration:none">Указать город для погоды</a>'}</div>
        <div class="hero-stats"><span>${ic("tasks", 14)}${pr.openTasks} задач</span><span>${ic("calendar", 14)}${todayEv} событий</span><span>${ic("flame", 14)}${pr.hDone}/${pr.hTotal}</span></div></div>
        <div style="text-align:center"><div class="ring" style="--p:${pr.pct}"><i>${pr.pct}%</i></div><div class="meta" style="margin-top:6px">${pr.total ? `${pr.ok} из ${pr.total}` : "дел нет"}</div></div></div>`,
      bento: () => {
        const nx = next[0], best = S.habits.reduce((a, h) => Math.max(a, habitStreak(h).n), 0);
        const mtx = monthTx(now.getFullYear(), now.getMonth()), bal = mtx.filter(t => t.type === "in").reduce((a, t) => a + t.amt, 0) - mtx.filter(t => t.type !== "in").reduce((a, t) => a + t.amt, 0);
        const foc = S.pomoLog.filter(ts => dkey(new Date(ts)) === k).length;
        const T = (go, c, icn, big, lab, extra, cls) => `<button class="tile ${cls || ""}" style="--c:${c};${extra || ""}" data-go="${go}"><span class="ti">${ic(icn, 20)}</span><span class="tb"><b>${big}</b><span>${lab}</span></span></button>`;
        return `<div class="bento">
          ${T("tasks", "#4fd18f", "tasks", todayTasks.length, "задач на сегодня")}
          ${T("reminders", "#6a8cff", "bell", nx ? fmtT(nx.at) : "—", nx ? esc(nx.title.length > 22 ? nx.title.slice(0, 21) + "…" : nx.title) : "нет напоминаний")}
          ${T("habits", "#ff9a5b", "flame", pr.hDone + "/" + pr.hTotal, best ? "серия " + best + " дн." : "привычки сегодня")}
          <button class="tile fill" style="--c:#4aa8ff;--p:${wp}" data-w="250"><span class="ti">${ic("drop", 20)}</span><span class="tb"><b>${wl}<small> мл</small></b><span>вода · нажмите +250</span></span></button>
        </div>`;
      },
      acts: () => `<div class="acts">${[["bell", "#6a8cff", "Напомнить", "rem"], ["tasks", "#4fd18f", "Задача", "task"], ["calendar", "#ff9a5b", "Событие", "ev"], ["note", "#c78bff", "Заметка", "note"]].map(([i, c, l, a]) => `<button class="act" data-act="${a}">${tint(i, c, 42)}${l}</button>`).join("")}</div>`,
      qa: () => `<div class="qa"><input id="qa" placeholder="Завтра в 16:00 отчёт…"><button class="ibtn soft" id="qaT" aria-label="Добавить задачу">${ic("tasks", 19)}</button><button class="ibtn acc" id="qaR" aria-label="Добавить напоминание">${ic("bell", 19)}</button></div>`,
      rem: () => sec("Ближайшие напоминания", "reminders") + (next.length ? next.map(remRow).join("") : empty("Нет ближайших напоминаний")),
      tasks: () => sec("Задачи на сегодня", "tasks") + (todayTasks.length ? todayTasks.slice(0, 5).map(taskRow).join("") : empty("На сегодня всё сделано")),
      water: () => `<h2>Вода</h2><div class="card"><div class="water-w">${tint("drop", "#4aa8ff", 44)}<div class="grow"><div class="title">${wl} из ${wg} мл</div><div class="bar"><i style="width:${wp}%"></i></div></div><button class="btn sm sec" data-w="250">+250</button></div></div>`,
      strip: () => sec("Неделя вперёд", "cal", "Календарь") + `<div class="strip">${strip.map(s => `<div class="day ${s.key === k ? "today" : ""}" data-k="${s.key}"><span>${DAYS[s.d.getDay()]}</span><b>${s.d.getDate()}</b><em>${Array.from({ length: Math.min(3, s.n) }, () => "<i></i>").join("")}</em></div>`).join("")}</div>`,
      habits: () => S.habits.length ? sec("Привычки", "habits") + S.habits.map(hb => { const st = habitStreak(hb); return `<div class="card li" data-hid="${hb.id}"><div class="chk ${hb.log[k] ? "done" : ""}" data-hchk></div><div class="grow"><div class="title">${esc(hb.name)}</div><div class="meta">${hb.goal.type === "week" ? hb.goal.n + " раза в неделю" : "каждый день"}</div></div>${st.n ? `<span class="streak">${ic("flame", 15)}${st.n}</span>` : ""}</div>`; }).join("") : "",
      fin: () => { const m = monthTx(now.getFullYear(), now.getMonth()), inc = m.filter(t => t.type === "in").reduce((a, t) => a + t.amt, 0), exp = m.filter(t => t.type !== "in").reduce((a, t) => a + t.amt, 0), last = S.tx.slice().sort((a, b) => b.ts - a.ts).slice(0, 2);
        return sec("Финансы месяца", "fin", "Открыть") + `<div class="card"><div class="row"><div class="grow"><div class="meta">Баланс</div><div class="title" style="font-size:24px;font-weight:800;letter-spacing:-.03em">${money(inc - exp)}</div></div><div style="text-align:right"><b style="color:var(--ok)">+${money(inc)}</b><div></div><b style="color:var(--bad)">−${money(exp)}</b></div></div>${last.map(t => `<div class="row meta" style="margin-top:8px"><div class="grow">${esc(t.cat)}${t.note ? " · " + esc(t.note) : ""}</div><b>${t.type === "in" ? "+" : "−"}${money(t.amt)}</b></div>`).join("")}</div>`; },
      notes: () => { const l = S.notes.slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.ts || 0) - (a.ts || 0)).slice(0, 3);
        return sec("Заметки", "notes") + (l.length ? `<div class="group">${l.map(n => `<div class="card li" data-go="notes">${tint(n.type === "shop" ? "cart" : n.type === "check" ? "tasks" : "note", "#8b7bd8", 36)}<div class="grow"><div class="title">${esc(n.title || "Без названия")}</div><div class="meta">${n.type === "note" ? esc((n.text || "").slice(0, 50)) : (n.items || []).length + " пунктов"}</div></div></div>`).join("")}</div>` : empty("Заметок нет")); },
      bdays: () => { const l = S.events.filter(e => e.kind === "birthday").map(e => { const d = pkey(e.date || k); let nx = new Date(now.getFullYear(), d.getMonth(), d.getDate()); if (dkey(nx) < k) nx = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate()); return { e, nx, days: Math.round((nx - pkey(k)) / 864e5) }; }).sort((a, b) => a.days - b.days).slice(0, 3);
        return sec("Дни рождения", "bdays") + (l.length ? `<div class="group">${l.map(x => `<div class="card li" data-go="bdays">${tint("cake", "#d1a85b", 36)}<div class="grow"><div class="title">${esc(x.e.title)}</div><div class="meta">${fmtDate(dkey(x.nx))}</div></div><b>${x.days === 0 ? "сегодня" : x.days + " дн."}</b></div>`).join("")}</div>` : empty("Нет дней рождения")); },
      goals: () => sec("Цели", "goals") + (S.goals.length ? S.goals.slice(0, 3).map(g => { const dn = g.steps.filter(x => x.done).length, p = g.steps.length ? Math.round(dn / g.steps.length * 100) : 0; return `<div class="card" data-go="goals"><div class="row"><div class="grow title">${esc(g.name)}</div><b>${p}%</b></div><div class="bar"><i style="width:${p}%"></i></div></div>`; }).join("") : empty("Целей нет")),
      pomo: () => { const n = S.pomoLog.filter(ts => dkey(new Date(ts)) === k).length; return `<h2>Фокус</h2><div class="card"><div class="row">${tint("timer", "#ff7b8a", 44)}<div class="grow"><div class="title">${n} сессий сегодня</div><div class="meta">Pomodoro ${S.settings.pomo.work} / ${S.settings.pomo.brk} мин</div></div><button class="btn sm sec" data-go="tools">Запустить</button></div></div>`; },
      counts: () => { const l = S.counts.map(c => ({ c, d: Math.round((pkey(c.date) - pkey(k)) / 864e5) })).filter(x => x.d >= 0).sort((a, b) => a.d - b.d).slice(0, 2); return l.length ? sec("Обратный отсчёт", "counts") + `<div class="group">${l.map(x => `<div class="card li" data-go="counts">${tint("hourglass", "#4fb3a9", 36)}<div class="grow"><div class="title">${esc(x.c.name)}</div><div class="meta">${fmtDate(x.c.date)}</div></div><b>${x.d === 0 ? "сегодня" : x.d + " дн."}</b></div>`).join("")}</div>` : ""; },
      tip: () => `<div class="tip"><span class="kind" style="color:var(--accent)">${ic("zap", 20)}</span><div><b>${tip[0]}</b><span>${tip[1]}</span></div></div>`
    };
    body = S.settings.widgets.filter(w => w.on && W[w.id]).map(w => W[w.id]()).join("") + `<button class="btn sec full" id="cust" style="margin-top:6px">${ic("gear", 18)} Настроить главный экран</button>`;
  } else if (HT === "week") {
    const w = weekData(), doneW = w.reduce((a, x) => a + x.done, 0), spentW = w.reduce((a, x) => a + x.spent, 0), focW = w.reduce((a, x) => a + x.foc, 0), waterW = Math.round(w.reduce((a, x) => a + x.water, 0) / 7);
    const upc = S.events.filter(e => e.kind === "birthday").map(e => { const d = pkey(e.date || todayKey()); let nx = new Date(now.getFullYear(), d.getMonth(), d.getDate()); if (dkey(nx) < k) nx = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate()); return { e, nx, days: Math.round((nx - pkey(k)) / 864e5) }; }).sort((a, b) => a.days - b.days).slice(0, 3);
    const cnt = S.counts.map(c => ({ c, d: Math.round((pkey(c.date) - pkey(k)) / 864e5) })).filter(x => x.d >= 0).sort((a, b) => a.d - b.d).slice(0, 3);
    body = `<div class="kpis">${kpi("tasks", "#4fd18f", doneW, "выполнено за неделю")}${kpi("timer", "#ff7b8a", focW, "фокус-сессий")}${kpi("wallet", "#ffb347", money(spentW), "расходы недели")}${kpi("drop", "#4aa8ff", waterW + " мл", "вода в день")}</div>
      <h2>Выполнено по дням</h2><div class="card">${bars(w, "done")}</div>
      <h2>Расходы по дням</h2><div class="card">${bars(w, "spent", n => n >= 1000 ? Math.round(n / 100) / 10 + "к" : n)}</div>
      ${upc.length ? `<h2>Дни рождения</h2><div class="group">${upc.map(x => `<div class="card li">${tint("cake", "#d1a85b", 38)}<div class="grow"><div class="title">${esc(x.e.title)}</div><div class="meta">${fmtDate(dkey(x.nx))}</div></div><b>${x.days === 0 ? "сегодня" : x.days + " дн."}</b></div>`).join("")}</div>` : ""}
      ${cnt.length ? `<h2>Обратный отсчёт</h2><div class="group">${cnt.map(x => `<div class="card li">${tint("hourglass", "#4fb3a9", 38)}<div class="grow"><div class="title">${esc(x.c.name)}</div><div class="meta">${fmtDate(x.c.date)}</div></div><b>${x.d === 0 ? "сегодня" : x.d + " дн."}</b></div>`).join("")}</div>` : ""}`;
  } else {
    const tot = S.tasks.filter(t => t.done).length, best = S.habits.reduce((a, h) => Math.max(a, habitStreak(h).n), 0);
    const mtx = monthTx(now.getFullYear(), now.getMonth()), inc = mtx.filter(t => t.type === "in").reduce((a, t) => a + t.amt, 0), exp = mtx.filter(t => t.type !== "in").reduce((a, t) => a + t.amt, 0);
    const rate = S.habits.length ? Math.round(S.habits.reduce((a, h) => a + habitRate(h, 30), 0) / S.habits.length * 100) : 0;
    body = `<div class="kpis">${kpi("tasks", "#4fd18f", tot, "задач выполнено всего", S.tasks.length ? Math.round(tot / S.tasks.length * 100) + "% от всех" : "")}${kpi("flame", "#ff9a5b", best, "лучшая серия, дн.")}${kpi("trend", "#6a8cff", rate + "%", "привычки за месяц")}${kpi("timer", "#ff7b8a", S.pomoLog.length, "фокус-сессий всего")}${kpi("note", "#c78bff", S.notes.length, "заметок и списков")}${kpi("bell", "#ffb347", S.reminders.filter(r => !r.done).length, "активных напоминаний")}</div>
      <h2>Финансы месяца</h2><div class="card"><div class="row"><div class="grow"><div class="meta">Баланс</div><div class="title" style="font-size:24px;font-weight:800;letter-spacing:-.03em">${money(inc - exp)}</div></div><div style="text-align:right"><div class="meta">доходы</div><b style="color:var(--ok)">${money(inc)}</b><div class="meta" style="margin-top:4px">расходы</div><b style="color:var(--bad)">${money(exp)}</b></div></div></div>
      <button class="btn sec full" id="toAn">${ic("chart", 18)} Подробная статистика</button>`;
  }
  const soon = (() => {
    const t0 = Date.now(), c = [];
    S.reminders.filter(r => !r.done && r.at > t0 - 60e3 && r.at - t0 < 90 * 60e3).forEach(r => c.push({ at: r.at, t: r.title }));
    itemsOn(k).forEach(it => { if ((it.src === "ev" || it.src === "sch") && it.time) { const [h, mm] = it.time.split(":").map(Number), d = new Date(); d.setHours(h, mm, 0, 0); if (d - t0 > 0 && d - t0 < 90 * 60e3) c.push({ at: +d, t: it.title }); } });
    c.sort((a, b) => a.at - b.at); const x = c[0]; if (!x) return "";
    const mn = Math.max(1, Math.round((x.at - t0) / 60000));
    return `<button class="soon" data-go="notifs"><span class="sd"></span><span class="grow"><b>${esc(x.t)}</b><small>${mn < 60 ? "через " + mn + " мин" : "через " + Math.floor(mn / 60) + " ч " + (mn % 60) + " мин"} · в ${fmtT(x.at)}</small></span><span>›</span></button>`;
  })();
  v.innerHTML = soon + seg + body;
  $$("[data-ht]", v).forEach(c => c.onclick = () => { HT = c.dataset.ht; render(); });
  if (HT === "total") { $("#toAn").onclick = () => go("more", "stats"); return; }
  if (HT === "week") return;
  bindRem(v); bindTask(v);
  $$(".act", v).forEach(b => b.onclick = () => ({ rem: () => remForm(), task: () => taskForm(), ev: () => eventForm(), note: () => noteForm() })[b.dataset.act]());
  $$("[data-w]", v).forEach(b => b.onclick = () => { S.water.push({ id: uid(), ts: Date.now(), ml: +b.dataset.w }); save(); render(); toast("+" + b.dataset.w + " мл"); });
  $$("[data-go]", v).forEach(b => b.onclick = () => navGo(b.dataset.go));
  $("#cust") && ($("#cust").onclick = homeLayoutSheet);
  $("#wxSet") && ($("#wxSet").onclick = e => { e.preventDefault(); go("more", "settings"); });
  $$(".strip .day", v).forEach(d => d.onclick = () => { CAL.sel = d.dataset.k; CAL.cur = pkey(d.dataset.k); CAL.mode = "day"; go("cal"); });
  $$("[data-hchk]", v).forEach(c => c.onclick = () => { const hb = S.habits.find(x => x.id === c.closest("[data-hid]").dataset.hid); hb.log[k] ? delete hb.log[k] : (hb.log[k] = true); save(); render(); });
  const qa = $("#qa");
  if (qa) {
    $("#qaT").onclick = () => { const p = parseNL(qa.value), t = (p.title || qa.value).trim(); if (!t) return toast("Введите текст"); S.tasks.push({ id: uid(), title: t, due: p.at ? dkey(new Date(p.at)) : k, prio: 2, cat: "life", project: "", subs: [], repeat: "none", done: false }); save(); render(); };
    $("#qaR").onclick = () => { const p = parseNL(qa.value); if (!p.title && !qa.value.trim()) return toast("Введите текст"); if (!p.found) { remForm(null, { title: p.title || qa.value }); return toast("Укажите время"); } S.reminders.push({ id: uid(), title: p.title || qa.value, at: p.at, repeat: p.repeat, days: [], prio: 2, cat: "life", pre: [0], fk: [], done: false }); save(); toast("Напоминание: " + fmtDT(p.at)); render(); };
    qa.onkeydown = e => { if (e.key === "Enter") $("#qaT").click(); };
  }
  if ($("#wx")) loadWeather($("#wx"));
};

/* ============ КАЛЕНДАРЬ ============ */
const CAL = { mode: "month", cur: new Date(), sel: todayKey() };
const KIND_IC = { rem: "bell", task: "tasks", birthday: "cake", hol: "flag", important: "flag" };
function dayList(key, withDate) {
  const its = itemsOn(key);
  if (!its.length) return empty("Событий нет");
  return its.map((it, i) => `<div class="card li tl clk" style="--c:${it.color}" data-i="${i}" data-key="${key}">
    ${it.time ? `<div class="tm"><b>${it.time}</b>${it.end ? `<span>${it.end}</span>` : ""}</div>` : `<div class="tm all">весь<br>день</div>`}
    <div class="grow"><div class="title">${KIND_IC[it.k] ? `<span class="kind">${ic(KIND_IC[it.k], 15)}</span>` : ""}${esc(it.title)}</div>${it.place ? `<div class="meta">${esc(it.place)}</div>` : ""}</div></div>`).join("");
}
function bindDayList(root) {
  $$("[data-key]", root).forEach(c => c.onclick = () => { const it = itemsOn(c.dataset.key)[+c.dataset.i]; if (it && it.src !== "hol") openItem(it); });
}
TABVIEWS.cal = function (v) {
  const cur = CAL.cur, mode = CAL.mode, k0 = todayKey();
  let head = "", body = "";
  const nav = label => `<div class="mhead"><button class="ibtn" data-nav="-1" aria-label="Назад">${ic("back", 20)}</button><b>${label}</b><button class="ibtn" data-nav="1" aria-label="Вперёд">${ic("chevron", 20)}</button></div>`;
  if (mode === "month") {
    const y = cur.getFullYear(), m = cur.getMonth(), first = new Date(y, m, 1), off = monIdx(first), dim = new Date(y, m + 1, 0).getDate();
    const cells = Math.ceil((off + dim) / 7) * 7;
    head = nav(`${MONTHS_N[m]} ${y}`);
    const selItems = itemsOn(CAL.sel).length;
    body = `<div class="mgrid">${["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map(d => `<div class="wd">${d}</div>`).join("")}${Array.from({ length: cells }, (_, i) => {
      const d = new Date(y, m, 1 - off + i), key = dkey(d), its = itemsOn(key), cols = [...new Set(its.map(x => x.color))].slice(0, 3);
      const hol = its.some(x => x.k === "hol") || d.getDay() === 0 || d.getDay() === 6;
      return `<button class="${d.getMonth() !== m ? "out" : ""} ${key === k0 ? "today" : ""} ${key === CAL.sel ? "sel" : ""} ${hol ? "hol" : ""}" data-d="${key}">${d.getDate()}<div class="dots">${cols.map(c => `<i style="background:${c}"></i>`).join("")}</div></button>`;
    }).join("")}</div>
    <h2>${DAYS_FULL[pkey(CAL.sel).getDay()].replace(/^./, c => c.toUpperCase())}, ${fmtDate(CAL.sel)} <span style="font-weight:400">${selItems ? selItems + " дел" : ""}</span></h2>${dayList(CAL.sel)}`;
  } else if (mode === "week") {
    const s = addDays(cur, -monIdx(cur));
    head = nav(`${fmtDate(dkey(s))} — ${fmtDate(dkey(addDays(s, 6)))}`);
    body = Array.from({ length: 7 }, (_, i) => { const key = dkey(addDays(s, i)); return `<h2>${DAYS_FULL[addDays(s, i).getDay()].replace(/^./, c => c.toUpperCase())}, ${fmtDate(key)}</h2>${dayList(key, true)}`; }).join("");
  } else {
    head = nav(`${DAYS_FULL[cur.getDay()].replace(/^./, c => c.toUpperCase())}, ${fmtDate(dkey(cur))}`);
    body = dayList(dkey(cur));
  }
  v.innerHTML = `<div class="chips seg">${[["month", "Месяц"], ["week", "Неделя"], ["day", "День"]].map(([k, l]) => `<span class="chip ${mode === k ? "active" : ""}" data-m="${k}">${l}</span>`).join("")}</div>${head}${body}`;
  $$("[data-m]", v).forEach(c => c.onclick = () => { CAL.mode = c.dataset.m; render(); });
  $$("[data-nav]", v).forEach(b => b.onclick = () => {
    const s = +b.dataset.nav, d = new Date(CAL.cur);
    if (mode === "month") d.setMonth(d.getMonth() + s, 1); else d.setDate(d.getDate() + s * (mode === "week" ? 7 : 1));
    CAL.cur = d; if (mode !== "month") CAL.sel = dkey(d); render();
  });
  $$(".mhead b", v).forEach(b => b.onclick = () => { CAL.cur = new Date(); CAL.sel = todayKey(); render(); });
  $$("[data-d]", v).forEach(b => b.onclick = () => { CAL.sel = b.dataset.d; CAL.cur = pkey(b.dataset.d); render(); });
  bindDayList(v);
  fab(() => eventForm(null, { date: mode === "month" ? CAL.sel : dkey(cur) }));
};

/* ============ ЗАДАЧИ ============ */
let TF = "open";
TABVIEWS.tasks = function (v) {
  const k = todayKey();
  const open = S.tasks.filter(t => !t.done && !t.archived).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.prio - b.prio);
  const done = S.tasks.filter(t => t.done && !t.archived).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const arch = S.tasks.filter(t => t.archived);
  const overdue = open.filter(t => t.due && t.due < k);
  const all = S.tasks.filter(t => !t.archived), pct = all.length ? Math.round(all.filter(t => t.done).length / all.length * 100) : 0;
  let body = "";
  if (TF === "open") {
    body = `${overdue.length ? `<div class="card" style="background:color-mix(in srgb,var(--bad) 11%,var(--surface))"><div class="row"><span class="tint" style="--c:var(--bad);width:38px;height:38px">${ic("clock", 20)}</span><div class="grow"><b>Просрочено: ${overdue.length}</b><div class="meta">Перенесите все задачи на другой день</div></div></div><div class="grid2" style="margin-top:12px"><button class="btn sm sec" id="mvT">На сегодня</button><button class="btn sm sec" id="mvM">На завтра</button></div></div>` : ""}
    ${open.length ? open.map(taskRow).join("") : empty("Нет открытых задач")}
    ${done.length ? `<h2>Выполнено <a id="toArch">В архив</a></h2>${done.slice(0, 10).map(taskRow).join("")}` : ""}`;
  } else if (TF === "proj") {
    const groups = {}; open.forEach(t => { (groups[t.project || "Без проекта"] = groups[t.project || "Без проекта"] || []).push(t); });
    body = Object.keys(groups).length ? Object.entries(groups).map(([p, ts]) => {
      const tot = S.tasks.filter(t => (t.project || "Без проекта") === p && !t.archived), dn = tot.filter(t => t.done).length;
      return `<h2>${esc(p)} <span style="font-weight:400">${dn} из ${tot.length}</span></h2>${ts.map(taskRow).join("")}`;
    }).join("") : empty("Проектов нет");
  } else body = arch.length ? arch.map(taskRow).join("") : empty("Архив пуст");
  v.innerHTML = `<div class="card"><div class="row"><div class="grow"><div class="meta">Общий прогресс</div><div class="title" style="font-size:22px;letter-spacing:-.02em">${all.filter(t => t.done).length} из ${all.length} выполнено</div></div><div class="ring" style="--p:${pct};width:62px;height:62px"><i style="width:46px;height:46px;font-size:14px">${pct}%</i></div></div></div>
    <div class="chips seg">${[["open", "Открытые"], ["proj", "Проекты"], ["arch", "Архив"]].map(([a, l]) => `<span class="chip ${TF === a ? "active" : ""}" data-f="${a}">${l}</span>`).join("")}</div>${body}`;
  $$("[data-f]", v).forEach(c => c.onclick = () => { TF = c.dataset.f; render(); });
  const mv = d => { overdue.forEach(t => { t.due = d; }); save(); render(); toast("Перенесено"); };
  $("#mvT") && ($("#mvT").onclick = () => mv(k)); $("#mvM") && ($("#mvM").onclick = () => mv(dkey(addDays(new Date(), 1))));
  $("#toArch") && ($("#toArch").onclick = () => { done.forEach(t => { t.archived = true; }); save(); render(); });
  bindTask(v); fab(() => taskForm());
};

/* ============ ПРИВЫЧКИ ============ */
function habitDetail(id) {
  const h = S.habits.find(x => x.id === id); if (!h) return;
  const now = new Date(), y = now.getFullYear(), m = now.getMonth(), first = new Date(y, m, 1), off = monIdx(first), dim = new Date(y, m + 1, 0).getDate();
  const st = habitStreak(h), best = (() => { const ks = Object.keys(h.log).sort(); let b = 0, c = 0, prev = null; ks.forEach(k => { c = prev && dkey(addDays(pkey(prev), 1)) === k ? c + 1 : 1; b = Math.max(b, c); prev = k; }); return b; })();
  sheet(h.name, `
    <div class="stats"><div class="stat"><b>${st.n}</b><span>серия, ${st.unit}</span></div><div class="stat"><b>${Math.round(habitRate(h, 7) * 100)}%</b><span>за 7 дней</span></div><div class="stat"><b>${Math.round(habitRate(h, 30) * 100)}%</b><span>за 30 дней</span></div></div>
    <div class="meta" style="margin:2px 4px 6px">Лучшая серия: ${best} дн. · всего отметок: ${Object.keys(h.log).length}</div>
    <h2>${MONTHS_N[m]}</h2>
    <div class="heat">${["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map(d => `<i style="background:none;color:var(--faint)">${d}</i>`).join("")}${Array.from({ length: off }, () => '<i style="background:none"></i>').join("")}${Array.from({ length: dim }, (_, i) => { const key = dkey(new Date(y, m, i + 1)); return `<i class="${h.log[key] ? "on" : ""}">${i + 1}</i>`; }).join("")}</div>
    <div class="grid2" style="margin-top:16px"><button class="btn sec" id="hEdit">Изменить</button><button class="btn" id="hClose">Готово</button></div>`,
    w => { $("#hEdit").onclick = () => habitForm(id); $("#hClose").onclick = closeSheet; });
}
TABVIEWS.habits = function (v) {
  const k = todayKey(), wk = weekKeys(new Date()), done = S.habits.filter(h => h.log[k]).length;
  const best = S.habits.reduce((a, h) => Math.max(a, habitStreak(h).n), 0);
  const rate = S.habits.length ? Math.round(S.habits.reduce((a, h) => a + habitRate(h, 7), 0) / S.habits.length * 100) : 0;
  v.innerHTML = `<div class="stats"><div class="stat"><b>${done}/${S.habits.length}</b><span>сегодня</span></div><div class="stat"><b>${rate}%</b><span>за неделю</span></div><div class="stat"><b>${best}</b><span>лучшая серия</span></div></div>
  <h2>Мои привычки</h2>
  ${S.habits.length ? S.habits.map(h => {
    const st = habitStreak(h), g = h.goal, wdone = wk.filter(x => h.log[x]).length;
    return `<div class="card hab" data-hid="${h.id}"><div class="row" data-open style="cursor:pointer"><span class="tint" style="--c:${h.color};width:44px;height:44px">${uic(h.icon, 26)}</span><div class="grow"><div class="title">${esc(h.name)}</div>
      <div class="meta">${g.type === "week" ? `${wdone} из ${g.n} на этой неделе` : "Каждый день"}${h.remind ? " · " + h.remind : ""}</div></div>${st.n ? `<span class="streak">${ic("flame", 16)}${st.n}</span>` : ""}</div>
      <div class="wk">${wk.map((key, i) => `<button class="${h.log[key] ? "on" : ""} ${key === k ? "today" : ""}" data-day="${key}" aria-label="${key}">${["П", "В", "С", "Ч", "П", "С", "В"][i]}</button>`).join("")}</div></div>`;
  }).join("") : empty("Добавьте первую привычку: читать, учить английский, делать перерывы")}`;
  $$("[data-day]", v).forEach(b => b.onclick = () => { const h = S.habits.find(x => x.id === b.closest("[data-hid]").dataset.hid), key = b.dataset.day; if (key > k) return toast("Будущие дни отмечать нельзя"); h.log[key] ? delete h.log[key] : (h.log[key] = true); save(); render(); });
  $$("[data-open]", v).forEach(b => b.onclick = () => habitDetail(b.closest("[data-hid]").dataset.hid));
  fab(() => habitForm());
};

$("#hBack").innerHTML = ic("back", 22);
$("#hLock").innerHTML = ic("lock", 18);
$("#hSearch").innerHTML = ic("search", 20);
$("#hSearch").onclick = () => go("more", "search");
$("#hAcc").onclick = () => go("more", "bot");
