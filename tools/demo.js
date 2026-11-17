(function () {
  if (!/auth=1/.test(location.search)) S.account = S.account || { mode: "local" };
  if (S.reminders.length || S.tasks.length || S.habits.length || S.notes.length) return;
  const d0 = new Date(), n = Date.now(), p = x => String(x).padStart(2, "0");
  const key = o => { const t = new Date(d0); t.setDate(t.getDate() + o); return t.getFullYear() + "-" + p(t.getMonth() + 1) + "-" + p(t.getDate()); };
  const at = (o, h, m) => { const t = new Date(d0); t.setDate(t.getDate() + o); t.setHours(h, m, 0, 0); return t.getTime(); };
  const id = () => Math.random().toString(36).slice(2, 9);
  S.settings.city = null;
  S.reminders = [
    { id: id(), title: "Созвон с командой", at: n + 55 * 60e3, repeat: "weekdays", days: [], prio: 1, cat: "work", pre: [0, 10], fk: [], done: false },
    { id: id(), title: "Повторить английский", at: at(0, 20, 0), repeat: "daily", days: [], prio: 2, cat: "study", pre: [0], fk: [], done: false },
    { id: id(), title: "Оплатить интернет", at: at(2, 10, 0), repeat: "monthly", days: [], prio: 2, cat: "home", pre: [0, 1440], fk: [], done: false },
    { id: id(), title: "Отправить отчёт", at: at(-1, 17, 0), repeat: "none", days: [], prio: 1, cat: "work", pre: [0], fk: [], done: true, doneAt: n - 3600e3 }
  ];
  S.tasks = [
    { id: id(), title: "Подготовиться к физике", due: key(0), prio: 1, cat: "study", project: "Учёба", repeat: "none", done: false,
      subs: [{ id: id(), t: "Собрать материалы и темы", done: true }, { id: id(), t: "Повторить теорию", done: true }, { id: id(), t: "Решить практические задания", done: false }, { id: id(), t: "Пробный прогон", done: false }] },
    { id: id(), title: "Закончить проект", due: key(0), prio: 1, cat: "work", project: "Проект", repeat: "none", done: false, subs: [] },
    { id: id(), title: "Купить продукты", due: key(0), prio: 3, cat: "home", project: "", repeat: "weekly", done: false, subs: [] },
    { id: id(), title: "Подготовиться к завтра", due: key(0), prio: 2, cat: "life", project: "", repeat: "none", done: true, doneAt: n - 7200e3, subs: [] },
    { id: id(), title: "Записаться к стоматологу", due: key(-2), prio: 2, cat: "life", project: "", repeat: "none", done: false, subs: [] },
    { id: id(), title: "Написать план недели", due: key(1), prio: 2, cat: "work", project: "Проект", repeat: "none", done: false, subs: [] }
  ];
  S.events = [
    { id: id(), title: "Лекция по физике", kind: "event", date: key(0), start: "10:00", end: "11:30", place: "Ауд. 214", cat: "study", yearly: false },
    { id: id(), title: "Встреча по проекту", kind: "event", date: key(1), start: "15:00", end: "16:00", place: "Онлайн", cat: "work", yearly: false },
    { id: id(), title: "Мама", kind: "birthday", date: "1975-" + key(5).slice(5), start: "", end: "", place: "", cat: "life", yearly: true },
    { id: id(), title: "Дедлайн сдачи", kind: "important", date: key(9), start: "", end: "", place: "", cat: "work", yearly: false }
  ];
  S.schedule = [
    { id: id(), day: 1, start: "09:00", end: "10:30", title: "Математика", place: "Ауд. 101", cat: "study" },
    { id: id(), day: 2, start: "11:00", end: "12:30", title: "Английский", place: "Ауд. 305", cat: "study" },
    { id: id(), day: 3, start: "14:00", end: "15:30", title: "Практика", place: "Лаборатория", cat: "work" },
    { id: id(), day: 4, start: "09:00", end: "10:30", title: "Физика", place: "Ауд. 214", cat: "study" },
    { id: id(), day: 5, start: "12:00", end: "13:00", title: "Планёрка", place: "Онлайн", cat: "work" }
  ];
  const lg = (arr) => { const o = {}; arr.forEach(i => { o[key(-i)] = true; }); return o; };
  S.habits = [
    { id: id(), name: "Читать 20 минут", icon: "📖", color: "#5fae8a", goal: { type: "daily", n: 1 }, log: lg([0, 1, 2, 3, 4, 6, 7, 8, 10, 11, 12, 13, 14, 15]), remind: "21:00" },
    { id: id(), name: "Учить английский", icon: "🇬🇧", color: "#5b8def", goal: { type: "daily", n: 1 }, log: lg([1, 2, 3, 5, 6, 8, 9, 12]), remind: "20:00" },
    { id: id(), name: "Тренировка", icon: "🏃", color: "#d1a85b", goal: { type: "week", n: 3 }, log: lg([0, 2, 4, 7, 9, 11]), remind: "" },
    { id: id(), name: "Перерывы от экрана", icon: "☕", color: "#a58bd0", goal: { type: "daily", n: 1 }, log: lg([0, 1, 2, 3, 4, 5, 6]), remind: "" }
  ];
  S.notes = [
    { id: id(), type: "note", title: "Идея для проекта", text: "Добавить интеграцию с Telegram-ботом и сводку недели.\nПроверить офлайн-режим.", items: [], tags: ["идеи", "проект"], pin: true, ts: n - 86400e3, img: null },
    { id: id(), type: "shop", title: "Покупки", text: "", items: [{ t: "Хлеб", done: true }, { t: "Молоко", done: false }, { t: "Яблоки", done: false }, { t: "Кофе", done: false }], tags: [], pin: false, ts: n - 3600e3, img: null },
    { id: id(), type: "check", title: "Подготовка к экзамену", text: "", items: [{ t: "Конспекты", done: true }, { t: "Билеты 1–10", done: true }, { t: "Билеты 11–20", done: false }], tags: ["учёба"], pin: false, ts: n - 5 * 3600e3, img: null }
  ];
  S.tx = [
    { id: id(), type: "in", amt: 45000, cat: "Зарплата", note: "", ts: at(-6, 12, 0) },
    { id: id(), type: "out", amt: 3200, cat: "Еда", note: "Продукты", ts: at(-5, 19, 0) },
    { id: id(), type: "out", amt: 1500, cat: "Транспорт", note: "", ts: at(-3, 9, 0) },
    { id: id(), type: "out", amt: 2400, cat: "Развлечения", note: "Кино", ts: at(-2, 20, 0) },
    { id: id(), type: "out", amt: 780, cat: "Еда", note: "Обед", ts: at(-1, 14, 0) },
    { id: id(), type: "out", amt: 5600, cat: "Дом", note: "Интернет и свет", ts: at(0, 10, 0) }
  ];
  S.budget = 30000;
  S.fgoals = [{ id: id(), name: "Ноутбук", target: 80000, saved: 32000 }];
  S.water = [{ id: id(), ts: at(0, 8, 0), ml: 250 }, { id: id(), ts: at(0, 11, 0), ml: 500 }, { id: id(), ts: at(0, 14, 0), ml: 250 }, { id: id(), ts: at(-1, 12, 0), ml: 1800 }, { id: id(), ts: at(-2, 12, 0), ml: 2100 }];
  S.goals = [{ id: id(), name: "Сдать экзамен", steps: [{ id: id(), t: "Пройти все темы", done: true }, { id: id(), t: "Решить пробный вариант", done: false }, { id: id(), t: "Разобрать ошибки", done: false }] }];
  S.counts = [{ id: id(), name: "Экзамен", date: key(21) }, { id: id(), name: "Отпуск", date: key(64) }];
  S.diary[key(0)] = "Спокойный рабочий день. Успел повторить теорию, вечером планирую английский.";
})();
