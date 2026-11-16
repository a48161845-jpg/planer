"use strict";
/* ============ вход: только через Telegram-бота (или без входа, без синхронизации) ============ */
const CFG = Object.assign({ BOT: "" }, window.CFG || {});
const guest = () => !(S.account && S.account.mode === "tg");
const avatar = () => `<img class="av" src="avatar.png" alt="" onerror="this.remove()">`;
function setAccount(acc) { S.account = acc; save(false); }
function finishAuth(acc) {
  setAccount(acc);
  const a = $("#auth"); a.classList.add("hidden"); a.innerHTML = "";
  render();
}
function logout() {
  if (!confirm("Выйти? Данные на этом устройстве останутся, но синхронизация остановится.")) return;
  S.account = null; save(false); showAuth();
}
function openBot() {
  if (!CFG.BOT) return toast("Укажите имя бота в config.js");
  const url = "https://t.me/" + CFG.BOT.replace(/^@/, "");
  if (inTG && TG.openTelegramLink) TG.openTelegramLink(url); else window.open(url, "_blank");
}
function showAuth() {
  const a = $("#auth"); a.classList.remove("hidden");
  a.innerHTML = `<div class="auth-box"><div class="auth-logo">${ic("calendar", 34)}${avatar()}</div><h1>Планер</h1><p>Дела, время и привычки в одном месте. Данные и напоминания работают через вашего Telegram-бота и синхронизируются по аккаунту Telegram.</p>
    <button class="btn full big" id="aTg">${ic("send", 20)} Войти через Telegram</button>
    <div class="auth-hint" style="margin:10px 0 0">Откройте бота, нажмите /start и «Завершить регистрацию». Дальше приложение узнает вас само.</div>
    <button class="auth-skip" id="aSkip">Продолжить без входа</button>
    <div class="auth-hint" style="margin-top:2px">Без входа синхронизации не будет: данные останутся только на этом устройстве, резервная копия и выгрузка данных недоступны.</div></div>`;
  $("#aTg").onclick = openBot;
  $("#aSkip").onclick = () => { if (confirm("Продолжить без входа? Синхронизации по аккаунту не будет, резервную копию и выгрузку данных сделать нельзя.")) finishAuth({ mode: "local" }); };
}
