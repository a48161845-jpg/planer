"use strict";
/* ============ ЕЩЁ: плитки ============ */
const GROUPS = [
  ["Планирование", [["reminders", "bell", "Напоминания", "#5b8def"], ["bdays", "cake", "Дни рождения", "#d1a85b"], ["counts", "hourglass", "Обратный отсчёт", "#4fb3a9"], ["goals", "target", "Цели", "#e0725f"]]],
  ["Записи", [["notes", "note", "Заметки и чек-листы", "#8b7bd8"], ["shop", "cart", "Списки покупок", "#4fb3a9"], ["diary", "book", "Дневник", "#d1a85b"], ["vault", "lock", "Сейф", "#6b7a99"]]],
  ["Здоровье и финансы", [["fin", "wallet", "Финансы", "#4caf7d"], ["water", "drop", "Вода", "#5b8def"], ["tools", "timer", "Таймеры и Pomodoro", "#e0725f"], ["stats", "chart", "Статистика", "#8b7bd8"]]],
  ["Система", [["ai", "sparkles", "Помощник", "#8b7bd8"], ["bot", "user", "Аккаунт и бот", "#5b8def"], ["settings", "gear", "Настройки", "#6b7a99"]]]
];
Object.assign(SCR_TITLES, { reminders: "Напоминания", notes: "Заметки и списки", fin: "Финансы", tools: "Таймеры", bdays: "Дни рождения", water: "Вода", goals: "Цели", stats: "Статистика", diary: "Дневник", vault: "Сейф", counts: "Обратный отсчёт", ai: "Помощник", bot: "Аккаунт и бот", settings: "Настройки", set_look: "Оформление", set_sec: "Уведомления и защита", set_loc: "Погода и деньги", set_cats: "Категории", set_data: "Данные" });
TABVIEWS.more = function (v) {
  v.innerHTML = GROUPS.map(([g, items]) => `<h2>${g}</h2><div class="group">${items.map(([id, i, l, c]) => `<div class="card li navrow" data-s="${id}">${secTile(id, c, 38)}<div class="grow title">${l}</div><span class="chev">${ic("chevron", 18)}</span></div>`).join("")}</div>`).join("");
  $$("[data-s]", v).forEach(t => t.onclick = () => { if (t.dataset.s === "shop") { NF = "shop"; go("more", "notes"); } else if (t.dataset.s === "fin") go("fin"); else go("more", t.dataset.s); });
};
$("#hBack").onclick = () => go("more");
const dl = (name, mime, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click(); };
const prompt2 = (title, fields, ok) => sheet(title, fields.map(f => `<label>${f.l}</label><input id="p_${f.id}" type="${f.t || "text"}" value="${esc(f.v || "")}" ${f.p ? `placeholder="${esc(f.p)}"` : ""}>`).join("") + '<button class="btn full" id="p_ok">Сохранить</button>', w => { $("#p_ok").onclick = () => { const r = {}; fields.forEach(f => { r[f.id] = val("p_" + f.id); }); if (ok(r) !== false) { closeSheet(); render(); } }; });

/* ============ напоминания ============ */
let RF = "act";
SCREENS.reminders = function (v) {
  const act = S.reminders.filter(r => !r.done).sort((a, b) => a.at - b.at);
  const hist = S.reminders.filter(r => r.done).sort((a, b) => (b.doneAt || b.at) - (a.doneAt || a.at)).slice(0, 40);
  v.innerHTML = `<div class="grid2" style="margin-bottom:10px"><button class="btn" id="rAdd">+ Напоминание</button><button class="btn sec" id="rMic">🎤 Голосом</button></div>
    <div class="meta" style="margin:0 2px 10px">Пример: «Напомни завтра в 16:00 сделать домашнее задание»</div>
    <div class="chips"><span class="chip ${RF === "act" ? "active" : ""}" data-f="act">Активные (${act.length})</span><span class="chip ${RF === "his" ? "active" : ""}" data-f="his">История (${hist.length})</span></div>
    ${RF === "act" ? (act.length ? act.map(remRow).join("") : '<div class="empty">Нет активных напоминаний</div>') : (hist.length ? hist.map(remRow).join("") : '<div class="empty">История пуста</div>')}`;
  $("#rAdd").onclick = () => remForm();
  $("#rMic").onclick = () => voiceInput(t => { const p = parseNL(t); if (p.found) { S.reminders.push({ id: uid(), title: p.title || t, at: p.at, repeat: p.repeat, days: [], prio: 2, cat: "life", pre: [0], fk: [], done: false }); save(); toast("Создано: " + fmtDT(p.at)); render(); } else remForm(null, { title: p.title || t }); });
  $$("[data-f]", v).forEach(c => c.onclick = () => { RF = c.dataset.f; render(); });
  bindRem(v);
};

