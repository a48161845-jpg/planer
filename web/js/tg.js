"use strict";
/* ============ интеграция с Telegram ============ */
const TG = window.Telegram && window.Telegram.WebApp;
const inTG = !!(TG && TG.initData);
let REG_MODE = false; // true при первом запуске из бота (?reg=1)
const deviceZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; } };
if (TG) { try { TG.ready(); TG.expand(); } catch (e) { /* не критично */ } }

const b64u = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
async function gz(str) {
  const cs = new CompressionStream("gzip"), w = cs.writable.getWriter();
  w.write(new TextEncoder().encode(str)); w.close();
  return b64u(new Uint8Array(await new Response(cs.readable).arrayBuffer()));
}
async function ungz(b64) {
  const ds = new DecompressionStream("gzip"), w = ds.writable.getWriter();
  w.write(unb64u(b64)); w.close();
  return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer());
}

/* что отправляем боту (короткие ключи, только актуальное) */
function syncPayload(horizonDays) {
  const lim = Date.now() + horizonDays * 86400e3, k = todayKey(), kEnd = dkey(addDays(new Date(), horizonDays));
  return {
    v: 3, app: S.appId || "", nt: { on: S.settings.botn ? S.settings.botn.on : true, ev: S.settings.botn ? S.settings.botn.ev : 10, hab: S.settings.botn ? S.settings.botn.hab : true }, tz: -new Date().getTimezoneOffset(), zone: deviceZone(), reg: REG_MODE ? 1 : 0,
    rem: S.reminders.filter(r => !r.done && (r.repeat !== "none" || r.at <= lim)).map(r => ({ i: r.id, t: r.title, a: r.at, r: r.repeat, d: r.days || [], p: r.pre && r.pre.length ? r.pre : [0] })),
    sch: S.schedule.map(e => ({ i: e.id, d: e.day, s: e.start, e: e.end, t: e.title, pl: e.place || "" })),
    ev: S.events.filter(e => e.yearly || e.kind === "birthday" || (e.date >= k && e.date <= kEnd)).map(e => ({ i: e.id, t: e.title, d: e.date, s: e.start || "", e: e.end || "", k: e.kind || "event", y: (e.yearly || e.kind === "birthday") ? 1 : 0 })),
    hab: S.habits.map(h => ({ i: h.id, n: h.name, r: h.remind || "" })),
    tk: S.tasks.filter(t => !t.done && !t.archived).slice(0, 40).map(t => ({ i: t.id, t: t.title, d: t.due || "" }))
  };
}
async function buildSyncData() {
  if (typeof CompressionStream === "undefined") return "j:" + JSON.stringify(syncPayload(14)).slice(0, 3900);
  for (const days of [60, 30, 14, 7, 3]) {
    const z = "z:" + await gz(JSON.stringify(syncPayload(days)));
    if (z.length <= 3900) return z;
  }
  return null;
}
async function sendToBot() {
  if (!inTG) return toast("Откройте приложение кнопкой из бота");
  const d = await buildSyncData();
  if (!d) return toast("Слишком много данных для одной отправки — удалите старое");
  try { TG.sendData(d); } catch (e) { toast("Не удалось отправить: откройте приложение кнопкой «Синхронизация» в чате с ботом"); }
}

/* входящие данные от бота: ?d=<gzip+base64url> */
async function handleInbound() {
  const q = new URLSearchParams(location.search), d = q.get("d");
  if (!d) return;
  try {
    const o = JSON.parse(await ungz(d));
    let n = 0;
    S.seen = S.seen || {};
    const fresh = id => { if (S.seen[id]) return false; S.seen[id] = 1; return true; };
    (o.rem || []).forEach(r => { if (fresh("r" + r.id)) { S.reminders.push({ id: "b" + r.id, title: r.title, at: r.at, repeat: r.repeat || "none", days: [], prio: r.prio || 2, cat: "life", pre: [0], done: false, fk: [] }); n++; } });
    (o.tasks || []).forEach(t => { if (fresh("t" + t.id)) { S.tasks.push({ id: "b" + t.id, title: t.title, due: t.due || null, prio: t.prio || 2, cat: "life", project: "", subs: [], repeat: "none", done: false }); n++; } });
    (o.water || []).forEach(w => { if (fresh("w" + w.id)) { S.water.push({ id: "b" + w.id, ts: w.ts, ml: w.ml }); n++; } });
    (o.tx || []).forEach(x => { if (fresh("x" + x.id)) { S.tx.push({ id: "b" + x.id, type: x.type, amt: x.amt, cat: x.cat, note: x.note || "", ts: x.ts }); n++; } });
    (o.hab || []).forEach(m => { const h = S.habits.find(z => z.id === m.hid); if (h && !h.log[m.date]) { h.log[m.date] = true; n++; } });
    save(false);
    toast(n ? `Получено из бота: ${n}` : "Всё уже было получено");
  } catch (e) { toast("Не удалось прочитать данные из бота"); }
  history.replaceState(null, "", location.pathname);
}

