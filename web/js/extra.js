"use strict";
/* ============ поиск по всему приложению ============ */
SCR_TITLES.search = "Поиск";
SCREENS.search = function (v) {
  v.innerHTML = `<div class="qa searchbar">${ic("search", 19)}<input id="sq" placeholder="Задачи, напоминания, заметки, события…" autocomplete="off"></div><div id="sres"></div>`;
  const out = $("#sres", v), inp = $("#sq", v);
  const hit = (...f) => { const q = inp.value.trim().toLowerCase(); return q && f.some(x => String(x || "").toLowerCase().includes(q)); };
  const row = (icn, color, title, meta, attrs) => `<div class="card li clk" ${attrs}>${tint(icn, color, 36)}<div class="grow"><div class="title">${esc(title)}</div>${meta ? `<div class="meta">${esc(meta)}</div>` : ""}</div><span class="chev">${ic("chevron", 18)}</span></div>`;
  const draw = () => {
    if (!inp.value.trim()) { out.innerHTML = empty("Начните вводить: ищем по задачам, напоминаниям, событиям, заметкам и целям"); return; }
    const g = [];
    const T = S.tasks.filter(t => hit(t.title, t.project, (t.subs || []).map(x => x.t).join(" "))).slice(0, 8);
    const Rm = S.reminders.filter(r => hit(r.title)).slice(0, 8);
    const E = S.events.filter(e => hit(e.title, e.place)).slice(0, 8);
    const N = S.notes.filter(n => hit(n.title, n.text, n.tags, (n.items || []).map(x => x.t).join(" "))).slice(0, 8);
    const G = S.goals.filter(x => hit(x.name)).slice(0, 5);
    if (T.length) g.push(`<h2>Задачи</h2>${T.map(t => row("tasks", "#4fd18f", t.title, (t.due ? fmtDate(t.due) : "без срока") + (t.done ? " · выполнена" : ""), `data-s="t:${t.id}"`)).join("")}`);
    if (Rm.length) g.push(`<h2>Напоминания</h2>${Rm.map(r => row("bell", "#6a8cff", r.title, fmtDT(r.at), `data-s="r:${r.id}"`)).join("")}`);
    if (E.length) g.push(`<h2>События</h2>${E.map(e => row("calendar", "#ff9a5b", e.title, e.date ? fmtDate(e.date) : "", `data-s="e:${e.id}"`)).join("")}`);
    if (N.length) g.push(`<h2>Заметки</h2>${N.map(n => row("note", "#c78bff", n.title || "Без названия", "", `data-s="n:${n.id}"`)).join("")}`);
    if (G.length) g.push(`<h2>Цели</h2>${G.map(x => row("target", "#e0725f", x.name, "", `data-s="g:0"`)).join("")}`);
    out.innerHTML = g.length ? g.join("") : empty("Ничего не найдено");
    $$("[data-s]", out).forEach(c => c.onclick = () => { const [k, id] = c.dataset.s.split(":"); ({ t: () => taskForm(id), r: () => remForm(id), e: () => eventForm(id), n: () => noteForm(id), g: () => go("more", "goals") })[k](); });
  };
  inp.oninput = draw; draw(); setTimeout(() => inp.focus(), 50);
};

/* ============ уведомления в Android-приложении (APK): работают при закрытом приложении ============ */
const NATIVE = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
const LN = () => NATIVE && window.Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
const nid = str => { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h) % 2147483000 + 1; };
let nativeT = 0, nativeBusy = false;
function nativeSchedule() {
  if (!NATIVE) return;
  clearTimeout(nativeT); nativeT = setTimeout(doNativeSchedule, 1500);
}
async function doNativeSchedule() {
  const ln = LN(); if (!ln || nativeBusy) return;
  nativeBusy = true;
  try {
    const perm = await ln.checkPermissions();
    if (perm.display !== "granted") { const r = await ln.requestPermissions(); if (r.display !== "granted") return; }
    const pend = await ln.getPending();
    if (pend.notifications && pend.notifications.length) await ln.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
    const now = Date.now(), list = [], push = (key, title, body, at) => { if (at > now + 3000 && list.length < 60) list.push({ id: nid(key), title, body: body || "", schedule: { at: new Date(at), allowWhileIdle: true }, channelId: "planner" }); };
    for (const r of S.reminders) {
      if (r.done) continue;
      let at = r.at, n = 0;
      while (n < (r.repeat !== "none" ? 6 : 1) && list.length < 60) {
        for (const m of (r.pre && r.pre.length ? r.pre : [0])) push(r.id + ":" + at + ":" + m, m ? "Скоро: " + r.title : "Напоминание", m ? "через " + (m >= 1440 ? "1 день" : m >= 60 ? m / 60 + " ч" : m + " мин") : r.title, at - m * 60000);
        if (r.repeat === "none") break;
        at = nextRepeat(at, r.repeat, r.days); n++;
      }
    }
    for (let d = 0; d < 7; d++) {
      const key = dkey(addDays(new Date(), d));
      for (const it of itemsOn(key)) if ((it.src === "ev" || it.src === "sch") && it.time) { const [h, m] = it.time.split(":").map(Number), dt = pkey(key); dt.setHours(h, m, 0, 0); push("e:" + it.ref + key, "Скоро: " + it.title, "в " + it.time + (it.place ? ", " + it.place : ""), dt.getTime() - 10 * 60000); }
    }
    for (const t of S.timers) if (t.running && t.end > now) push("tm:" + t.id + t.end, "Таймер", t.name, t.end);
    if (list.length) await ln.schedule({ notifications: list });
  } catch (e) { /* уведомления недоступны — приложение продолжит работать */ }
  nativeBusy = false;
}
if (NATIVE) {
  document.addEventListener("DOMContentLoaded", () => { const ln = LN(); if (ln && ln.createChannel) ln.createChannel({ id: "planner", name: "Напоминания", importance: 5, vibration: true }).catch(() => { }); nativeSchedule(); });
  setTimeout(nativeSchedule, 2500);
}