/* ============ заметки / чек-листы / покупки ============ */
let NF = "all", NTAG = "", NQ = "";
const NICON = { note: "note", check: "tasks", shop: "cart" };
function resizeImg(file, cb) {
  const fr = new FileReader();
  fr.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 800 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = im.width * k; c.height = im.height * k; c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL("image/jpeg", .7)); }; im.src = fr.result; };
  fr.readAsDataURL(file);
}
function noteForm(id, type0) {
  const n = id ? S.notes.find(x => x.id === id) : null;
  const v = n || { type: type0 || "note", title: "", text: "", items: [], tags: [], pin: false, img: null };
  let img = v.img;
  const body = () => v.type === "note" ? v.text : (v.items || []).map(i => i.t).join("\n");
  sheet(n ? "Запись" : "Новая запись", `
    <div class="grid2"><div><label>Тип</label><select id="f_ty">${opt({ note: "Заметка", check: "Чек-лист", shop: "Список покупок" }, v.type)}</select></div><div><label>Теги (через запятую)</label><input id="f_tg" value="${esc((v.tags || []).join(", "))}"></div></div>
    <label>Заголовок</label><input id="f_t" value="${esc(v.title)}">
    <label id="f_bl">${v.type === "note" ? "Текст" : "Пункты (по одному в строке)"}</label><textarea id="f_b" rows="6">${esc(body())}</textarea>
    <div class="row" style="margin-bottom:8px"><input id="f_img" type="file" accept="image/*" style="margin:0"><button class="btn bad sm ${img ? "" : "hidden"}" id="f_ri">Убрать фото</button></div>
    <img id="f_pv" class="thumb ${img ? "" : "hidden"}" src="${img || ""}" alt="">
    <label style="margin-top:8px"><input type="checkbox" id="f_pin" ${v.pin ? "checked" : ""}> закрепить</label>
    <div class="grid2" style="margin-top:8px"><button class="btn" id="f_ok">Сохранить</button>${n ? '<button class="btn bad" id="f_del">Удалить</button>' : "<span></span>"}</div>`,
    w => {
      $("#f_ty").onchange = e => { $("#f_bl").textContent = e.target.value === "note" ? "Текст" : "Пункты (по одному в строке)"; };
      $("#f_img").onchange = e => { const f = e.target.files[0]; if (f) resizeImg(f, d => { img = d; $("#f_pv").src = d; $("#f_pv").classList.remove("hidden"); $("#f_ri").classList.remove("hidden"); }); };
      $("#f_ri").onclick = () => { img = null; $("#f_pv").classList.add("hidden"); $("#f_ri").classList.add("hidden"); };
      $("#f_ok").onclick = () => {
        const type = val("f_ty"), title = val("f_t").trim(), b = val("f_b").trim();
        if (!title && !b) return toast("Пусто");
        const o = { type, title, tags: val("f_tg").split(",").map(s => s.trim().replace(/^#/, "")).filter(Boolean), pin: $("#f_pin").checked, img };
        if (type === "note") { o.text = b; o.items = []; }
        else { const old = Object.fromEntries((v.items || []).map(i => [i.t, i.done])); o.items = b.split("\n").map(s => s.trim()).filter(Boolean).map(t => ({ t, done: !!old[t] })); o.text = ""; }
        if (n) Object.assign(n, o); else S.notes.push({ id: uid(), ts: Date.now(), ...o });
        after();
      };
      if (n) $("#f_del").onclick = () => { if (askDel()) { S.notes = S.notes.filter(x => x.id !== id); after(); } };
    });
}
SCREENS.notes = function (v) {
  const tags = [...new Set(S.notes.flatMap(n => n.tags || []))];
  let list = S.notes.filter(n => (NF === "all" || n.type === NF) && (!NTAG || (n.tags || []).includes(NTAG)));
  const q = NQ.toLowerCase();
  if (q) list = list.filter(n => (n.title + " " + n.text + " " + (n.items || []).map(i => i.t).join(" ")).toLowerCase().includes(q));
  list.sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.ts - a.ts);
  v.innerHTML = `<div class="chips">${[["all", "Все"], ["note", "Заметки"], ["check", "Чек-листы"], ["shop", "Покупки"]].map(([k, l]) => `<span class="chip ${NF === k ? "active" : ""}" data-nf="${k}">${l}</span>`).join("")}</div>
    ${tags.length ? `<div class="chips">${tags.map(t => `<span class="chip ${NTAG === t ? "active" : ""}" data-tag="${esc(t)}">#${esc(t)}</span>`).join("")}</div>` : ""}
    <input id="nq" placeholder="Поиск по заметкам" value="${esc(NQ)}">
    ${list.length ? list.map(n => {
      const it = n.items || [], dn = it.filter(i => i.done).length;
      return `<div class="card" data-id="${n.id}"><div class="row"><div class="grow title"><span class="kind">${ic(n.pin ? "pin" : NICON[n.type] || "note", 16)}</span>${esc(n.title || "Без названия")}</div><button class="ibtn sm" data-a="share" aria-label="Поделиться">${ic("share", 16)}</button><button class="ibtn sm" data-a="edit" aria-label="Изменить">${ic("edit", 16)}</button></div>
      ${n.type === "note" ? `<div class="pre" style="margin-top:6px">${esc(n.text)}</div>` : `${it.length ? `<div class="bar"><i style="width:${Math.round(dn / it.length * 100)}%"></i></div>` : ""}${it.map((i, ix) => `<div class="row" style="margin:6px 0" data-ix="${ix}"><div class="chk ${i.done ? "done" : ""}" data-a="tick"></div><div class="grow ${i.done ? "done-t" : ""}">${esc(i.t)}</div></div>`).join("")}`}
      ${n.img ? `<img class="thumb" src="${n.img}" alt="">` : ""}
      <div class="meta" style="margin-top:6px">${(n.tags || []).map(t => "#" + esc(t)).join(" ")} ${fmtDT(n.ts)}</div></div>`;
    }).join("") : '<div class="empty">Ничего нет</div>'}`;
  $$("[data-nf]", v).forEach(c => c.onclick = () => { NF = c.dataset.nf; render(); });
  $$("[data-tag]", v).forEach(c => c.onclick = () => { NTAG = NTAG === c.dataset.tag ? "" : c.dataset.tag; render(); });
  $("#nq").oninput = e => { NQ = e.target.value; const pos = e.target.selectionStart; render(); const i = $("#nq"); i.focus(); i.setSelectionRange(pos, pos); };
  $$("[data-a]", v).forEach(b => b.onclick = () => {
    const card = b.closest("[data-id]"), n = S.notes.find(x => x.id === card.dataset.id); if (!n) return;
    const a = b.dataset.a;
    if (a === "edit") return noteForm(n.id);
    if (a === "share") return shareText((n.title ? n.title + "\n" : "") + (n.type === "note" ? n.text : n.items.map(i => (i.done ? "✓ " : "• ") + i.t).join("\n")));
    if (a === "tick") { const i = n.items[+b.closest("[data-ix]").dataset.ix]; i.done = !i.done; save(); render(); }
  });
  fab(() => noteForm(null, NF === "all" ? "note" : NF));
};

/* ============ финансы ============ */
const FM = { y: new Date().getFullYear(), m: new Date().getMonth() };
function txForm() {
  let type = "out";
  sheet("Операция", `<div class="chips" id="x_ty"><span class="chip active" data-t="out">Расход</span><span class="chip" data-t="in">Доход</span></div>
    <label>Сумма</label><input id="x_a" type="number" inputmode="decimal" min="0" placeholder="0">
    <label>Категория</label><select id="x_c">${FCATS_OUT.map(c => `<option>${c}</option>`).join("")}</select>
    <label>Заметка</label><input id="x_n"><label>Дата</label><input id="x_d" type="date" value="${todayKey()}">
    <button class="btn full" id="x_ok">Добавить</button>`,
    w => {
      $$("#x_ty .chip", w).forEach(c => c.onclick = () => { type = c.dataset.t; $$("#x_ty .chip", w).forEach(x => x.classList.toggle("active", x === c)); $("#x_c").innerHTML = (type === "out" ? FCATS_OUT : FCATS_IN).map(x => `<option>${x}</option>`).join(""); });
      $("#x_ok").onclick = () => {
        const amt = +val("x_a"); if (!(amt > 0)) return toast("Введите сумму");
        const d = pkey(val("x_d") || todayKey()); const now = new Date(); d.setHours(now.getHours(), now.getMinutes());
        S.tx.push({ id: uid(), type, amt, cat: val("x_c"), note: val("x_n").trim(), ts: d.getTime() }); after();
      };
    });
}
SCREENS.fin = function (v) {
  const tx = monthTx(FM.y, FM.m).sort((a, b) => b.ts - a.ts);
  const inc = tx.filter(t => t.type === "in").reduce((a, t) => a + t.amt, 0), out = tx.filter(t => t.type === "out").reduce((a, t) => a + t.amt, 0);
  const byCat = {}; tx.filter(t => t.type === "out").forEach(t => { byCat[t.cat] = (byCat[t.cat] || 0) + t.amt; });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]), mx = cats.length ? cats[0][1] : 1;
  const bp = S.budget > 0 ? Math.min(100, Math.round(out / S.budget * 100)) : 0;
  const saved = S.fgoals.reduce((a, g) => a + g.saved, 0);
  v.innerHTML = `<div class="row" style="margin-bottom:8px"><button class="btn sec sm" data-n="-1">${ic("back", 16)}</button><div class="grow title" style="text-align:center">${MONTHS_N[FM.m]} ${FM.y}</div><button class="btn sec sm" data-n="1">${ic("chevron", 16)}</button></div>
    <div class="stats"><div class="stat"><b style="color:var(--ok)">${money(inc)}</b><span>доходы</span></div><div class="stat"><b style="color:var(--bad)">${money(out)}</b><span>расходы</span></div><div class="stat"><b>${money(inc - out)}</b><span>баланс</span></div></div>
    <h2>Бюджет на месяц <a id="bSet">Изменить</a></h2>
    <div class="card">${S.budget > 0 ? `<div class="row"><div class="grow">Потрачено ${money(out)} из ${money(S.budget)}</div><b>${bp}%</b></div><div class="bar ${out > S.budget ? "bad" : ""}"><i style="width:${bp}%"></i></div><div class="meta" style="margin-top:6px">${out > S.budget ? "Превышение: " + money(out - S.budget) : "Осталось: " + money(S.budget - out)}</div>` : '<div class="meta">Бюджет не задан</div>'}</div>
    <h2>Расходы по категориям</h2>
    ${cats.length ? `<div class="card">${cats.map(([c, a]) => `<div style="margin:6px 0"><div class="row"><div class="grow">${esc(c)}</div><span class="meta">${money(a)} · ${Math.round(a / out * 100)}%</span></div><div class="bar"><i style="width:${Math.round(a / mx * 100)}%"></i></div></div>`).join("")}</div>` : '<div class="empty">Нет расходов</div>'}
    <h2>Накопления и цели <a id="gAdd">+ Цель</a></h2>
    ${S.fgoals.length ? S.fgoals.map(g => { const p = Math.min(100, Math.round(g.saved / g.target * 100)); return `<div class="card" data-gid="${g.id}"><div class="row"><div class="grow title">${esc(g.name)}</div><button class="btn sec sm" data-a="top">+ Пополнить</button><button class="btn bad sm" data-a="del">${ic("x", 14)}</button></div><div class="meta">${money(g.saved)} из ${money(g.target)} · ${p}%</div><div class="bar ${p >= 100 ? "ok" : ""}"><i style="width:${p}%"></i></div></div>`; }).join("") + `<div class="meta" style="margin:0 2px">Всего накоплено: ${money(saved)}</div>` : '<div class="empty">Добавьте цель накоплений</div>'}
    <h2>История операций</h2>
    ${tx.length ? tx.slice(0, 60).map(t => `<div class="card li row" data-tid="${t.id}"><div class="grow"><div class="title">${esc(t.cat)}${t.note ? " · " + esc(t.note) : ""}</div><div class="meta">${fmtDT(t.ts)}</div></div><b style="color:var(--${t.type === "in" ? "ok" : "bad"})">${t.type === "in" ? "+" : "−"}${money(t.amt)}</b><button class="btn bad sm" data-a="dtx">${ic("x", 14)}</button></div>`).join("") : '<div class="empty">Операций нет</div>'}`;
  $$("[data-n]", v).forEach(b => b.onclick = () => { FM.m += +b.dataset.n; if (FM.m < 0) { FM.m = 11; FM.y--; } if (FM.m > 11) { FM.m = 0; FM.y++; } render(); });
  $("#bSet").onclick = () => prompt2("Бюджет на месяц", [{ id: "b", l: "Сумма", t: "number", v: S.budget || "" }], r => { S.budget = Math.max(0, +r.b || 0); save(); });
  $("#gAdd").onclick = () => prompt2("Цель накоплений", [{ id: "n", l: "Название", p: "Например: ноутбук" }, { id: "t", l: "Нужная сумма", t: "number" }], r => { if (!r.n.trim() || !(+r.t > 0)) { toast("Заполните поля"); return false; } S.fgoals.push({ id: uid(), name: r.n.trim(), target: +r.t, saved: 0 }); save(); });
  $$("[data-a]", v).forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === "dtx") { if (askDel()) { S.tx = S.tx.filter(x => x.id !== b.closest("[data-tid]").dataset.tid); save(); render(); } return; }
    const g = S.fgoals.find(x => x.id === b.closest("[data-gid]").dataset.gid);
    if (a === "del") { if (askDel()) { S.fgoals = S.fgoals.filter(x => x !== g); save(); render(); } }
    else prompt2("Пополнить: " + g.name, [{ id: "a", l: "Сумма", t: "number" }], r => { const x = +r.a; if (!x) return false; g.saved = Math.max(0, g.saved + x); save(); });
  });
  fab(txForm);
};

