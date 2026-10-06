#!/usr/bin/env python3
"""Generate PWA icons for RDx Civil QM.

Navy background (#1e3a5f) with a white lab-flask motif and amber accent.
Outputs into client/public/: icon-192.png, icon-512.png, apple-touch-icon.png
Run: python3 scripts/generate_pwa_icons.py
"""

import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("Pillow is required: apt-get install -y python3-pil (or pip install pillow)")

BG = (30, 58, 95)      # #1e3a5f app navy
AMBER = (245, 158, 11)  # #f59e0b app accent
WHITE = (255, 255, 255)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "client", "public"))


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    cx = size // 2

    # Flask body: triangle-ish polygon
    s = size / 512.0
    flask = [
        (cx - 40 * s, 150 * s),
        (cx + 40 * s, 150 * s),
        (cx + 40 * s, 200 * s),
        (cx + 110 * s, 360 * s),
        (cx - 110 * s, 360 * s),
        (cx - 40 * s, 200 * s),
    ]
    d.polygon(flask, outline=WHITE, width=max(2, int(14 * s)))
    # Flask neck
    d.rectangle([cx - 40 * s, 120 * s, cx + 40 * s, 150 * s], outline=WHITE, width=max(2, int(14 * s)))
    # Liquid
    liquid = [
        (cx - 88 * s, 360 * s),
        (cx + 88 * s, 360 * s),
        (cx + 40 * s, 235 * s),
        (cx - 40 * s, 235 * s),
    ]
    d.polygon(liquid, fill=AMBER)
    # Bubbles
    for bx, by, br in [(0.44, 0.62, 0.02), (0.55, 0.68, 0.028), (0.5, 0.56, 0.016)]:
        d.ellipse(
            [size * (bx - br), size * (by - br), size * (bx + br), size * (by + br)],
            fill=WHITE,
        )
    return img


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
        draw_icon(size).save(os.path.join(OUT_DIR, name), "PNG")
        print("wrote", name)


if __name__ == "__main__":
    main()
