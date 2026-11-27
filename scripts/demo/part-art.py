#!/usr/bin/env python3
"""
Draws an original illustration for a demo part.

These are simple mechanical shapes drawn from scratch with Pillow — pistons,
sprockets, brake discs and so on — so the demo catalogue has pictures without
using anyone else's photography. Real photographs replace them through the
admin panel.

Usage: part-art.py <category-slug> <seed-text> <out.webp>
"""
import hashlib
import math
import sys

from PIL import Image, ImageDraw

W, H = 1200, 900
BG = (247, 245, 240)
STEEL_DARK = (74, 78, 84)
STEEL = (138, 144, 152)
STEEL_LIGHT = (196, 201, 208)
BRASS = (176, 137, 72)
BRASS_LIGHT = (214, 180, 116)
SHADOW = (214, 211, 203)


def rng(seed_text: str):
    """Small deterministic generator, so a part always draws the same."""
    h = hashlib.sha256(seed_text.encode()).digest()
    i = 0

    def nxt(lo: float, hi: float) -> float:
        nonlocal i
        v = h[i % len(h)] / 255
        i += 1
        return lo + v * (hi - lo)

    return nxt


def base():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.ellipse([W // 2 - 300, H - 170, W // 2 + 300, H - 90], fill=SHADOW)
    return img, d


def ring(d, cx, cy, r, width, fill, outline=STEEL_DARK):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill, outline=outline, width=6)
    d.ellipse([cx - r + width, cy - r + width, cx + r - width, cy + r - width],
              fill=BG, outline=outline, width=6)


def sprocket(d, nxt):
    cx, cy, r = W // 2, H // 2, 290
    teeth = int(nxt(18, 30))
    pts = []
    for i in range(teeth * 2):
        a = (i / (teeth * 2)) * 2 * math.pi
        rad = r if i % 2 == 0 else r - 40
        pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
    d.polygon(pts, fill=STEEL, outline=STEEL_DARK)
    ring(d, cx, cy, 150, 48, STEEL_LIGHT)
    for i in range(6):
        a = (i / 6) * 2 * math.pi
        d.ellipse([cx + 190 * math.cos(a) - 28, cy + 190 * math.sin(a) - 28,
                   cx + 190 * math.cos(a) + 28, cy + 190 * math.sin(a) + 28],
                  fill=BG, outline=STEEL_DARK, width=5)


def piston(d, nxt):
    cx, cy = W // 2, H // 2
    w, h = 300, 330
    d.rounded_rectangle([cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2], 26,
                        fill=STEEL_LIGHT, outline=STEEL_DARK, width=7)
    for i in range(3):
        y = cy - h // 2 + 56 + i * 34
        d.rectangle([cx - w // 2, y, cx + w // 2, y + 14], fill=STEEL, outline=STEEL_DARK, width=4)
    d.rectangle([cx - 34, cy + h // 2 - 10, cx + 34, cy + h // 2 + 150],
                fill=STEEL, outline=STEEL_DARK, width=6)
    d.ellipse([cx - 64, cy + h // 2 + 110, cx + 64, cy + h // 2 + 210],
              fill=STEEL_LIGHT, outline=STEEL_DARK, width=6)


def disc(d, nxt):
    cx, cy, r = W // 2, H // 2, 300
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=STEEL_LIGHT, outline=STEEL_DARK, width=8)
    d.ellipse([cx - r + 60, cy - r + 60, cx + r - 60, cy + r - 60], outline=STEEL, width=4)
    holes = int(nxt(8, 14))
    for i in range(holes):
        a = (i / holes) * 2 * math.pi
        hx, hy = cx + (r - 110) * math.cos(a), cy + (r - 110) * math.sin(a)
        d.ellipse([hx - 22, hy - 22, hx + 22, hy + 22], fill=BG, outline=STEEL_DARK, width=4)
    ring(d, cx, cy, 120, 40, STEEL)


def gasket(d, nxt):
    cx, cy, r = W // 2, H // 2, 280
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BRASS_LIGHT, outline=BRASS, width=8)
    d.ellipse([cx - 160, cy - 160, cx + 160, cy + 160], fill=BG, outline=BRASS, width=8)
    bolts = int(nxt(6, 10))
    for i in range(bolts):
        a = (i / bolts) * 2 * math.pi
        bx, by = cx + (r - 50) * math.cos(a), cy + (r - 50) * math.sin(a)
        d.ellipse([bx - 20, by - 20, bx + 20, by + 20], fill=BG, outline=BRASS, width=5)


def bulb(d, nxt):
    cx, cy = W // 2, H // 2 - 40
    d.ellipse([cx - 170, cy - 170, cx + 170, cy + 170], fill=(252, 250, 243), outline=STEEL_DARK, width=7)
    d.polygon([(cx - 60, cy + 120), (cx + 60, cy + 120), (cx + 48, cy + 300), (cx - 48, cy + 300)],
              fill=BRASS_LIGHT, outline=BRASS)
    for i in range(4):
        y = cy + 150 + i * 34
        d.line([(cx - 56, y), (cx + 56, y)], fill=BRASS, width=7)
    d.line([(cx - 40, cy + 40), (cx - 15, cy - 50), (cx + 15, cy + 40), (cx + 40, cy - 50)],
           fill=STEEL_DARK, width=7)


def filter_part(d, nxt):
    cx, cy = W // 2, H // 2
    w, h = 330, 300
    d.rounded_rectangle([cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2], 18,
                        fill=(238, 232, 214), outline=STEEL_DARK, width=7)
    pleats = int(nxt(9, 15))
    for i in range(pleats):
        x = cx - w // 2 + 20 + i * ((w - 40) / pleats)
        d.line([(x, cy - h // 2 + 14), (x, cy + h // 2 - 14)], fill=BRASS, width=6)
    d.rectangle([cx - w // 2 - 22, cy - h // 2 - 26, cx + w // 2 + 22, cy - h // 2 + 6],
                fill=STEEL, outline=STEEL_DARK, width=5)
    d.rectangle([cx - w // 2 - 22, cy + h // 2 - 6, cx + w // 2 + 22, cy + h // 2 + 26],
                fill=STEEL, outline=STEEL_DARK, width=5)


def shock(d, nxt):
    cx, cy = W // 2, H // 2
    d.ellipse([cx - 44, cy - 330, cx + 44, cy - 250], fill=STEEL_LIGHT, outline=STEEL_DARK, width=6)
    d.rectangle([cx - 24, cy - 290, cx + 24, cy - 140], fill=STEEL, outline=STEEL_DARK, width=5)
    coils = int(nxt(7, 11))
    for i in range(coils):
        y = cy - 140 + i * (300 / coils)
        d.ellipse([cx - 110, y - 26, cx + 110, y + 42], outline=BRASS, width=16)
    d.rectangle([cx - 36, cy + 190, cx + 36, cy + 270], fill=STEEL, outline=STEEL_DARK, width=5)
    d.ellipse([cx - 44, cy + 250, cx + 44, cy + 330], fill=STEEL_LIGHT, outline=STEEL_DARK, width=6)


def mirror_panel(d, nxt):
    cx, cy = W // 2, H // 2
    d.rounded_rectangle([cx - 250, cy - 200, cx + 250, cy + 150], 70,
                        fill=STEEL_LIGHT, outline=STEEL_DARK, width=8)
    d.rounded_rectangle([cx - 200, cy - 155, cx + 200, cy + 105], 54, fill=(228, 233, 238), outline=STEEL, width=5)
    d.rectangle([cx - 26, cy + 140, cx + 26, cy + 300], fill=STEEL, outline=STEEL_DARK, width=5)


def bearing(d, nxt):
    cx, cy = W // 2, H // 2
    d.ellipse([cx - 290, cy - 290, cx + 290, cy + 290], fill=STEEL_LIGHT, outline=STEEL_DARK, width=8)
    d.ellipse([cx - 215, cy - 215, cx + 215, cy + 215], fill=BG, outline=STEEL_DARK, width=6)
    balls = int(nxt(8, 13))
    for i in range(balls):
        a = (i / balls) * 2 * math.pi
        bx, by = cx + 252 * math.cos(a), cy + 252 * math.sin(a)
        d.ellipse([bx - 30, by - 30, bx + 30, by + 30], fill=STEEL, outline=STEEL_DARK, width=4)
    d.ellipse([cx - 140, cy - 140, cx + 140, cy + 140], fill=STEEL, outline=STEEL_DARK, width=6)
    d.ellipse([cx - 80, cy - 80, cx + 80, cy + 80], fill=BG, outline=STEEL_DARK, width=5)


DRAWINGS = {
    "engine-parts": piston,
    "clutch-and-transmission": sprocket,
    "braking-system": disc,
    "electrical-components": bulb,
    "body-parts": mirror_panel,
    "lighting-and-indicators": bulb,
    "suspension": shock,
    "accessories": mirror_panel,
    "other-parts": gasket,
}

KEYWORD_DRAWINGS = [
    ("filter", filter_part),
    ("gasket", gasket),
    ("bearing", bearing),
    ("sprocket", sprocket),
    ("chain", sprocket),
    ("piston", piston),
    ("disc", disc),
    ("brake", disc),
    ("bulb", bulb),
    ("lamp", bulb),
    ("shock", shock),
    ("mirror", mirror_panel),
    ("seal", gasket),
]


def pick(category: str, name: str):
    low = name.lower()
    for word, fn in KEYWORD_DRAWINGS:
        if word in low:
            return fn
    return DRAWINGS.get(category, gasket)


def main() -> int:
    category, seed_text, out = sys.argv[1], sys.argv[2], sys.argv[3]
    img, d = base()
    pick(category, seed_text)(d, rng(seed_text))
    img.save(out, "WEBP", quality=82, method=4)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