/* ============ таймеры / секундомер / Pomodoro ============ */
let TT = "timers";
const tLeft = t => t.running ? Math.max(0, (t.end - Date.now()) / 1000) : t.left;
const swMs = () => S.sw.acc + (S.sw.running ? Date.now() - S.sw.start : 0);
const fmtSw = ms => { const t = Math.floor(ms / 10), cs = t % 100, s = Math.floor(t / 100) % 60, m = Math.floor(t / 6000); return `${pad(m)}:${pad(s)}.${pad(cs)}`; };
function pomoLeft() { const p = S.pomo; return p.running ? Math.max(0, (p.end - Date.now()) / 1000) : (p.left || S.settings.pomo.work * 60); }
SCREENS.tools = function (v) {
  v.innerHTML = `<div class="chips">${[["timers", "Таймеры"], ["sw", "Секундомер"], ["pomo", "Pomodoro"]].map(([k, l]) => `<span class="chip ${TT === k ? "active" : ""}" data-t="${k}">${l}</span>`).join("")}</div><div id="tb"></div>`;
  $$("[data-t]", v).forEach(c => c.onclick = () => { TT = c.dataset.t; render(); });
  const tb = $("#tb");
  if (TT === "timers") {
    tb.innerHTML = `<div class="card"><label>Название</label><input id="tName" placeholder="Например: чай, перерыв">
      <div class="grid2"><div><label>Минуты</label><input id="tMin" type="number" inputmode="numeric" min="0" value="10"></div><div><label>Секунды</label><input id="tSec" type="number" inputmode="numeric" min="0" max="59" value="0"></div></div>
      <div class="chips">${[1, 5, 10, 15, 25, 45].map(m => `<span class="chip" data-q="${m}">${m} мин</span>`).join("")}</div><button class="btn full" id="tAdd">Запустить</button></div><div id="tList"></div>`;
    $$("[data-q]", tb).forEach(c => c.onclick = () => { $("#tMin").value = c.dataset.q; $("#tSec").value = 0; });
    $("#tAdd").onclick = () => { const total = (+val("tMin") || 0) * 60 + (+val("tSec") || 0); if (total <= 0) return toast("Укажите время"); S.timers.push({ id: uid(), name: val("tName").trim() || "Таймер", total, left: total, running: true, end: Date.now() + total * 1000 }); save(false); render(); };
  } else if (TT === "sw") {
    tb.innerHTML = `<div class="card"><div class="big" id="swClk">${fmtSw(swMs())}</div><div class="row" style="justify-content:center"><button class="btn" id="swGo">${S.sw.running ? "Пауза" : "Старт"}</button><button class="btn sec" id="swLap">Круг</button><button class="btn bad" id="swRs">Сброс</button></div></div>
      ${S.sw.laps.map((l, i) => `<div class="card li row"><div class="grow">Круг ${S.sw.laps.length - i}</div><b>${fmtSw(l)}</b></div>`).join("")}`;
    $("#swGo").onclick = () => { if (S.sw.running) { S.sw.acc = swMs(); S.sw.running = false; } else { S.sw.start = Date.now(); S.sw.running = true; } save(false); render(); };
    $("#swLap").onclick = () => { if (!S.sw.running) return; S.sw.laps.unshift(swMs()); save(false); render(); };
    $("#swRs").onclick = () => { S.sw = { running: false, start: 0, acc: 0, laps: [] }; save(false); render(); };
  } else {
    const p = S.pomo, today = S.pomoLog.filter(ts => dkey(new Date(ts)) === todayKey()).length;
    tb.innerHTML = `<div class="card"><div class="meta" style="text-align:center">${p.mode === "work" ? "Фокус" : "Перерыв"} · сегодня сессий: ${today}</div><div class="big" id="pmClk">${fmtDur(pomoLeft())}</div>
      <div class="row" style="justify-content:center"><button class="btn" id="pmGo">${p.running ? "Пауза" : "Старт"}</button><button class="btn sec" id="pmSkip">Пропустить</button><button class="btn bad" id="pmRs">Сброс</button></div></div>
      <div class="card"><div class="grid2"><div><label>Фокус, мин</label><input id="pmW" type="number" min="1" value="${S.settings.pomo.work}"></div><div><label>Перерыв, мин</label><input id="pmB" type="number" min="1" value="${S.settings.pomo.brk}"></div></div></div>`;
    const setLeft = () => { S.pomo.left = (S.pomo.mode === "work" ? S.settings.pomo.work : S.settings.pomo.brk) * 60; };
    $("#pmGo").onclick = () => { if (p.running) { p.left = pomoLeft(); p.running = false; } else { p.end = Date.now() + pomoLeft() * 1000; p.running = true; } save(false); render(); };
    $("#pmSkip").onclick = () => { p.mode = p.mode === "work" ? "brk" : "work"; p.running = false; setLeft(); save(false); render(); };
    $("#pmRs").onclick = () => { p.running = false; setLeft(); save(false); render(); };
    const chg = () => { S.settings.pomo.work = Math.max(1, +val("pmW") || 25); S.settings.pomo.brk = Math.max(1, +val("pmB") || 5); if (!p.running) setLeft(); save(false); };
    $("#pmW").onchange = chg; $("#pmB").onchange = chg;
  }
  toolsTick(true);
};
function toolsTick(force) {
  if (R.screen !== "tools") return;
  if (TT === "timers") {
    const el = $("#tList"); if (!el) return;
    if (!S.timers.length) { el.innerHTML = '<div class="empty">Нет таймеров</div>'; return; }
    const sig = S.timers.map(t => t.id + t.running).join();
    if (force || el.dataset.sig !== sig) {
      el.dataset.sig = sig;
      el.innerHTML = S.timers.map(t => `<div class="card" data-tid="${t.id}"><div class="row"><div class="grow title">${esc(t.name)}</div><span class="meta">${fmtDur(t.total)}</span></div><div class="big" data-clock></div><div class="bar"><i data-bar></i></div>
        <div class="row" style="margin-top:10px;justify-content:center"><button class="btn sm" data-ta="toggle">${t.running ? "Пауза" : (t.left <= 0 ? "Заново" : "Старт")}</button><button class="btn sec sm" data-ta="reset">Сброс</button><button class="btn bad sm" data-ta="del">Удалить</button></div></div>`).join("");
      $$("[data-ta]", el).forEach(b => b.onclick = () => {
        const id = b.closest("[data-tid]").dataset.tid, i = S.timers.findIndex(x => x.id === id), t = S.timers[i];
        if (b.dataset.ta === "del") S.timers.splice(i, 1);
        else if (b.dataset.ta === "reset") { t.running = false; t.left = t.total; }
        else if (t.running) { t.left = tLeft(t); t.running = false; }
        else { if (t.left <= 0) t.left = t.total; t.end = Date.now() + t.left * 1000; t.running = true; }
        save(false); toolsTick(true);
      });
    }
    $$("[data-tid]", el).forEach(c => { const t = S.timers.find(x => x.id === c.dataset.tid); if (!t) return; c.querySelector("[data-clock]").textContent = fmtDur(tLeft(t)); c.querySelector("[data-bar]").style.width = (t.total ? (1 - tLeft(t) / t.total) * 100 : 100) + "%"; });
  } else if (TT === "sw") { const c = $("#swClk"); if (c) c.textContent = fmtSw(swMs()); }
  else { const c = $("#pmClk"); if (c) c.textContent = fmtDur(pomoLeft()); }
}

