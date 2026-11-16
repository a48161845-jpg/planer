"use strict";
/* ============ фоновая проверка: напоминания, таймеры, события, привычки ============ */
let hiddenAt = 0;
function tick() {
  const now = Date.now(), nd = new Date(), today = todayKey(), nowMin = nd.getHours() * 60 + nd.getMinutes();
  let ch = false;
  const once = key => { if (S.sent[key]) return false; S.sent[key] = today; ch = true; return true; };

  for (const r of S.reminders) {
    if (r.done) continue;
    r.fk = r.fk || [];
    const pres = r.pre && r.pre.length ? r.pre : [0];
    for (const m of pres) {
      const key = r.at + ":" + m;
      if (r.fk.includes(key) || now < r.at - m * 60000) continue;
      r.fk.push(key); ch = true;
      if (m > 0 && now >= r.at) continue; // заблаговременное уже неактуально
      if (m > 0) notify("Скоро: " + r.title, "через " + (m >= 1440 ? "1 день" : m >= 60 ? (m / 60) + " ч" : m + " мин"));
      else notify("Напоминание", r.title);
    }
    if (now >= r.at && pres.every(m => r.fk.includes(r.at + ":" + m)) && r.repeat !== "none") {
      r.at = nextRepeat(r.at, r.repeat, r.days); r.fk = []; ch = true;
    }
  }
  for (const t of S.timers) if (t.running && now >= t.end) { t.running = false; t.left = 0; ch = true; notify("Таймер", t.name); }
  const p = S.pomo;
  if (p.running && now >= p.end) {
    p.running = false; ch = true;
    if (p.mode === "work") { S.pomoLog.push(now); notify("Pomodoro", "Фокус завершён — время перерыва"); p.mode = "brk"; }
    else { notify("Pomodoro", "Перерыв окончен"); p.mode = "work"; }
    p.left = (p.mode === "work" ? S.settings.pomo.work : S.settings.pomo.brk) * 60;
  }
  for (const it of itemsOn(today)) {
    if ((it.src === "ev" || it.src === "sch") && it.time) {
      const sm = hm(it.time);
      if (nowMin >= sm - 10 && nowMin < sm && once("e:" + it.ref + ":" + today)) notify("Скоро: " + it.title.replace(/^🎂 /, ""), `в ${it.time}${it.place ? ", " + it.place : ""}`);
    }
    if (it.k === "birthday" && nowMin >= 540 && once("b:" + it.ref + ":" + today)) notify("День рождения", it.title.replace(/^🎂 /, ""));
  }
  for (const h of S.habits) {
    if (h.remind && !h.log[today] && nowMin >= hm(h.remind) && nowMin < hm(h.remind) + 120 && once("h:" + h.id + ":" + today)) notify("Привычка", (iconText(h.icon) + " " + h.name).trim());
  }
  const keys = Object.keys(S.sent);
  if (keys.length > 200) { const lim = dkey(addDays(nd, -3)); keys.forEach(k => { if (S.sent[k] < lim) delete S.sent[k]; }); ch = true; }

  if (ch) { save(); if (!/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) render(); }
  const clk = $("#clk"); if (clk) clk.textContent = `${pad(nd.getHours())}:${pad(nd.getMinutes())}`;
}

/* ============ блокировка PIN ============ */
function lockApp() {
  const pin = S.settings.pin; if (!pin) return;
  const l = $("#lock"); l.classList.remove("hidden");
  l.innerHTML = '<div class="box"><div style="font-size:42px">🔒</div><h2 style="justify-content:center">Планер</h2><input id="lk" type="password" inputmode="numeric" placeholder="PIN" autocomplete="off"><button class="btn full" id="lkOk">Открыть</button></div>';
  const tryPin = async () => {
    const h = await sha(pin.salt + $("#lk").value);
    if (h === pin.h) { l.classList.add("hidden"); l.innerHTML = ""; } else { toast("Неверный PIN"); $("#lk").value = ""; }
  };
  $("#lkOk").onclick = tryPin; $("#lk").onkeydown = e => { if (e.key === "Enter") tryPin(); };
  setTimeout(() => { const i = $("#lk"); if (i) i.focus(); }, 60);
}
$("#hLock").onclick = lockApp;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hiddenAt = Date.now();
  else { cloudSyncStart(); if (S.settings.pin && hiddenAt && Date.now() - hiddenAt > 60000) lockApp(); tick(); if (!/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) render(); }
});

/* ============ регистрация: часовой пояс определяется автоматически ============ */
function startRegistration() {
  REG_MODE = true;
  const zone = deviceZone(), off = -new Date().getTimezoneOffset(), a = Math.abs(off);
  const label = `${zone ? zone + ", " : ""}UTC${off >= 0 ? "+" : "−"}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
  sheet("Регистрация", `<div class="card"><div class="title">Почти готово</div><div class="meta" style="margin:6px 0">Часовой пояс определён автоматически: ${esc(label)}. Данные отправляются боту, окно закроется само.</div></div>
    <button class="btn full" id="regGo">Завершить регистрацию</button>`, w => { $("#regGo").onclick = sendToBot; });
  setTimeout(sendToBot, 1200);
}

/* ============ запуск ============ */
(function init() {
  applyTheme();
  if (S.settings.pin) lockApp();
  if (inTG && !(S.account && S.account.mode === "tg")) { S.account = { mode: "tg", name: (TG.initDataUnsafe.user || {}).first_name || "" }; save(false); }
  if (!S.account) showAuth();
  if (inTG) { $("#tgDot").classList.add("on"); $("#tgState").textContent = (TG.initDataUnsafe.user || {}).first_name || "Telegram"; }
  const q = new URLSearchParams(location.search);
  const scr = q.get("screen"), tab = q.get("tab");
  if (scr && SCREENS[scr]) R = { tab: "more", screen: scr, arg: null };
  else if (tab && NAV_META[tab] && TABVIEWS[tab]) R = { tab, screen: null, arg: null };
  handleInbound().then(() => { render(); tick(); if (inTG && q.get("reg") === "1") startRegistration(); else cloudSyncStart(); });
  setInterval(tick, 1000);
  setInterval(() => toolsTick(false), 100);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
})();
