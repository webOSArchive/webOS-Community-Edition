#!/usr/bin/env python3
"""The Doctor's three background images with the webOS moon where HP's mark was.

    tools/doctor-art/build-doctor-art.py <the OEM Doctor jar>   -> build/doctor-art/

The Doctor (the Java flashing tool) draws every screen over resources/bg1.png, bg2.png or
bg3.png, and HP's round logo is painted into each one, at the left of the strip along the
bottom of the dark panel. There is no separate logo file to swap. So each background is
rebuilt: the mark is painted out with the strip's own colour, row by row (the strip has no
detail there), and the moon from tools/boot-logo/moon-disc.png, the same artwork as the boot
logo, is set in its place, dimmed to sit in the panel as the mark did.

build/harness.py puts the results into the JAR in place of the stock images, and checks the
stock ones against stock.json first, so another OEM jar fails the build instead of getting
art made for this one. Run this again only if the artwork or the placement changes; the
output is committed. Needs Pillow.
"""
import hashlib
import io
import json
import os
import sys
import zipfile

from PIL import Image, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "build", "doctor-art")
MOON = os.path.join(ROOT, "tools", "boot-logo", "moon-disc.png")
NAMES = ("bg1.png", "bg2.png", "bg3.png")
CX, CY = 386, 385        # the centre of HP's mark, the same in all three
ERASE_R = 16             # the mark is 13 px in radius
CLEAN_X = range(410, 440)  # the strip beside the mark, for each row's colour
MOON_SIZE = 30
MOON_BRIGHTNESS = 0.55


def main(jar):
    moon = Image.open(MOON).convert("RGBA").resize((MOON_SIZE, MOON_SIZE), Image.LANCZOS)
    rgb = ImageEnhance.Brightness(moon.convert("RGB")).enhance(MOON_BRIGHTNESS)
    moon = Image.merge("RGBA", (*rgb.split(), moon.split()[3]))
    os.makedirs(OUT, exist_ok=True)
    stock = {}
    with zipfile.ZipFile(jar) as z:
        for name in NAMES:
            raw = z.read("resources/" + name)
            stock[name] = hashlib.sha256(raw).hexdigest()
            im = Image.open(io.BytesIO(raw)).convert("RGBA")
            px = im.load()
            for y in range(CY - ERASE_R, CY + ERASE_R + 1):
                row = tuple(round(sum(px[x, y][c] for x in CLEAN_X) / len(CLEAN_X)) for c in range(4))
                for x in range(CX - ERASE_R, CX + ERASE_R + 1):
                    if (x - CX) ** 2 + (y - CY) ** 2 <= ERASE_R ** 2:
                        px[x, y] = row
            im.alpha_composite(moon, (CX - MOON_SIZE // 2, CY - MOON_SIZE // 2))
            im.save(os.path.join(OUT, name), optimize=True)
            print("wrote", os.path.join("build/doctor-art", name))
    with open(os.path.join(OUT, "stock.json"), "w") as f:
        json.dump({"what": "sha256 of the OEM jar's images these replace", "sha256": stock}, f, indent=1)
        f.write("\n")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