/* ============ дни рождения ============ */
SCREENS.bdays = function (v) {
  const now = new Date(), t0 = pkey(todayKey());
  const list = S.events.filter(e => e.kind === "birthday").map(e => {
    const d = pkey(e.date); let nx = new Date(now.getFullYear(), d.getMonth(), d.getDate()); if (nx < t0) nx = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
    const hasYear = d.getFullYear() > 1900 && d.getFullYear() < now.getFullYear();
    return { e, days: Math.round((nx - t0) / 86400e3), age: hasYear ? nx.getFullYear() - d.getFullYear() : null, nx };
  }).sort((a, b) => a.days - b.days);
  v.innerHTML = `<div class="meta" style="margin:0 2px 10px">Уведомление приходит в 9:00 в день рождения. Чтобы считался возраст, укажите год рождения.</div>
    ${list.length ? list.map(x => `<div class="card li row" data-id="${x.e.id}"><div class="grow"><div class="title"><span class="kind">${ic("cake", 15)}</span>${esc(x.e.title)}</div><div class="meta">${fmtDate(dkey(x.nx))}${x.age ? ` · исполнится ${x.age}` : ""}</div></div><b>${x.days === 0 ? "сегодня" : x.days + " дн."}</b></div>`).join("") : '<div class="empty">Нет дней рождения</div>'}`;
  $$("[data-id]", v).forEach(c => c.onclick = () => eventForm(c.dataset.id));
  fab(() => eventForm(null, { kind: "birthday" }));
};

/* ============ вода ============ */
SCREENS.water = function (v) {
  const k = todayKey(), ml = waterOn(k), g = S.settings.waterGoal, pct = Math.min(100, Math.round(ml / g * 100));
  const days = Array.from({ length: 7 }, (_, i) => dkey(addDays(new Date(), i - 6))), vals = days.map(waterOn), mx = Math.max(g, ...vals);
  v.innerHTML = `<div class="card hero"><div class="ring" style="--p:${pct}"><i>${pct}%</i></div><div class="grow"><div class="title" style="font-size:20px">${ml} мл</div><div class="meta">цель ${g} мл</div></div><button class="btn sec sm" id="wG">Цель</button></div>
    <div class="grid3" style="margin-bottom:10px">${[150, 250, 500].map(a => `<button class="btn" data-ml="${a}">+${a}</button>`).join("")}</div>
    <div class="grid2"><button class="btn sec" id="wC">Свой объём</button><button class="btn bad" id="wU">Отменить последнее</button></div>
    <h2>7 дней</h2><div class="cols">${vals.map(x => `<div style="height:${Math.max(2, Math.round(x / mx * 100))}%"></div>`).join("")}</div>
    <div class="cols lbl">${days.map(d => `<span>${DAYS[pkey(d).getDay()]}</span>`).join("")}</div>`;
  const add = a => { S.water.push({ id: uid(), ts: Date.now(), ml: a }); save(); render(); };
  $$("[data-ml]", v).forEach(b => b.onclick = () => add(+b.dataset.ml));
  $("#wC").onclick = () => prompt2("Объём, мл", [{ id: "a", l: "Миллилитры", t: "number" }], r => { if (!(+r.a > 0)) return false; add(+r.a); return false; });
  $("#wU").onclick = () => { const l = S.water.filter(w => dkey(new Date(w.ts)) === k).pop(); if (l) { S.water = S.water.filter(w => w !== l); save(); render(); } };
  $("#wG").onclick = () => prompt2("Дневная цель, мл", [{ id: "g", l: "Миллилитры", t: "number", v: g }], r => { S.settings.waterGoal = Math.max(500, +r.g || 2000); save(false); });
};

/* ============ цели ============ */
SCREENS.goals = function (v) {
  v.innerHTML = `${S.goals.length ? S.goals.map(g => { const dn = g.steps.filter(s => s.done).length, p = g.steps.length ? Math.round(dn / g.steps.length * 100) : 0; return `<div class="card" data-gid="${g.id}"><div class="row"><div class="grow title"><span class="kind">${ic("target", 16)}</span>${esc(g.name)}</div><b>${p}%</b><button class="btn bad sm" data-a="del">${ic("x", 14)}</button></div><div class="bar ${p === 100 ? "ok" : ""}"><i style="width:${p}%"></i></div>
      ${g.steps.map(s => `<div class="row" style="margin:6px 0" data-sid="${s.id}"><div class="chk ${s.done ? "done" : ""}" data-a="tick"></div><div class="grow ${s.done ? "done-t" : ""}">${esc(s.t)}</div><button class="btn bad sm" data-a="sdel">${ic("x", 14)}</button></div>`).join("")}
      <div class="row"><input data-in placeholder="Новый этап" style="margin:0"><button class="btn sec" data-a="sadd">+</button></div></div>`; }).join("") : '<div class="empty">Добавьте большую цель и разбейте её на этапы</div>'}`;
  $$("[data-a]", v).forEach(b => b.onclick = () => {
    const g = S.goals.find(x => x.id === b.closest("[data-gid]").dataset.gid), a = b.dataset.a, sid = b.closest("[data-sid]") && b.closest("[data-sid]").dataset.sid;
    if (a === "del") { if (!askDel()) return; S.goals = S.goals.filter(x => x !== g); }
    else if (a === "tick") { const s = g.steps.find(x => x.id === sid); s.done = !s.done; }
    else if (a === "sdel") g.steps = g.steps.filter(x => x.id !== sid);
    else if (a === "sadd") { const t = $("[data-in]", b.closest("[data-gid]")).value.trim(); if (!t) return; g.steps.push({ id: uid(), t, done: false }); }
    save(false); render();
  });
  fab(() => prompt2("Новая цель", [{ id: "n", l: "Название", p: "Например: сдать экзамен" }], r => { if (!r.n.trim()) return false; S.goals.push({ id: uid(), name: r.n.trim(), steps: [] }); save(false); }));
};

