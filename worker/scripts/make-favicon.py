# Draws the gift-box favicon and writes public/favicon.ico (16-64 px) and public/apple-touch-icon.png (180 px).
# Same drawing as the per-store SVG served at /favicon.svg (worker.js), in the platform's navy.
# Usage: python scripts/make-favicon.py
from pathlib import Path
from PIL import Image, ImageDraw

ACCENT = (31, 58, 95, 255)   # #1f3a5f
WHITE = (255, 255, 255, 255)
GOLD = (176, 141, 87, 255)   # #b08d57, the ribbon

def draw(size):
    s = size * 4  # draw large, then shrink for smooth edges
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    u = s / 64  # design grid: 64 x 64, same as the SVG
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=14 * u, fill=ACCENT)
    d.rounded_rectangle([13 * u, 30 * u, 51 * u, 52 * u], radius=3 * u, fill=WHITE)   # box
    d.rounded_rectangle([10 * u, 22 * u, 54 * u, 31 * u], radius=3 * u, fill=WHITE)   # lid
    d.rectangle([29 * u, 22 * u, 35 * u, 52 * u], fill=GOLD)                          # ribbon
    d.ellipse([18 * u, 11 * u, 32 * u, 23 * u], outline=GOLD, width=int(4 * u))       # bow, left
    d.ellipse([32 * u, 11 * u, 46 * u, 23 * u], outline=GOLD, width=int(4 * u))       # bow, right
    return im.resize((size, size), Image.LANCZOS)

out = Path(__file__).resolve().parent.parent / "public"
draw(256).save(out / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
draw(180).convert("RGB").save(out / "apple-touch-icon.png")
print("wrote", out / "favicon.ico", "and", out / "apple-touch-icon.png")
