const CACHE = "planner-v6";
const FILES = [
  "./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./css/style.css",
  "./config.js", "./avatar.png", "./icon-192.png", "./js/core.js", "./js/icons.js", "./js/uicons.js", "./js/logic.js", "./js/tg.js", "./js/forms.js", "./js/main.js", "./js/more.js", "./js/auth.js", "./js/layout.js", "./js/extra.js", "./js/boot.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// сначала сеть (чтобы обновления доходили), при отсутствии сети — кэш
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("./index.html")))
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then(list => {
      if (list.length) return list[0].focus();
      return self.clients.openWindow("./");
    })
  );
});
