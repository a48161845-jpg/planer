"""
Иконки приложения: PNG для PWA и (если передан каталог res) значки Android.
  python tools/make_icons.py                  -> web/icon-192.png, web/icon-512.png
  python tools/make_icons.py <android res>    -> ещё и mipmap-* для APK
Если есть web/avatar.png, берётся он, иначе рисуется значок «календарь» на градиенте.
"""
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")
BASE = 1024


def draw_base() -> Image.Image:
    av = os.path.join(WEB, "avatar.png")
    if os.path.isfile(av):
        im = Image.open(av).convert("RGB")
        s = min(im.size)
        im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2))
        return im.resize((BASE, BASE), Image.LANCZOS)
    c1, c2 = (106, 92, 255), (34, 193, 232)
    im = Image.new("RGB", (BASE, BASE))
    px = im.load()
    for y in range(BASE):
        for x in range(BASE):
            t = (x + y) / (2 * BASE - 2)
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([250, 290, 774, 760], radius=96, fill="white")
    d.rectangle([250, 420, 774, 440], fill=(214, 220, 255))
    for x in (380, 644):
        d.rounded_rectangle([x - 22, 230, x + 22, 340], radius=22, fill="white")
    for i, (cx, cy) in enumerate([(380, 540), (512, 540), (644, 540), (380, 650), (512, 650)]):
        d.ellipse([cx - 32, cy - 32, cx + 32, cy + 32], fill=(106, 92, 255) if i != 3 else (34, 193, 232))
    return im


def save(im, size, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.resize((size, size), Image.LANCZOS).save(path)


def circle(im):
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).ellipse([0, 0, im.width - 1, im.height - 1], fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im.convert("RGBA"), (0, 0), m)
    return out


if __name__ == "__main__":
    base = draw_base()
    for s in (192, 512):
        save(base, s, os.path.join(WEB, f"icon-{s}.png"))
    if len(sys.argv) > 1:
        res = sys.argv[1]
        for name, s in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
            d = os.path.join(res, f"mipmap-{name}")
            os.makedirs(d, exist_ok=True)
            small = base.resize((s, s), Image.LANCZOS)
            small.save(os.path.join(d, "ic_launcher.png"))
            small.save(os.path.join(d, "ic_launcher_foreground.png"))
            circle(small).save(os.path.join(d, "ic_launcher_round.png"))
    print("иконки готовы")
