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
const ID_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genId() { const r = new Uint8Array(6); crypto.getRandomValues(r); return "PL-" + [...r].map(x => ID_ABC[x % ID_ABC.length]).join(""); }
function ensureId() { if (!S.appId) { S.appId = genId(); save(false); } return S.appId; }
function regCommand() { return `/reg ${ensureId()} ${-new Date().getTimezoneOffset()} ${deviceZone()}`.trim(); }
function openBot() {
  if (!CFG.BOT) return toast("Укажите имя бота в config.js");
  const url = "https://t.me/" + CFG.BOT.replace(/^@/, "");
  if (inTG && TG.openTelegramLink) TG.openTelegramLink(url); else window.open(url, "_blank");
}
function parseToken(t) {
  try {
    t = (t || "").trim().replace(/^`+|`+$/g, "");
    if (!t.startsWith("K1.")) return null;
    const o = JSON.parse(new TextDecoder().decode(unb64u(t.slice(3))));
    return o && o.a === S.appId && o.u ? o : null;
  } catch (e) { return null; }
}
function showAuth() {
  ensureId();
  const a = $("#auth"); a.classList.remove("hidden");
  a.innerHTML = `<div class="auth-box"><div class="auth-logo">${ic("calendar", 34)}${avatar()}</div><h1>Планер</h1><p>Регистрация идёт только текстом в чате с ботом — никаких переходов на сайты.</p>
    <div class="idcard"><span>Ваш ID в приложении</span><b>${S.appId}</b></div>
    <ol class="steps"><li>Нажмите «Скопировать команду».</li><li>Вставьте её в чат с ботом и отправьте. Бот запомнит ваш ID.</li><li>Бот ответит кодом — вставьте его ниже.</li></ol>
    <div class="grid2"><button class="btn" id="aCopy">Скопировать команду</button><button class="btn sec" id="aBot">${ic("send", 18)} Открыть бота</button></div>
    <input id="aTok" placeholder="Код от бота (K1.…)" autocomplete="off" style="margin-top:12px">
    <button class="btn full big" id="aGo" style="margin-top:8px">Подтвердить</button>
    <button class="auth-skip" id="aSkip">Продолжить без входа</button>
    <div class="auth-hint" style="margin-top:2px">Без входа синхронизации не будет: данные останутся только на этом устройстве, резервная копия и выгрузка данных недоступны.</div></div>`;
  $("#aCopy").onclick = async () => toast((await copyText(regCommand())) ? "Команда скопирована — вставьте в чат с ботом" : regCommand());
  $("#aBot").onclick = openBot;
  $("#aGo").onclick = () => { const o = parseToken($("#aTok").value); if (!o) return toast("Код не подходит: проверьте, что копируете ответ бота для этого ID"); finishAuth({ mode: "tg", via: "id", tgId: o.u, name: o.n || "" }); toast("Вход выполнен"); };
  $("#aSkip").onclick = () => { if (confirm("Продолжить без входа? Синхронизации по аккаунту не будет, резервную копию и выгрузку данных сделать нельзя.")) finishAuth({ mode: "local" }); };
}
