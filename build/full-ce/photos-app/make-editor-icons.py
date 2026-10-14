#!/usr/bin/env python3
"""Draws the Photos editor's toolbar icons in the stock icn-*.png style.

    python3 build/full-ce/photos-app/make-editor-icons.py apps/com.palm.app.photos/images

Each is a 32x64 sprite like the stock toolbar icons: the normal state on top (a
white-to-grey glyph with a faint dark edge), the pressed state below (white with a
blue rim and glow, rgb 83,183,255 as in icn-print.png). Glyphs are drawn at 8x and
scaled down.
"""
import math
import sys

from PIL import Image, ImageDraw, ImageFilter

S = 8
N = 32 * S
BLUE = (83, 183, 255)


def rotate_mask(clockwise):
    m = Image.new("L", (N, N), 0)
    d = ImageDraw.Draw(m)
    cx, cy, r, w = N / 2, N / 2 + 8, 84, 22
    a0 = -60  # the arrowhead end; the arc runs on to 200 degrees
    d.arc([cx - r, cy - r, cx + r, cy + r], a0, 200, fill=255, width=w)
    t = math.radians(a0)
    ex, ey = cx + (r - w / 2) * math.cos(t), cy + (r - w / 2) * math.sin(t)
    tx, ty = math.sin(t), -math.cos(t)
    nx, ny = math.cos(t), math.sin(t)
    tip = (ex + tx * 58, ey + ty * 58)
    d.polygon([tip, (ex + nx * 52, ey + ny * 52), (ex - nx * 52, ey - ny * 52)], fill=255)
    # drawn as an anticlockwise arrow; mirrored for clockwise
    return m.transpose(Image.FLIP_LEFT_RIGHT) if clockwise else m


def crop_mask():
    m = Image.new("L", (N, N), 0)
    d = ImageDraw.Draw(m)
    w, lo, hi, ext = 20, 62, 194, 34  # bar width, frame corners, how far the arms overshoot
    d.rectangle([lo - w // 2, lo - ext, lo + w // 2, hi + w // 2], fill=255)
    d.rectangle([lo - w // 2, hi - w // 2, hi + ext, hi + w // 2], fill=255)
    d.rectangle([hi - w // 2, lo - w // 2, hi + w // 2, hi + ext], fill=255)
    d.rectangle([lo - ext, lo - w // 2, hi + w // 2, lo + w // 2], fill=255)
    return m


def sprite(mask):
    m = mask.resize((32, 32), Image.LANCZOS)
    grad = Image.new("RGBA", (32, 32))
    for y in range(32):
        v = int(250 - 60 * y / 31)
        for x in range(32):
            grad.putpixel((x, y), (v, v, v, 255))
    normal = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    normal.paste((40, 40, 40, 255), (0, 0), m.filter(ImageFilter.MaxFilter(3)).point(lambda p: int(p * 0.35)))
    grad.putalpha(m.point(lambda p: int(p * 0.9)))
    normal = Image.alpha_composite(normal, grad)
    pressed = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    glow = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2)).point(lambda p: min(255, int(p * 0.9)))
    pressed.paste(BLUE + (255,), (0, 0), glow)
    pressed.paste(BLUE + (255,), (0, 0), m.filter(ImageFilter.MaxFilter(3)))
    pressed.paste((255, 255, 255, 255), (0, 0), m)
    out = Image.new("RGBA", (32, 64), (0, 0, 0, 0))
    out.paste(normal, (0, 0))
    out.paste(pressed, (0, 32))
    return out


if __name__ == "__main__":
    dest = sys.argv[1]
    sprite(rotate_mask(False)).save(dest + "/icn-rotate-left.png")
    sprite(rotate_mask(True)).save(dest + "/icn-rotate-right.png")
    sprite(crop_mask()).save(dest + "/icn-crop.png")
