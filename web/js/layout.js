"use strict";
/* ============ настройка внешнего вида: нижнее меню и главный экран ============ */
const swap = (arr, i, j) => { if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
const arrow = (cls, i, rot, label) => `<button class="ibtn sm" data-${cls}="${i}" aria-label="${label}"><span style="display:flex;transform:rotate(${rot}deg)">${ic("back", 16)}</span></button>`;

function homeLayoutSheet() {
  const ws = S.settings.widgets;
  const draw = () => sheet("Главный экран", `<div class="meta" style="margin:0 4px 10px">Включайте нужные блоки и меняйте их порядок стрелками.</div>
    <div class="group">${ws.map((w, i) => `<div class="card li" data-i="${i}"><div class="grow title" style="${w.on ? "" : "opacity:.5"}">${esc(WIDGET_DEF.find(d => d[0] === w.id)[1])}</div>${arrow("up", i, 90, "Выше")}${arrow("dn", i, -90, "Ниже")}<input type="checkbox" data-on="${i}" ${w.on ? "checked" : ""} aria-label="Показывать"></div>`).join("")}</div>
    <div class="grid2" style="margin-top:14px"><button class="btn sec" id="lyReset">Сбросить</button><button class="btn" id="lyOk">Готово</button></div>`, root => {
    $$("[data-up]", root).forEach(b => b.onclick = () => { const i = +b.dataset.up; swap(ws, i, i - 1); save(false); draw(); });
    $$("[data-dn]", root).forEach(b => b.onclick = () => { const i = +b.dataset.dn; swap(ws, i, i + 1); save(false); draw(); });
    $$("[data-on]", root).forEach(c => c.onchange = () => { ws[+c.dataset.on].on = c.checked; save(false); draw(); });
    $("#lyReset").onclick = () => { S.settings.widgets = WIDGET_DEF.map(d => ({ id: d[0], on: d[2] })); save(false); closeSheet(); render(); };
    $("#lyOk").onclick = () => { closeSheet(); render(); };
  });
  draw();
}

function navLayoutSheet() {
  const nav = S.settings.nav, MAX = 5;
  const draw = () => {
    const rest = Object.keys(NAV_META).filter(id => !nav.includes(id));
    sheet("Нижнее меню", `<div class="meta" style="margin:0 4px 10px">До ${MAX} разделов плюс «Ещё». Остальные разделы доступны через «Ещё» и главный экран.</div>
      <div class="group">${nav.map((id, i) => `<div class="card li">${tint(NAV_META[id][1], "var(--accent)", 36)}<div class="grow title">${NAV_META[id][0]}</div>${arrow("up", i, 90, "Выше")}${arrow("dn", i, -90, "Ниже")}<button class="ibtn sm" data-rm="${i}" aria-label="Убрать" ${nav.length <= 2 ? "disabled" : ""}>${ic("x", 15)}</button></div>`).join("")}</div>
      <h2>Добавить${nav.length >= MAX ? ` <span style="font-weight:400">— меню заполнено</span>` : ""}</h2>
      <div class="chips">${rest.map(id => `<span class="chip" data-add="${id}" style="${nav.length >= MAX ? "opacity:.4" : ""}">${NAV_META[id][0]}</span>`).join("")}</div>
      <div class="grid2" style="margin-top:14px"><button class="btn sec" id="lyReset">Сбросить</button><button class="btn" id="lyOk">Готово</button></div>`, root => {
      $$("[data-up]", root).forEach(b => b.onclick = () => { const i = +b.dataset.up; swap(nav, i, i - 1); save(false); draw(); });
      $$("[data-dn]", root).forEach(b => b.onclick = () => { const i = +b.dataset.dn; swap(nav, i, i + 1); save(false); draw(); });
      $$("[data-rm]", root).forEach(b => b.onclick = () => { if (nav.length > 2) { nav.splice(+b.dataset.rm, 1); save(false); draw(); } });
      $$("[data-add]", root).forEach(c => c.onclick = () => { if (nav.length >= MAX) return toast("Максимум " + MAX + " разделов"); nav.push(c.dataset.add); save(false); draw(); });
      $("#lyReset").onclick = () => { S.settings.nav = def().settings.nav; save(false); closeSheet(); render(); };
      $("#lyOk").onclick = () => { closeSheet(); render(); };
    });
  };
  draw();
}
