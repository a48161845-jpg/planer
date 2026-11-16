"use strict";
/* Единый набор линейных иконок (24×24, штрих 1.8). Использование: ic("bell", 20) */
const ICONS = {
  home: '<path d="M4 11.5L12 4.5l8 7"/><path d="M6.2 10.2V19a1 1 0 001 1H10v-5h4v5h2.8a1 1 0 001-1v-8.8"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="3.5"/><path d="M4 10.5h16M8.5 3.5v3.5M15.5 3.5v3.5"/>',
  tasks: '<circle cx="12" cy="12" r="8.5"/><path d="M8.4 12.4l2.5 2.5 4.7-5.2"/>',
  flame: '<path d="M12 3.5c.6 3.2 4.7 4.8 4.7 9.3a4.7 4.7 0 01-9.4 0c0-1.9.9-3.1 1.9-4 .2 1.2.9 1.9 1.8 2 0-2.6-.2-4.6 1-7.3z"/>',
  grid: '<rect x="4.5" y="4.5" width="6" height="6" rx="2"/><rect x="13.5" y="4.5" width="6" height="6" rx="2"/><rect x="4.5" y="13.5" width="6" height="6" rx="2"/><rect x="13.5" y="13.5" width="6" height="6" rx="2"/>',
  bell: '<path d="M6.2 16.5v-5a5.8 5.8 0 0111.6 0v5l1.4 1.8H4.8z"/><path d="M10 20.5a2.2 2.2 0 004 0"/>',
  note: '<path d="M7 4h7.5L19 8.5V19a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z"/><path d="M14.5 4v4.5H19M9 13h6M9 16.5h4"/>',
  cart: '<path d="M3.8 5h2.2l2.1 10h9.3l1.9-7.2H7"/><circle cx="9.8" cy="19" r="1.3"/><circle cx="16.8" cy="19" r="1.3"/>',
  wallet: '<rect x="3.5" y="6" width="17" height="13" rx="3.5"/><path d="M3.5 10.5h17M16 14.6h1.6"/>',
  timer: '<circle cx="12" cy="13.3" r="7"/><path d="M12 9.8v3.8l2.4 1.4M9.5 3.5h5"/>',
  cake: '<path d="M5 12.5h14V19a1 1 0 01-1 1H6a1 1 0 01-1-1z"/><path d="M5 16c2.3 1.4 4.7 1.4 7 0s4.7-1.4 7 0M12 12.5V9M12 6.4v.2"/>',
  drop: '<path d="M12 3.8c3.6 4 6 6.7 6 9.9a6 6 0 01-12 0c0-3.2 2.4-5.9 6-9.9z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r=".7"/>',
  chart: '<path d="M5.5 20v-8M12 20V5M18.5 20v-5"/>',
  book: '<path d="M6.5 4h10.8a.7.7 0 01.7.7V19a1 1 0 01-1 1H7.5a1 1 0 01-1-1z"/><path d="M6.5 16.6H18M9.5 8h5"/>',
  lock: '<rect x="5" y="10.8" width="14" height="9.2" rx="2.8"/><path d="M8.2 10.8V8.2a3.8 3.8 0 017.6 0v2.6"/>',
  hourglass: '<path d="M7 4h10M7 20h10"/><path d="M8 4c0 4 4 4.5 4 8s-4 4-4 8M16 4c0 4-4 4.5-4 8s4 4 4 8"/>',
  sparkles: '<path d="M11 4.5l1.7 4.6 4.6 1.7-4.6 1.7L11 17.1l-1.7-4.6L4.7 10.8l4.6-1.7z"/><path d="M18.3 15.2v3.6M16.5 17h3.6"/>',
  bot: '<rect x="5" y="8.5" width="14" height="10.5" rx="3.6"/><path d="M12 4.5v4M9.4 13v1.4M14.6 13v1.4M3.5 13v2.5M20.5 13v2.5"/>',
  gear: '<circle cx="12" cy="12" r="3.1"/><path d="M12 3.8v2.4M12 17.8v2.4M3.8 12h2.4M17.8 12h2.4M6.2 6.2l1.7 1.7M16.1 16.1l1.7 1.7M17.8 6.2l-1.7 1.7M7.9 16.1l-1.7 1.7"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  check: '<path d="M5.5 12.6l4.3 4.3 8.7-9.4"/>',
  chevron: '<path d="M9.5 6l6 6-6 6"/>',
  back: '<path d="M14.5 6l-6 6 6 6"/>',
  repeat: '<path d="M5 11V9.5A3.5 3.5 0 018.5 6H17l-2.2-2.2M19 13v1.5a3.5 3.5 0 01-3.5 3.5H7l2.2 2.2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  trash: '<path d="M5 7h14M9.8 7V4.8h4.4V7M7 7l.9 12.2a1 1 0 001 .8h6.2a1 1 0 001-.8L17 7"/>',
  edit: '<path d="M5 19l.9-3.9L16.3 4.7a2 2 0 012.8 2.8L8.7 17.9z"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M6 11.5a6 6 0 0012 0M12 17.5v3"/>',
  share: '<path d="M12 15V4.5M8.3 8l3.7-3.7L15.7 8M5.5 13v5.5a1 1 0 001 1h11a1 1 0 001-1V13"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  flag: '<path d="M6 20.5V4.5M6 5h11l-2.4 3.8L17 12.5H6"/>',
  pin: '<path d="M12 20.5v-6M8 4.5h8l-1 6 2.5 3.5h-11L9 10.5z"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17l4.5-4.5 3.5 3.5 2.5-2.5L20 17"/>',
  list: '<path d="M9 7h10M9 12h10M9 17h10"/><circle cx="5.2" cy="7" r=".9"/><circle cx="5.2" cy="12" r=".9"/><circle cx="5.2" cy="17" r=".9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18"/>',
  send: '<path d="M20.5 4L3.8 10.8l6 2.4 2.4 6z"/><path d="M9.8 13.2L20.5 4"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="3.5"/><path d="M4.5 8l7.5 5.5L19.5 8"/>',
  trend: '<path d="M4 16.5l5-5.5 3.5 3.5L20 7"/><path d="M15 7h5v5"/>',
  zap: '<path d="M13 3.5L5.5 13.2h5.2L10 20.5l8-9.9h-5.4z"/>',
  logout: '<path d="M10 4.5H6.5a1 1 0 00-1 1v13a1 1 0 001 1H10M14.5 8l4 4-4 4M18.5 12H9.5"/>',
  user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.6-3.7 3.4-5.6 7-5.6s6.4 1.9 7 5.6"/>'
};
const ic = (name, size = 20, cls = "") =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
/* цветная плитка с иконкой */
const tint = (name, color, size = 40) =>
  `<span class="tint" style="--c:${color};width:${size}px;height:${size}px">${ic(name, Math.round(size * 0.52))}</span>`;
