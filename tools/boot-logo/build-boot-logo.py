#!/usr/bin/env python3
"""Builds CE's boot logo files from the artwork in this folder.

    tools/boot-logo/build-boot-logo.py

Inputs, both 200x200 on black with the disc at the same place in each:
    moon-dim.png      the resting logo
    moon-bright.png   the same logo lit, with its glow

Outputs, which bake.py puts in the image:
    system/usr/palm/sysmgr/images/hp-logo.png          LunaSysMgr's boot logo
    system/usr/palm/sysmgr/images/hp-logo-bright.png   cross-faded over it to pulse
    system/boot/boot-images/BootLogo.tga               bootie's logo (NVRAM logo-boot)
    build/full-ce/deviceinfo/about/ce-about-moon.png   Device Info's About scene

The disc is scaled to DISC_PX, the stock HP badge's size, and centred. LunaSysMgr
draws both PNGs centred and fades the bright one in and out over the dim one
(BootupAnimation::renderInStateLogo), so the glow is whatever differs between
them. The file names stay hp-logo*: they are compiled into LunaSysMgr.

bootie draws its logo unrotated on the portrait panel before LunaSysMgr starts,
so the TGA is the dim PNG turned 90 degrees counter-clockwise -- stock's
BootLogo.tga is exactly stock's hp-logo.png turned that way. Its encoding copies
stock's too (32-bit RLE, bottom-left origin, opaque alpha); bootie's parser has
only been tried with that.

The About scene sits on a light page, so its copy is the dim disc alone, cut out
with a transparent background. Needs Pillow.
"""
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DISC_PX = 70.0   # stock badge: 69 x 71
CANVAS = 200
LIT = 24         # above this a pixel is part of the artwork, not the background
ABOUT_PX = 96    # the About scene's moon


def bbox(im):
    return im.convert("L").point(lambda v: 255 if v > LIT else 0).getbbox()


def main():
    dim = Image.open(os.path.join(HERE, "moon-dim.png")).convert("RGB")
    bright = Image.open(os.path.join(HERE, "moon-bright.png")).convert("RGB")
    if dim.size != bright.size or dim.size[0] != dim.size[1]:
        sys.exit("ERROR: the two source images must be the same square size")
    l, t, r, b = bbox(dim)
    k = DISC_PX / (((r - l) + (b - t)) / 2.0)
    n = round(dim.size[0] * k)
    ox = round(CANVAS / 2 - (l + r) / 2.0 * k)
    oy = round(CANVAS / 2 - (t + b) / 2.0 * k)
    if ox < 0 or oy < 0 or ox + n > CANVAS or oy + n > CANVAS:
        sys.exit("ERROR: the scaled artwork does not fit the 200x200 canvas")

    out = {}
    for name, im in (("hp-logo.png", dim), ("hp-logo-bright.png", bright)):
        edge = im.convert("L")
        w = edge.size[0] - 1
        worst = max(max(edge.getpixel((i, 0)), edge.getpixel((i, w)),
                        edge.getpixel((0, i)), edge.getpixel((w, i))) for i in range(w + 1))
        if worst > LIT:
            sys.exit(f"ERROR: {name}'s source is lit at its edge ({worst}); the glow "
                     f"would be cut off in a straight line. Enlarge the source canvas.")
        c = Image.new("RGB", (CANVAS, CANVAS))
        c.paste(im.resize((n, n), Image.LANCZOS), (ox, oy))
        p = os.path.join(ROOT, "system/usr/palm/sysmgr/images", name)
        c.save(p, optimize=True)
        out[name] = c
        print(f"{os.path.relpath(p, ROOT)}: lit area {bbox(c)}")

    tga = out["hp-logo.png"].transpose(Image.ROTATE_90).convert("RGBA")
    p = os.path.join(ROOT, "system/boot/boot-images/BootLogo.tga")
    tga.save(p, compression="tga_rle", orientation=-1)
    print(f"{os.path.relpath(p, ROOT)}: {os.path.getsize(p)} bytes")

    # The disc alone for the About scene. The mask is drawn 8x and scaled down
    # for a smooth edge, and sits a pixel inside the disc so no black rim shows.
    ss = 8
    mask = Image.new("L", (dim.size[0] * ss, dim.size[1] * ss), 0)
    ImageDraw.Draw(mask).ellipse([(l + 1) * ss, (t + 1) * ss, (r - 1) * ss - 1, (b - 1) * ss - 1],
                                 fill=255)
    cut = dim.convert("RGBA")
    cut.putalpha(mask.resize(dim.size, Image.LANCZOS))
    cut = cut.crop((l, t, r, b)).resize((ABOUT_PX, ABOUT_PX), Image.LANCZOS)
    p = os.path.join(ROOT, "build/full-ce/deviceinfo/about/ce-about-moon.png")
    cut.save(p, optimize=True)
    print(f"{os.path.relpath(p, ROOT)}: {cut.size[0]}x{cut.size[1]}, {os.path.getsize(p)} bytes")


if __name__ == "__main__":
    main()