/* ============ статистика ============ */
SCREENS.stats = function (v) {
  const days = Array.from({ length: 7 }, (_, i) => dkey(addDays(new Date(), i - 6)));
  const tasks = days.map(k => S.tasks.filter(t => t.done && t.doneAt && dkey(new Date(t.doneAt)) === k).length);
  const habs = days.map(k => S.habits.filter(h => h.log[k]).length);
  const spend = days.map(k => S.tx.filter(t => t.type === "out" && dkey(new Date(t.ts)) === k).reduce((a, t) => a + t.amt, 0));
  const ws = weekSummary();
  const chart = (title, arr, fmt) => { const mx = Math.max(1, ...arr); return `<h2>${title}</h2><div class="card"><div class="cols">${arr.map(x => `<div style="height:${Math.max(2, Math.round(x / mx * 100))}%" title="${fmt(x)}"></div>`).join("")}</div><div class="cols lbl">${days.map(d => `<span>${DAYS[pkey(d).getDay()]}</span>`).join("")}</div><div class="cols lbl">${arr.map(x => `<span>${fmt(x)}</span>`).join("")}</div></div>`; };
  v.innerHTML = `<div class="card">${ws.lines.length ? ws.lines.map(l => `<div style="margin:4px 0">• ${esc(l)}</div>`).join("") : '<div class="meta">Пока мало данных</div>'}</div>
    ${chart("Выполнено задач", tasks, x => x)}${chart("Выполнено привычек", habs, x => x)}${chart("Расходы", spend, x => x ? Math.round(x) : "–")}`;
};

/* ============ дневник ============ */
let DD = todayKey();
SCREENS.diary = function (v) {
  const past = Object.keys(S.diary).filter(k => S.diary[k] && k !== DD).sort().reverse().slice(0, 30);
  v.innerHTML = `<div class="card"><label>Дата</label><input id="dDate" type="date" value="${DD}"><label>Как прошёл день</label><textarea id="dTxt" rows="8" placeholder="Записи сохраняются автоматически">${esc(S.diary[DD] || "")}</textarea></div>
    ${past.length ? `<h2>Прошлые записи</h2>${past.map(k => `<div class="card" data-k="${k}"><div class="title">${fmtDate(k)}</div><div class="meta pre">${esc(S.diary[k].slice(0, 140))}${S.diary[k].length > 140 ? "…" : ""}</div></div>`).join("")}` : ""}`;
  $("#dDate").onchange = e => { DD = e.target.value || todayKey(); render(); };
  let t; $("#dTxt").oninput = e => { clearTimeout(t); t = setTimeout(() => { if (e.target.value.trim()) S.diary[DD] = e.target.value; else delete S.diary[DD]; save(false); }, 500); };
  $$("[data-k]", v).forEach(c => c.onclick = () => { DD = c.dataset.k; render(); });
};

/* ============ сейф (шифрование пароля в браузере, AES-GCM) ============ */
let VK = null, VITEMS = [];
async function vKey(pass, salt) { const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]); return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, k, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]); }
async function vSave() { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, VK, new TextEncoder().encode(JSON.stringify(VITEMS))); S.vault.iv = b64u(iv); S.vault.d = b64u(new Uint8Array(ct)); save(false); }
SCREENS.vault = function (v) {
  if (!window.crypto || !crypto.subtle) { v.innerHTML = '<div class="empty">Шифрование недоступно: нужен защищённый адрес (https)</div>'; return; }
  if (!S.vault) {
    v.innerHTML = `<div class="card"><div class="title">Создайте сейф</div><div class="meta" style="margin:4px 0 10px">Записи шифруются паролем прямо на устройстве. Если пароль забыть, восстановить записи нельзя.</div>
      <input id="vp1" type="password" placeholder="Пароль (от 6 символов)"><input id="vp2" type="password" placeholder="Повторите пароль"><button class="btn full" id="vMk">Создать</button></div>`;
    $("#vMk").onclick = async () => {
      const a = val("vp1"); if (a.length < 6) return toast("Пароль слишком короткий"); if (a !== val("vp2")) return toast("Пароли не совпадают");
      const salt = crypto.getRandomValues(new Uint8Array(16)); S.vault = { salt: b64u(salt), iv: "", d: "" }; VK = await vKey(a, salt); VITEMS = []; await vSave(); render();
    };
  } else if (!VK) {
    v.innerHTML = `<div class="card"><div class="title">Сейф заблокирован</div><input id="vp" type="password" placeholder="Пароль" style="margin-top:10px"><button class="btn full" id="vOpen">Открыть</button></div>`;
    $("#vOpen").onclick = async () => {
      try { const k = await vKey(val("vp"), unb64u(S.vault.salt)); const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(S.vault.iv) }, k, unb64u(S.vault.d)); VITEMS = JSON.parse(new TextDecoder().decode(pt)); VK = k; render(); }
      catch (e) { toast("Неверный пароль"); }
    };
  } else {
    v.innerHTML = `<div class="grid2" style="margin-bottom:10px"><button class="btn" id="vAdd">+ Запись</button><button class="btn sec" id="vLock">Закрыть сейф</button></div>
      ${VITEMS.length ? VITEMS.map((x, i) => `<div class="card" data-i="${i}"><div class="row"><div class="grow title">🔐 ${esc(x.t)}</div><button class="btn sec sm" data-a="cp">Копировать</button><button class="btn bad sm" data-a="del">${ic("x", 14)}</button></div><div class="pre meta" data-sec>••••••••</div><button class="btn sec sm" data-a="show" style="margin-top:6px">Показать</button></div>`).join("") : '<div class="empty">Записей нет</div>'}`;
    $("#vLock").onclick = () => { VK = null; VITEMS = []; render(); };
    $("#vAdd").onclick = () => prompt2("Новая запись", [{ id: "t", l: "Название" }, { id: "x", l: "Содержимое" }], r => { if (!r.t.trim()) return false; VITEMS.push({ t: r.t.trim(), x: r.x }); vSave(); });
    $$("[data-a]", v).forEach(b => b.onclick = async () => {
      const card = b.closest("[data-i]"), i = +card.dataset.i, a = b.dataset.a;
      if (a === "show") { const s = $("[data-sec]", card); const h = s.dataset.on === "1"; s.dataset.on = h ? "0" : "1"; s.textContent = h ? "••••••••" : VITEMS[i].x; b.textContent = h ? "Показать" : "Скрыть"; }
      else if (a === "cp") { try { await navigator.clipboard.writeText(VITEMS[i].x); toast("Скопировано"); } catch (e) { toast("Не удалось скопировать"); } }
      else if (confirm("Удалить запись?")) { VITEMS.splice(i, 1); await vSave(); render(); }
    });
  }
};

/* ============ обратный отсчёт ============ */
SCREENS.counts = function (v) {
  const t0 = pkey(todayKey());
  const list = S.counts.map(c => ({ c, d: Math.round((pkey(c.date) - t0) / 86400e3) })).sort((a, b) => a.d - b.d);
  v.innerHTML = list.length ? list.map(x => `<div class="card li row" data-id="${x.c.id}"><div class="grow"><div class="title">${esc(x.c.name)}</div><div class="meta">${fmtDate(x.c.date)}</div></div><div style="text-align:right"><b style="font-size:22px">${Math.abs(x.d)}</b><div class="meta">${x.d > 0 ? "дн. осталось" : x.d === 0 ? "сегодня" : "дн. назад"}</div></div><button class="btn bad sm" data-a="del">${ic("x", 14)}</button></div>`).join("") : '<div class="empty">Добавьте важную дату: экзамен, отпуск, дедлайн</div>';
  $$("[data-a]", v).forEach(b => b.onclick = () => { if (askDel()) { S.counts = S.counts.filter(c => c.id !== b.closest("[data-id]").dataset.id); save(false); render(); } });
  fab(() => prompt2("Новая дата", [{ id: "n", l: "Название" }, { id: "d", l: "Дата", t: "date", v: todayKey() }], r => { if (!r.n.trim() || !r.d) return false; S.counts.push({ id: uid(), name: r.n.trim(), date: r.d }); save(false); }));
};

