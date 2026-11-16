"use strict";
/* ============ нижние шторки и формы ============ */
function toast(t, actLabel, act) {
  const e = $("#toast"); e.textContent = t;
  if (actLabel) { const b = document.createElement("button"); b.textContent = actLabel; b.onclick = () => { e.classList.remove("show"); act(); }; e.appendChild(b); }
  e.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove("show"), actLabel ? 6000 : 2400);
}
/* удаление с возможностью отмены: askDel() запоминает состояние, а save() показывает «Отменить» */
let UNDO = null;
function askDel() { UNDO = { snap: JSON.stringify(S), t: Date.now() }; return true; }
function undoNow(snap) { const acc = S.account; S = Object.assign(def(), JSON.parse(snap)); S.account = acc; save(); render(); toast("Восстановлено"); }
function buzz(kind) { try { if (typeof TG !== "undefined" && TG && TG.HapticFeedback) TG.HapticFeedback.impactOccurred(kind || "light"); else if (navigator.vibrate) navigator.vibrate(8); } catch (e) { /* игнор */ } }
function sheet(title, html, mount) {
  const w = $("#sheet");
  w.innerHTML = `<div class="bd"></div><div class="box"><div class="sh"><b>${esc(title)}</b><button class="btn sec sm" data-x>Закрыть</button></div><div class="sb">${html}</div></div>`;
  w.classList.remove("hidden");
  $(".bd", w).onclick = closeSheet; $("[data-x]", w).onclick = closeSheet;
  if (mount) mount(w);
}
function closeSheet() { const w = $("#sheet"); w.classList.add("hidden"); w.innerHTML = ""; }
const val = id => { const e = $("#" + id); return e ? e.value : ""; };
function chipToggle(root, sel) { $$(sel, root).forEach(c => c.onclick = () => c.classList.toggle("active")); }
function chipOne(root, sel) { $$(sel, root).forEach(c => c.onclick = () => { $$(sel, root).forEach(x => x.classList.remove("active")); c.classList.add("active"); }); }
const catOpts = sel => S.cats.map(c => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.name)}</option>`).join("");
function after() { save(); closeSheet(); render(); }
function voiceInput(cb) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast("Голосовой ввод не поддерживается этим браузером");
  try {
    const r = new SR(); r.lang = "ru-RU"; r.interimResults = false;
    r.onresult = e => cb(e.results[0][0].transcript);
    r.onerror = () => toast("Не удалось распознать речь");
    r.start(); toast("Говорите…");
  } catch (e) { toast("Микрофон недоступен"); }
}
function askNotify() {
  if (!("Notification" in window)) return toast("Уведомления не поддерживаются");
  Notification.requestPermission().then(p => toast(p === "granted" ? "Уведомления включены" : "Уведомления отключены"));
}

/* ---------- напоминание ---------- */
function remForm(id, pref) {
  pref = pref || {};
  const r = id ? S.reminders.find(x => x.id === id) : null;
  const v = r || { title: pref.title || "", at: pref.at || (Date.now() + 3600e3), repeat: pref.repeat || "none", days: [], prio: 2, cat: "life", pre: [0] };
  const pres = [[5, "5 мин"], [10, "10 мин"], [30, "30 мин"], [60, "1 час"], [1440, "1 день"]];
  sheet(r ? "Напоминание" : "Новое напоминание", `
    <label>Что напомнить</label>
    <div class="row" style="margin-bottom:8px"><input id="f_t" value="${esc(v.title)}" style="margin:0"><button class="btn sec" id="f_mic">🎤</button></div>
    <label>Когда</label><input id="f_at" type="datetime-local" value="${toLocalInput(v.at)}">
    <div class="grid2"><div><label>Повтор</label><select id="f_rep">${opt(REPEAT, v.repeat)}</select></div>
    <div><label>Приоритет</label><select id="f_pr">${opt({ 1: "Высокий", 2: "Средний", 3: "Низкий" }, v.prio)}</select></div></div>
    <div id="f_days" class="chips ${v.repeat === "custom" ? "" : "hidden"}">${[1, 2, 3, 4, 5, 6, 0].map(d => `<span class="chip ${(v.days || []).includes(d) ? "active" : ""}" data-d="${d}">${DAYS[d]}</span>`).join("")}</div>
    <label>Категория</label><select id="f_cat">${catOpts(v.cat)}</select>
    <label>Дополнительно предупредить за</label>
    <div class="chips" id="f_pre">${pres.map(([m, l]) => `<span class="chip ${(v.pre || []).includes(m) ? "active" : ""}" data-m="${m}">${l}</span>`).join("")}</div>
    <div class="grid2"><button class="btn" id="f_ok">Сохранить</button>${r ? '<button class="btn bad" id="f_del">Удалить</button>' : "<span></span>"}</div>`,
    w => {
      chipToggle(w, "#f_days .chip"); chipToggle(w, "#f_pre .chip");
      $("#f_rep").onchange = e => $("#f_days").classList.toggle("hidden", e.target.value !== "custom");
      $("#f_mic").onclick = () => voiceInput(t => {
        const p = parseNL(t); $("#f_t").value = p.title || t;
        if (p.at) $("#f_at").value = toLocalInput(p.at);
        if (p.repeat !== "none") { $("#f_rep").value = p.repeat; }
        toast(p.at ? "Время распознано" : "Время не найдено — укажите вручную");
      });
      $("#f_ok").onclick = () => {
        const title = val("f_t").trim(), at = new Date(val("f_at")).getTime();
        if (!title) return toast("Введите текст");
        if (!at || isNaN(at)) return toast("Укажите время");
        const pre = [0, ...$$("#f_pre .chip.active", w).map(c => +c.dataset.m)];
        const days = $$("#f_days .chip.active", w).map(c => +c.dataset.d);
        const repeat = val("f_rep");
        if (repeat === "custom" && !days.length) return toast("Выберите дни недели");
        const o = { title, at, repeat, days, prio: +val("f_pr"), cat: val("f_cat"), pre, fk: [], done: false };
        if (r) Object.assign(r, o); else S.reminders.push({ id: uid(), ...o });
        after();
        if ("Notification" in window && Notification.permission === "default") askNotify();
      };
      if (r) $("#f_del").onclick = () => { if (askDel()) { S.reminders = S.reminders.filter(x => x.id !== id); after(); } };
    });
}
function snoozeSheet(id) {
  const r = S.reminders.find(x => x.id === id); if (!r) return;
  sheet("Отложить", `<div class="grid2">${[[5, "на 5 минут"], [10, "на 10 минут"], [30, "на 30 минут"], [60, "на 1 час"]].map(([m, l]) => `<button class="btn sec" data-m="${m}">${l}</button>`).join("")}</div>`,
    w => $$("[data-m]", w).forEach(b => b.onclick = () => { r.at = Date.now() + (+b.dataset.m) * 60000; r.fk = []; r.done = false; after(); toast("Отложено"); }));
}

/* ---------- задача ---------- */
function taskForm(id, pref) {
  pref = pref || {};
  const t = id ? S.tasks.find(x => x.id === id) : null;
  const v = t || { title: pref.title || "", due: pref.due || todayKey(), prio: 2, cat: "life", project: "", repeat: "none" };
  const projects = [...new Set(S.tasks.map(x => x.project).filter(Boolean))];
  sheet(t ? "Задача" : "Новая задача", `
    <label>Задача</label><input id="f_t" value="${esc(v.title)}">
    <div class="grid2"><div><label>Срок</label><input id="f_due" type="date" value="${v.due || ""}"></div>
    <div><label>Приоритет</label><select id="f_pr">${opt({ 1: "Высокий", 2: "Средний", 3: "Низкий" }, v.prio)}</select></div></div>
    <div class="grid2"><div><label>Проект</label><input id="f_pj" list="f_pjl" value="${esc(v.project || "")}" placeholder="необязательно"><datalist id="f_pjl">${projects.map(p => `<option value="${esc(p)}">`).join("")}</datalist></div>
    <div><label>Категория</label><select id="f_cat">${catOpts(v.cat)}</select></div></div>
    <label>Повтор</label><select id="f_rep">${opt({ none: "Без повтора", daily: "Каждый день", weekly: "Каждую неделю", monthly: "Каждый месяц" }, v.repeat || "none")}</select>
    <div class="grid2"><button class="btn" id="f_ok">Сохранить</button>${t ? '<button class="btn bad" id="f_del">Удалить</button>' : "<span></span>"}</div>`,
    w => {
      $("#f_ok").onclick = () => {
        const title = val("f_t").trim(); if (!title) return toast("Введите задачу");
        const o = { title, due: val("f_due") || null, prio: +val("f_pr"), project: val("f_pj").trim(), cat: val("f_cat"), repeat: val("f_rep") };
        if (t) Object.assign(t, o); else S.tasks.push({ id: uid(), subs: [], done: false, ...o });
        after();
      };
      if (t) $("#f_del").onclick = () => { if (askDel()) { S.tasks = S.tasks.filter(x => x.id !== id); after(); } };
    });
}
function toggleTask(t) {
  t.done = !t.done; t.doneAt = t.done ? Date.now() : null;
  if (t.done && t.repeat && t.repeat !== "none") {
    const base = t.due ? pkey(t.due) : new Date();
    const n = new Date(base);
    if (t.repeat === "daily") n.setDate(n.getDate() + 1); else if (t.repeat === "weekly") n.setDate(n.getDate() + 7); else n.setMonth(n.getMonth() + 1);
    S.tasks.push({ ...t, id: uid(), done: false, doneAt: null, due: dkey(n), subs: (t.subs || []).map(s => ({ ...s, id: uid(), done: false })) });
    toast("Следующая: " + fmtDate(dkey(n)));
  }
}

/* ---------- событие календаря / расписание ---------- */
function eventForm(id, pref) {
  pref = pref || {};
  const e = id && id.startsWith("sch:") ? null : (id ? S.events.find(x => x.id === id) : null);
  const sc = id && id.startsWith("sch:") ? S.schedule.find(x => x.id === id.slice(4)) : null;
  const v = e || (sc ? { title: sc.title, date: todayKey(), start: sc.start, end: sc.end, place: sc.place, cat: sc.cat, kind: "weekly", dow: sc.day } : { title: "", date: pref.date || todayKey(), start: "", end: "", place: "", cat: "work", kind: pref.kind || "event", yearly: false, dow: new Date().getDay() });
  sheet(e || sc ? "Событие" : "Новое событие", `
    <label>Название</label><input id="f_t" value="${esc(v.title)}">
    <div class="grid2"><div><label>Тип</label><select id="f_k">${opt({ event: "Событие", birthday: "День рождения", important: "Важная дата", weekly: "Еженедельно (расписание)" }, v.kind)}</select></div>
    <div><label id="f_dl">${v.kind === "weekly" ? "День недели" : "Дата"}</label>
      <input id="f_d" type="date" value="${v.date}" class="${v.kind === "weekly" ? "hidden" : ""}">
      <select id="f_dow" class="${v.kind === "weekly" ? "" : "hidden"}">${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}" ${d === v.dow ? "selected" : ""}>${DAYS_FULL[d]}</option>`).join("")}</select></div></div>
    <div class="grid2"><div><label>Начало</label><input id="f_s" type="time" value="${v.start || ""}"></div><div><label>Конец</label><input id="f_e" type="time" value="${v.end || ""}"></div></div>
    <div class="grid2"><div><label>Место / ссылка</label><input id="f_pl" value="${esc(v.place || "")}"></div><div><label>Категория</label><select id="f_cat">${catOpts(v.cat)}</select></div></div>
    <label><input type="checkbox" id="f_y" ${v.yearly ? "checked" : ""}> повторять каждый год</label>
    <div class="grid2" style="margin-top:10px"><button class="btn" id="f_ok">Сохранить</button>${e || sc ? '<button class="btn bad" id="f_del">Удалить</button>' : "<span></span>"}</div>`,
    w => {
      $("#f_k").onchange = ev => { const wk = ev.target.value === "weekly"; $("#f_d").classList.toggle("hidden", wk); $("#f_dow").classList.toggle("hidden", !wk); $("#f_dl").textContent = wk ? "День недели" : "Дата"; if (ev.target.value === "birthday") $("#f_y").checked = true; };
      $("#f_ok").onclick = () => {
        const title = val("f_t").trim(), kind = val("f_k"), s = val("f_s"), en = val("f_e");
        if (!title) return toast("Введите название");
        if (s && en && en <= s) return toast("Проверьте время");
        if (kind === "weekly") {
          if (!s || !en) return toast("Укажите время начала и конца");
          const o = { day: +val("f_dow"), start: s, end: en, title, place: val("f_pl").trim(), cat: val("f_cat") };
          if (sc) Object.assign(sc, o); else { if (e) S.events = S.events.filter(x => x.id !== e.id); S.schedule.push({ id: uid(), ...o }); }
          if (sc) { /* оставляем */ }
        } else {
          const o = { title, kind, date: val("f_d") || todayKey(), start: s, end: en, place: val("f_pl").trim(), cat: val("f_cat"), yearly: $("#f_y").checked || kind === "birthday" };
          if (sc) S.schedule = S.schedule.filter(x => x.id !== sc.id);
          if (e) Object.assign(e, o); else S.events.push({ id: uid(), ...o });
        }
        after();
      };
      if (e || sc) $("#f_del").onclick = () => { if (askDel()) { if (e) S.events = S.events.filter(x => x.id !== e.id); if (sc) S.schedule = S.schedule.filter(x => x.id !== sc.id); after(); } };
    });
}
function openItem(it) {
  if (it.src === "ev") eventForm(it.ref);
  else if (it.src === "sch") eventForm("sch:" + it.ref);
  else if (it.src === "rem") remForm(it.ref);
  else if (it.src === "task") taskForm(it.ref);
}

/* ---------- привычка ---------- */
function habitForm(id) {
  const h = id ? S.habits.find(x => x.id === id) : null;
  const v = h || { name: "", icon: "✅", color: "#5fae8a", goal: { type: "daily", n: 1 }, remind: "" };
  let curIcon = v.icon;
  sheet(h ? "Привычка" : "Новая привычка", `
    <label>Название</label><input id="f_t" value="${esc(v.name)}" placeholder="Например: читать 20 минут">
    <label>Значок</label><div class="row"><button type="button" class="icbtn" id="f_icb" aria-label="Выбрать значок">${uic(v.icon, 32)}</button><div class="meta grow">Нажмите, чтобы выбрать значок, эмодзи или загрузить свою картинку</div></div>
    <div class="grid2"><div><label>Цель</label><select id="f_g">${opt({ daily: "Каждый день", week: "Несколько раз в неделю" }, v.goal.type)}</select></div>
    <div><label>Раз в неделю</label><input id="f_n" type="number" min="1" max="7" value="${v.goal.n || 3}"></div></div>
    <div class="grid2"><div><label>Напомнить в</label><input id="f_r" type="time" value="${v.remind || ""}"></div><div><label>Цвет</label><input id="f_c" type="color" value="${v.color}" style="padding:2px;height:42px"></div></div>
    <div class="grid2"><button class="btn" id="f_ok">Сохранить</button>${h ? '<button class="btn bad" id="f_del">Удалить</button>' : "<span></span>"}</div>`,
    w => {
      $("#f_icb").onclick = () => openIconPicker(curIcon, nv => { if (nv) { curIcon = nv; $("#f_icb").innerHTML = uic(nv, 32); } });
      $("#f_ok").onclick = () => {
        const name = val("f_t").trim(); if (!name) return toast("Введите название");
        const type = val("f_g");
        const o = { name, icon: curIcon || "✅", color: val("f_c"), goal: { type, n: type === "week" ? Math.max(1, Math.min(7, +val("f_n") || 3)) : 1 }, remind: val("f_r") };
        if (h) Object.assign(h, o); else S.habits.push({ id: uid(), log: {}, ...o });
        after();
      };
      if (h) $("#f_del").onclick = () => { if (confirm("Удалить привычку и её историю?")) { S.habits = S.habits.filter(x => x.id !== id); after(); } };
    });
}
