"""
Собирает приложение в один HTML-файл (для раздачи ботом по /app).
  python tools/build_single.py                  -> bot/files/planner.html
  python tools/build_single.py --demo out.html  -> версия с примерными данными для просмотра
Если рядом лежит web/avatar.png, он встраивается в файл.
"""
import base64
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")
rd = lambda *p: open(os.path.join(WEB, *p), encoding="utf-8").read()  # noqa: E731

demo = "--demo" in sys.argv
out = sys.argv[sys.argv.index("--demo") + 1] if demo else os.path.join(ROOT, "bot", "files", "planner.html")

html = rd("index.html")
html = html.replace('<link rel="stylesheet" href="css/style.css">', "<style>\n" + rd("css", "style.css") + "\n</style>")
html = html.replace('<link rel="manifest" href="manifest.webmanifest">\n', "")
html = html.replace('<script src="https://telegram.org/js/telegram-web-app.js"></script>\n', "")
html = html.replace('<script src="config.js"></script>', "<script>\n" + rd("config.js") + "\n</script>")
av = os.path.join(WEB, "avatar.png")
av_uri = ("data:image/png;base64," + base64.b64encode(open(av, "rb").read()).decode()) if os.path.isfile(av) else None
for name in ["core", "icons", "uicons", "logic", "tg", "forms", "main", "more", "auth", "layout", "extra", "boot"]:
    js = rd("js", name + ".js")
    assert "</script" not in js.lower(), name
    if av_uri:
        html = html.replace('src="avatar.png"', f'src="{av_uri}"')
        js = js.replace('src="avatar.png"', f'src="{av_uri}"')
    tag = f'<script src="js/{name}.js"></script>'
    assert tag in html, name
    extra = ("\n<script>" + open(os.path.join(ROOT, "tools", "demo.js"), encoding="utf-8").read() + "</script>") if (demo and name == "logic") else ""
    html = html.replace(tag, "<script>\n" + js + "\n</script>" + extra)
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
open(out, "w", encoding="utf-8").write(html)
print(out, len(html), "bytes")