/* ============ помощник (локальные правила, без внешнего ИИ) ============ */
SCREENS.ai = function (v) {
  v.innerHTML = `<div class="card"><label>Опишите, что нужно</label><textarea id="aiIn" rows="4" placeholder="Например: напомни завтра в 16:00 сделать домашнее задание&#10;или: на следующей неделе мне нужно подготовиться к физике, закончить проект и выделить время на английский"></textarea>
    <div class="grid2"><button class="btn" id="aCreate">Создать</button><button class="btn" id="aPlan">Спланировать неделю</button><button class="btn sec" id="aSplit">Разбить задачу</button><button class="btn sec" id="aConf">Конфликты</button></div>
    <button class="btn sec full" id="aSum" style="margin-top:8px">Итоги недели</button>
    <div class="meta" style="margin-top:8px">Помощник работает локально по правилам (без внешнего ИИ-сервиса и без отправки ваших данных).</div></div><div id="aiOut"></div>`;
  const out = h => { $("#aiOut").innerHTML = h; };
  $("#aCreate").onclick = () => {
    const t = val("aiIn").trim(); if (!t) return toast("Введите текст");
    const p = parseNL(t), title = p.title || t;
    out(`<div class="card"><div class="title">${esc(title)}</div><div class="meta">${p.found ? "Когда: " + fmtDT(p.at) + (p.repeat !== "none" ? " · " + REPEAT[p.repeat] : "") : "Время не найдено — можно создать задачу"}</div>
      <div class="grid2" style="margin-top:10px">${p.found ? '<button class="btn" id="oR">Создать напоминание</button>' : ""}<button class="btn sec" id="oT">Создать задачу</button></div></div>`);
    $("#oR") && ($("#oR").onclick = () => { S.reminders.push({ id: uid(), title, at: p.at, repeat: p.repeat, days: [], prio: 2, cat: "life", pre: [0], fk: [], done: false }); save(); toast("Создано"); });
    $("#oT").onclick = () => { S.tasks.push({ id: uid(), title, due: p.found ? dkey(new Date(p.at)) : todayKey(), prio: 2, cat: "life", project: "", subs: [], repeat: "none", done: false }); save(); toast("Задача создана"); };
  };
  $("#aPlan").onclick = () => {
    const goals = parseGoals(val("aiIn")); if (!goals.length) return toast("Перечислите дела через запятую");
    const res = planWeek(goals);
    out(`<h2>Предложенное расписание</h2>${res.placed.map(p => `<div class="card tl"><div class="tm">${fmtDate(p.date)}<br>${p.start}–${p.end}</div><div class="grow title">${esc(p.title)}</div></div>`).join("")}
      ${res.unplaced.length ? `<div class="card meta">Не нашлось окон для: ${res.unplaced.map(x => esc(x.title)).join(", ")}</div>` : ""}
      ${res.placed.length ? '<button class="btn full" id="oAdd">Добавить в календарь</button>' : ""}`);
    $("#oAdd") && ($("#oAdd").onclick = () => { res.placed.forEach(p => S.events.push({ id: uid(), title: p.title, kind: "event", date: p.date, start: p.start, end: p.end, place: "", cat: "study", yearly: false })); save(); toast("Добавлено в календарь"); out('<div class="empty">Готово: события добавлены</div>'); });
  };
  $("#aSplit").onclick = () => {
    const t = val("aiIn").trim(); if (!t) return toast("Введите задачу");
    const steps = splitTask(t);
    out(`<div class="card"><div class="title">${esc(t)}</div>${steps.map((s, i) => `<div style="margin:5px 0">${i + 1}. ${esc(s)}</div>`).join("")}<div class="meta" style="margin:6px 0">Шаблонное разбиение: подправьте подзадачи после создания.</div><button class="btn full" id="oS">Создать задачу с подзадачами</button></div>`);
    $("#oS").onclick = () => { S.tasks.push({ id: uid(), title: t, due: dkey(addDays(new Date(), 7)), prio: 2, cat: "study", project: "", subs: steps.map(s => ({ id: uid(), t: s, done: false })), repeat: "none", done: false }); save(); toast("Задача создана"); };
  };
  $("#aConf").onclick = () => {
    const c = findConflicts(14);
    out(c.length ? c.map(x => `<div class="card"><div class="title">${fmtDate(x.date)}</div><div class="meta">${esc(x.a.title)} (${x.a.time}–${x.a.end}) пересекается с «${esc(x.b.title)}» (${x.b.time}–${x.b.end})</div></div>`).join("") : '<div class="empty">Конфликтов на 2 недели вперёд не найдено</div>');
  };
  $("#aSum").onclick = () => { const w = weekSummary(); out(`<div class="card"><div class="title">Итоги недели</div>${w.lines.map(l => `<div style="margin:4px 0">• ${esc(l)}</div>`).join("") || '<div class="meta">Мало данных</div>'}<div class="meta" style="margin-top:8px">${w.tips.map(esc).join("<br>")}</div><button class="btn sec full" id="oSh" style="margin-top:8px">Отправить в Telegram</button></div>`); $("#oSh").onclick = () => shareText("Итоги недели\n" + w.lines.join("\n")); };
};

/* ============ значки разделов ============ */
SCR_TITLES.icons = "Значки разделов";
SCREENS.icons = function (v) {
  const ids = [...Object.keys(NAV_META), "more", "shop", "vault", "bot", "settings"];
  const name = id => id === "more" ? "Ещё" : id === "shop" ? "Списки покупок" : id === "vault" ? "Сейф" : id === "bot" ? "Аккаунт и бот" : id === "settings" ? "Настройки" : NAV_META[id][0];
  v.innerHTML = `<div class="meta" style="margin:0 4px 10px">Выберите значок для каждого раздела: встроенный, эмодзи или свою картинку. Он появится в нижнем меню и в списках.</div><div class="group">${ids.map(id => `<div class="card li clk" data-id="${id}">${secTile(id, "#7b95ff", 38)}<div class="grow title">${name(id)}</div>${(S.settings.icons || {})[id] ? '<span class="meta">свой</span>' : ""}<span class="chev">${ic("chevron", 18)}</span></div>`).join("")}</div>
    <button class="btn sec full" id="icAll" style="margin-top:12px">Сбросить все значки</button>`;
  $$("[data-id]", v).forEach(c => c.onclick = () => openIconPicker(secIconVal(c.dataset.id), nv => { S.settings.icons = S.settings.icons || {}; if (nv) S.settings.icons[c.dataset.id] = nv; else delete S.settings.icons[c.dataset.id]; save(false); render(); }, { reset: true }));
  $("#icAll").onclick = () => { S.settings.icons = {}; save(false); render(); };
};