/* резервная копия в облако Telegram (до ~350 КБ, без фотографий) */
const CHUNK = 3500;
async function cloudBackup(quiet) {
  if (!inTG || !TG.CloudStorage) return quiet || toast("Доступно только внутри Telegram");
  const copy = JSON.parse(JSON.stringify(S)); copy.notes.forEach(n => { n.img = null; });
  const z = typeof CompressionStream === "undefined" ? null : await gz(JSON.stringify(copy));
  if (!z) return toast("Браузер не поддерживает сжатие");
  const parts = []; for (let i = 0; i < z.length; i += CHUNK) parts.push(z.slice(i, i + CHUNK));
  if (parts.length > 100) return toast("Данных слишком много для облака Telegram");
  const items = { pl_n: String(parts.length), pl_rev: String(S.rev) };
  parts.forEach((p, i) => { items["pl_" + i] = p; });
  const keys = Object.keys(items);
  let left = keys.length, failed = false;
  keys.forEach(k => TG.CloudStorage.setItem(k, items[k], (err, ok) => { if (err || !ok) failed = true; if (--left === 0) { if (failed) toast("Копия сохранена не полностью"); else if (!quiet) toast(`Копия сохранена (${parts.length} ч.)`); } }));
}
function cloudRestore(auto) {
  if (!inTG || !TG.CloudStorage) return auto === true || toast("Доступно только внутри Telegram");
  TG.CloudStorage.getItem("pl_n", async (e, nStr) => {
    const n = +nStr; if (e || !n) return auto === true || toast("В облаке копии нет");
    const keys = Array.from({ length: n }, (_, i) => "pl_" + i);
    TG.CloudStorage.getItems(keys, async (err, vals) => {
      if (err) return toast("Не удалось прочитать копию");
      try {
        const o = JSON.parse(await ungz(keys.map(k => vals[k]).join("")));
        if (auto !== true && !confirm("Заменить текущие данные копией из облака Telegram?")) return;
        const imgs = Object.fromEntries(S.notes.map(x => [x.id, x.img]));
        const acc = S.account;
        S = Object.assign(def(), o); S.settings = Object.assign(def().settings, o.settings || {}); S.account = acc;
        const st = S.settings; if (!Array.isArray(st.nav) || !st.nav.length) st.nav = def().settings.nav; if (!Array.isArray(st.widgets)) st.widgets = def().settings.widgets;
        S.notes.forEach(x => { if (imgs[x.id]) x.img = imgs[x.id]; });
        const rev = +o.rev || Date.now(); S.rev = rev; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e2) { /* игнор */ }
        toast(auto === true ? "Данные синхронизированы с аккаунтом Telegram" : "Данные восстановлены"); render();
      } catch (ex) { toast("Копия повреждена"); }
    });
  });
}

/* автосинхронизация по аккаунту Telegram: побеждает более новая копия */
let syncT, lastCloud = 0, lastCheck = 0;
function scheduleSync() {
  if (!inTG || guest()) return;
  clearTimeout(syncT);
  const wait = Math.max(5000, 60000 - (Date.now() - lastCloud));
  syncT = setTimeout(() => { lastCloud = Date.now(); cloudBackup(true).catch(() => { }); }, wait);
}
function cloudSyncStart() {
  if (!inTG || guest() || !TG.CloudStorage || Date.now() - lastCheck < 20000) return;
  lastCheck = Date.now();
  TG.CloudStorage.getItem("pl_rev", (e, v) => {
    if (e) return;
    const cr = +v || 0;
    if (cr > S.rev) cloudRestore(true);
    else if (cr < S.rev) { lastCloud = Date.now(); cloudBackup(true).catch(() => { }); }
  });
}
function shareText(text) {
  const url = "https://t.me/share/url?url=" + encodeURIComponent(location.origin + location.pathname) + "&text=" + encodeURIComponent(text);
  if (inTG && TG.openTelegramLink) TG.openTelegramLink(url); else window.open(url, "_blank");
}

/* текстовая синхронизация: копируем данные и отправляем боту сообщением */
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); return true; } catch (e) {
    try { const a = document.createElement("textarea"); a.value = s; a.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(a); a.select(); const ok = document.execCommand("copy"); a.remove(); return ok; } catch (e2) { return false; }
  }
}
async function copySyncForBot() {
  const d = await buildSyncData();
  if (!d) return toast("Слишком много данных — удалите старое");
  toast((await copyText(d)) ? "Скопировано — вставьте в чат с ботом и отправьте" : "Не удалось скопировать");
}