/* ============ аккаунт и бот ============ */
SCREENS.bot = function (v) {
  const a = S.account || {}, tg = inTG;
  const who = tg ? ((TG.initDataUnsafe.user || {}).first_name || "Telegram") : "Гость";
  const how = tg ? "Вход через Telegram · данные синхронизируются по аккаунту" : "Без входа: синхронизации нет, данные только на этом устройстве";
  v.innerHTML = `<div class="card acc-card"><div class="row"><span style="position:relative;display:flex">${tint(tg ? "send" : "user", "#8b7bd8", 48)}<span style="position:absolute;inset:0;border-radius:15px;overflow:hidden">${avatar()}</span></span><div class="grow"><div class="title">${esc(who)}</div><div class="meta">${esc(how)}</div></div></div>
    <div class="grid2" style="margin-top:12px">${a.mode && a.mode !== "local" && !tg ? `<button class="btn sec" id="aOut">${ic("logout", 18)} Выйти</button>` : tg ? "" : `<button class="btn" id="aIn">Войти</button>`}<button class="btn sec" id="aBot">${ic("send", 18)} Открыть бота</button></div></div>
  <h2>Ваш ID</h2><div class="card"><div class="idcard"><span>ID в приложении · бот его запоминает</span><b>${esc(S.appId || "")}</b></div>
    <div class="grid2" style="margin-top:10px"><button class="btn sec" id="bId">Скопировать ID</button><button class="btn sec" id="bReg">Команда регистрации</button></div></div>
  <h2>Уведомления через бота</h2><div class="card">
    <label class="swl"><span>Присылать в Telegram</span><input type="checkbox" id="nOn" ${S.settings.botn.on ? "checked" : ""}></label>
    <label>Событие и расписание — предупредить за</label>${seg("nEv", { 5: "5 мин", 10: "10 мин", 30: "30 мин", 60: "1 час" }, S.settings.botn.ev)}
    <label class="swl" style="margin-top:14px"><span>Напоминать о привычках</span><input type="checkbox" id="nHab" ${S.settings.botn.hab ? "checked" : ""}></label>
    <button class="btn full" id="bSend" style="margin-top:14px">${inTG ? "Отправить боту напоминания и настройки" : "Скопировать данные для бота"}</button>
    <div class="meta" style="margin-top:8px">${inTG ? "Окно закроется после отправки. " : "Вставьте скопированный текст в чат с ботом и отправьте. "}После правок напоминаний или этих настроек отправьте данные снова. Бот пришлёт всё в срок, даже когда приложение закрыто. Тонкая настройка в чате: /notify.</div></div>
  ${tg ? `<div class="card"><div class="title">Облако Telegram</div><div class="grid2" style="margin-top:8px"><button class="btn sec" id="bBk">Сохранить копию</button><button class="btn sec" id="bRs">Восстановить</button></div><div class="meta" style="margin-top:6px">Копия делается автоматически и хранится в облаке Telegram.</div></div>` : ""}
  <div class="card"><div class="title">Команды бота</div><div class="meta pre" style="margin-top:6px">/add 15м текст — напоминание
/task текст — задача · /tasks · /done номер
/today — план на сегодня
/habit — отметить привычку
/water 250 — выпитая вода
/expense 450 еда обед · /income 5000 зарплата
/stats — сводка за неделю
/digest 08:00 — время дайджеста (off — выключить)
/notify — уведомления · /me — профиль и ID
/sync — передать данные из бота в приложение</div></div>
  <button class="btn sec full" id="bShare" style="margin-top:4px">${ic("share", 18)} Поделиться итогами недели</button>`;
  const g = id => $("#" + id, v);
  g("aOut") && (g("aOut").onclick = logout); g("aIn") && (g("aIn").onclick = showAuth); g("aBot").onclick = openBot;
  g("bSend").onclick = inTG ? sendToBot : copySyncForBot;
  g("bId").onclick = async () => toast((await copyText(S.appId)) ? "ID скопирован" : S.appId);
  g("bReg").onclick = async () => toast((await copyText(regCommand())) ? "Команда скопирована — отправьте её боту" : regCommand());
  g("nOn").onchange = e => { S.settings.botn.on = e.target.checked; save(false); };
  g("nHab").onchange = e => { S.settings.botn.hab = e.target.checked; save(false); };
  g("nEv").onchange = e => { S.settings.botn.ev = +e.target.value; save(false); }; g("bBk") && (g("bBk").onclick = () => cloudBackup()); g("bRs") && (g("bRs").onclick = cloudRestore);
  g("bShare").onclick = () => { const w = weekSummary(); shareText("Итоги недели\n" + (w.lines.join("\n") || "Пока мало данных")); };
};

/* ============ настройки ============ */
async function sha(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return b64u(new Uint8Array(b)); }
function settingsPart(v, part) {
  const $ = (s, r) => (r || document).querySelector(s) || {};
  const full = `<h2>Оформление</h2><div class="card"><label>Тема</label><div class="chips">${[["dark", "Тёмная"], ["light", "Светлая"], ["auto", "Авто"]].map(([k, l]) => `<span class="chip ${S.settings.theme === k ? "active" : ""}" data-th="${k}">${l}</span>`).join("")}</div>
    <label>Стиль интерфейса</label><div class="chips">${[["bento", "Современный"], ["classic", "Строгий"]].map(([k, l]) => `<span class="chip ${(S.settings.ui || "bento") === k ? "active" : ""}" data-ui="${k}">${l}</span>`).join("")}</div>
    <label>Цветовая схема</label><div class="chips">${[["ink", "Чернила", "#5f7bff,#9189ff"], ["aurora", "Аврора", "#6a5cff,#22c1e8"], ["ocean", "Океан", "#1f7ae0,#2fd4b8"], ["ember", "Закат", "#ff6a5a,#ffb347"], ["forest", "Лес", "#1f9e6e,#9ad14f"], ["plum", "Слива", "#a24bff,#ff6bb3"], ["graphite", "Графит", "#5d7390,#8aa0ba"]].map(([k, l, c]) => `<span class="chip ${S.settings.scheme === k ? "active" : ""}" data-sc="${k}"><i class="swatch" style="background:linear-gradient(135deg,${c.split(",")[0]},${c.split(",")[1]})"></i>${l}</span>`).join("")}</div>
  <h2>Уведомления и защита</h2><div class="card">
    <label><input type="checkbox" id="sSnd" ${S.settings.sound ? "checked" : ""}> звук и вибрация</label>
    <button class="btn sec full" id="sNot" style="margin:8px 0">Разрешить уведомления</button>
    <div class="grid2"><button class="btn sec" id="sPin">${S.settings.pin ? "Сменить PIN" : "Установить PIN"}</button>${S.settings.pin ? '<button class="btn bad" id="sPinOff">Убрать PIN</button>' : "<span></span>"}</div>
    <div class="meta" style="margin-top:6px">PIN блокирует вход в приложение на этом устройстве. Биометрию веб-приложение не поддерживает.</div></div>
  <h2>Погода и деньги</h2><div class="card">
    <label>Город (для погоды на главной)</label><div class="row" style="margin-bottom:8px"><input id="sCity" value="${esc(S.settings.city ? S.settings.city.name : "")}" style="margin:0" placeholder="Например: Красноярск"><button class="btn sec" id="sFind">Найти</button></div>
    <label>Валюта</label><select id="sCur">${["₽", "$", "€", "₸", "Br", "₴"].map(c => `<option ${S.settings.cur === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
  <h2>Категории</h2><div class="card">${S.cats.map(c => `<div class="row" style="margin:4px 0" data-cid="${c.id}"><span class="cdot" style="background:${c.color}"></span><div class="grow">${esc(c.name)}</div>${S.cats.length > 1 ? `<button class="btn bad sm" data-a="del">${ic("x", 14)}</button>` : ""}</div>`).join("")}
    <div class="row" style="margin-top:8px"><input id="cN" placeholder="Новая категория" style="margin:0"><input id="cC" type="color" value="#5b8def" style="width:52px;padding:2px;margin:0"><button class="btn sec" id="cAdd">+</button></div></div>
  <h2>Данные</h2>${guest() ? `<div class="card"><div class="row">${tint("lock", "#6b7a99", 42)}<div class="grow"><div class="title">Режим без входа</div><div class="meta">Синхронизации нет: данные хранятся только на этом устройстве. Резервная копия, перенос и выгрузка данных недоступны.</div></div></div><button class="btn full" id="dLogin" style="margin-top:12px">${ic("send", 18)} Войти через Telegram</button><button class="btn bad full" id="dClr" style="margin-top:8px">Стереть все данные</button></div>` : `<div class="card"><div class="meta" style="margin-bottom:10px">Данные синхронизируются автоматически через ваш аккаунт Telegram.</div><div class="grid2"><button class="btn sec" id="dExp">Экспорт JSON</button><button class="btn sec" id="dImp">Импорт JSON</button><button class="btn sec" id="dCsv">Финансы в CSV</button><button class="btn sec" id="dIcs">Календарь .ics</button></div>
    <input id="dFile" type="file" accept="application/json" class="hidden"><input id="dIFile" type="file" accept=".ics,text/calendar" class="hidden">
    <button class="btn sec full" id="dIcsIn" style="margin-top:8px">Импорт календаря (.ics)</button>
    <div class="meta" style="margin-top:6px">Календарь Google: экспортируйте файл .ics в самом Google Календаре и загрузите его здесь; наш файл .ics можно импортировать в Google.</div>
    <button class="btn bad full" id="dClr" style="margin-top:8px">Стереть все данные</button></div>`}
  <div class="meta" style="text-align:center;margin-top:10px">Планер · данные хранятся на устройстве, работает без интернета</div>`;
  const parts = {}; full.split("<h2>").slice(1).forEach(s => { const n = s.slice(0, s.indexOf("</h2>")); parts[n] = "<h2>" + s; });
  const map = { set_look: "Оформление", set_sec: "Уведомления и защита", set_loc: "Погода и деньги", set_cats: "Категории", set_data: "Данные" };
  v.innerHTML = (parts[map[part]] || "").replace(/^<h2>.*?<\/h2>/, "");
  $$("[data-th]", v).forEach(c => c.onclick = () => { S.settings.theme = c.dataset.th; save(false); render(); });
  $$("[data-ui]", v).forEach(c => c.onclick = () => { S.settings.ui = c.dataset.ui; save(false); render(); });
  $$("[data-sc]", v).forEach(c => c.onclick = () => { S.settings.scheme = c.dataset.sc; save(false); render(); });
  $("#lyIcons").onclick = () => go("more", "icons"); $("#lyNav").onclick = navLayoutSheet; $("#lyHome").onclick = homeLayoutSheet;
  $("#sSnd").onchange = e => { S.settings.sound = e.target.checked; save(false); if (S.settings.sound) beep(); };
  $("#sNot").onclick = askNotify;
  $("#sPin").onclick = () => prompt2("PIN-код", [{ id: "p", l: "Новый PIN (4–8 цифр)", t: "password" }], r => { if (!/^\d{4,8}$/.test(r.p)) { toast("PIN: от 4 до 8 цифр"); return false; } const salt = uid(); sha(salt + r.p).then(h => { S.settings.pin = { salt, h }; save(false); render(); toast("PIN установлен"); }); });
  $("#sPinOff") && ($("#sPinOff").onclick = () => { if (confirm("Убрать PIN?")) { S.settings.pin = null; save(false); render(); } });
  $("#sFind").onclick = async () => {
    const q = val("sCity").trim(); if (!q) return;
    try { const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=ru`)).json(); const r = j.results && j.results[0]; if (!r) return toast("Город не найден"); S.settings.city = { name: r.name, lat: r.latitude, lon: r.longitude }; wxCache = null; save(false); render(); toast("Город: " + r.name); } catch (e) { toast("Нужен интернет для поиска города"); }
  };
  $("#sCur").onchange = e => { S.settings.cur = e.target.value; save(false); };
  $$("[data-cid] [data-a]", v).forEach(b => b.onclick = () => { if (confirm("Удалить категорию? Записи останутся.")) { S.cats = S.cats.filter(c => c.id !== b.closest("[data-cid]").dataset.cid); save(false); render(); } });
  $("#cAdd").onclick = () => { const n = val("cN").trim(); if (!n) return; S.cats.push({ id: uid(), name: n, color: val("cC") }); save(false); render(); };
  if (!guest()) {
    $("#dExp").onclick = () => dl("planner-backup.json", "application/json", JSON.stringify(S, null, 1));
    $("#dImp").onclick = () => $("#dFile").click();
    $("#dFile").onchange = e => { const f = e.target.files[0]; if (f) f.text().then(t => { try { const o = JSON.parse(t); if (!confirm("Заменить текущие данные импортируемыми?")) return; S = Object.assign(def(), o); S.settings = Object.assign(def().settings, o.settings || {}); save(false); toast("Импортировано"); render(); } catch (x) { toast("Неверный файл"); } }); };
    $("#dCsv").onclick = () => dl("finance.csv", "text/csv", "﻿дата;тип;категория;сумма;заметка\n" + S.tx.map(t => [dkey(new Date(t.ts)), t.type === "in" ? "доход" : "расход", t.cat, t.amt, '"' + (t.note || "").replace(/"/g, '""') + '"'].join(";")).join("\n"));
    $("#dIcs").onclick = () => dl("planner.ics", "text/calendar", toICS());
    $("#dIcsIn").onclick = () => $("#dIFile").click();
    $("#dIFile").onchange = e => { const f = e.target.files[0]; if (f) f.text().then(t => { const ev = fromICS(t); if (!ev.length) return toast("Событий не найдено"); S.events.push(...ev); save(); toast("Импортировано событий: " + ev.length); }); };
  } else $("#dLogin").onclick = showAuth;
  $("#dClr").onclick = () => { if (confirm("Удалить все данные без возможности восстановления?")) { S = def(); VK = null; save(false); go("home"); } };
}
for (const p of ["set_look", "set_sec", "set_loc", "set_cats", "set_data"]) SCREENS[p] = v => settingsPart(v, p);

SCREENS.settings = function (v) {
  const R2 = (ico, col, t, sub, id) => `<div class="card li navrow" data-r="${id}">${tint(ico, col, 38)}<div class="grow"><div class="title">${t}</div>${sub ? `<div class="meta">${sub}</div>` : ""}</div><span class="chev">›</span></div>`;
  const nm = (S.profile && S.profile.name) || (typeof TG !== "undefined" && TG && TG.initDataUnsafe && TG.initDataUnsafe.user && TG.initDataUnsafe.user.first_name) || "Планер";
  v.innerHTML = `<div class="card li navrow prof" data-r="bot"><img class="pav" src="avatar.png" alt="" onerror="this.remove()"><div class="grow"><div class="title">${esc(nm)}</div><div class="meta">${guest() ? "Без входа · без синхронизации" : "Вход через Telegram"}</div></div><span class="chev">›</span></div>
  <h2>Внешний вид</h2><div class="group">
    ${R2("sparkles", "#8b7bd8", "Тема и цвета", (S.settings.ui === "classic" ? "Строгий" : "Современный") + " · " + S.settings.scheme, "set_look")}
    ${R2("grid", "#5b8def", "Нижнее меню", "до 5 разделов", "ly_nav")}
    ${R2("home", "#4fb3a9", "Главный экран", "какие блоки показывать", "ly_home")}
    ${R2("sparkles", "#d1a85b", "Значки разделов", "свои иконки", "icons")}</div>
  <h2>Приложение</h2><div class="group">
    ${R2("bell", "#e0725f", "Журнал уведомлений", (S.nlog || []).length + " шт.", "notifs")}
    ${R2("bell", "#e0725f", "Уведомления и защита", S.settings.pin ? "PIN включён" : "звук, PIN", "set_sec")}
    ${R2("drop", "#4aa8ff", "Погода и деньги", S.settings.city ? esc(S.settings.city.name) + " · " + S.settings.cur : "город, валюта", "set_loc")}
    ${R2("tasks", "#4caf7d", "Категории", S.cats.length + " шт.", "set_cats")}
    ${R2("lock", "#6b7a99", "Данные", guest() ? "в режиме без входа недоступно" : "резервная копия, импорт, экспорт", "set_data")}</div>
  <div class="meta" style="text-align:center;margin-top:14px">Планер · данные хранятся на устройстве</div>`;
  $$("[data-r]", v).forEach(r => r.onclick = () => { const id = r.dataset.r; if (id === "ly_nav") navLayoutSheet(); else if (id === "ly_home") homeLayoutSheet(); else go("more", id); });
};
TABVIEWS.fin = function (v) { SCREENS.fin(v); };

SCR_TITLES.notifs = "Уведомления";
SCREENS.notifs = function (v) {
  const l = S.nlog || [];
  v.innerHTML = l.length ? `<div class="group">${l.map(n => `<div class="card li">${tint("bell", "#e0725f", 36)}<div class="grow"><div class="title">${esc(n.t)}</div><div class="meta">${esc(n.b || "")} · ${fmtT(n.ts)}</div></div></div>`).join("")}</div><button class="btn sec full" id="nClr" style="margin-top:10px">Очистить</button>` : empty("Пока уведомлений не было");
  const c = $("#nClr", v); if (c) c.onclick = () => { S.nlog = []; save(false); render(); };
};
