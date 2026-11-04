#!/usr/bin/env python3
"""Build CE-Emoji.ttf: Noto Emoji (monochrome) for the TouchPad's 2010 text stack.

    python3 make-font.py          (needs fontTools; writes CE-Emoji.ttf + codepoints.txt)

The output is committed; bake.py only checks its md5, so the bake stays offline.

1. Static Regular (wght 400): the device's FreeType 2.3 can't read variable fonts.
2. Every emoji the font has keeps its real mapping, in both the format-4 (BMP) and the
   format-12 (full Unicode) cmap. Qt (LunaSysMgr's banners, titles) reads format 12 and
   draws astral emoji such as 😀 properly.
3. WebKit (libPiranha) can't: its text path is 16-bit, so 😀 reaches the font as two
   separate code units, the surrogates D83D and DE00, looked up one at a time
   (Docs/EMOJI-FONT.md §1). So the cmap also maps
     - the high surrogates D83C/D83D/D83E -> an empty zero-width glyph, and
     - each low surrogate DC00-DFFF -> the glyph of the emoji it ends.
   With those, 😀 draws as 😀 in every web view and text field.
   A low surrogate alone is ambiguous: DE00 ends U+1F200, U+1F600 and U+1FA00. Where
   several emoji share one, the winner is: an emoji on the CE keyboard, else the first
   block in BLOCK_ORDER. The others draw as the winner's glyph in web views
   (e.g. 🈁 as 😁). keyboard-emoji.txt avoids emoji whose loser is common (🔍 🔒).
"""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._c_m_a_p import CmapSubtable
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'NotoEmoji[wght].ttf')
OUT = os.path.join(HERE, 'CE-Emoji.ttf')
KEYBOARD = os.path.join(HERE, '..', '..', '..', 'packages', 'ce-emoji', 'keyboard-emoji.txt')
# for a shared low surrogate, earlier blocks (U+1Fxx00..U+1FxxFF) win
BLOCK_ORDER = [0x1F6, 0x1F4, 0x1F3, 0x1F5, 0x1F9, 0x1F1, 0x1F2, 0x1F0, 0x1F7, 0x1FA, 0x1F8, 0x1FB]


def keyboard_codepoints():
    cps = set()
    for line in open(KEYBOARD, encoding='utf-8'):
        if line.strip() and not line.lstrip().startswith('#'):
            for e in line.split():
                cps.add(ord(e[0]))
    return cps


def main():
    font = TTFont(SRC)
    instancer.instantiateVariableFont(font, {'wght': 400}, inplace=True)
    for tag in ('fvar', 'gvar', 'HVAR', 'VVAR', 'STAT', 'avar', 'MVAR'):
        if tag in font:
            del font[tag]
    cmap = dict(font.getBestCmap())
    empty = cmap[0x200D]                        # empty, zero advance
    assert font['hmtx'][empty][0] == 0
    kb = keyboard_codepoints()

    surrogates = {0xD83C: empty, 0xD83D: empty, 0xD83E: empty}
    winners = {}
    for cp in cmap:
        if not 0x1F000 <= cp < 0x20000 or (cp - 0x1F000) // 0x400 > 2:
            continue
        low = 0xDC00 + (cp - 0x1F000) % 0x400
        rank = (0 if cp in kb else 1, BLOCK_ORDER.index(cp >> 8))
        if low not in winners or rank < winners[low][0]:
            winners[low] = (rank, cp)
    for low, (_, cp) in winners.items():
        surrogates[low] = cmap[cp]

    full = dict(cmap)
    full.update(surrogates)
    bmp = {c: g for c, g in full.items() if c <= 0xFFFF}
    tables = []
    for pid, eid, fmt, mapping in ((0, 3, 4, bmp), (3, 1, 4, bmp), (0, 4, 12, full), (3, 10, 12, full)):
        t = CmapSubtable.newSubtable(fmt)
        t.platformID, t.platEncID, t.language = pid, eid, 0
        t.cmap = mapping
        tables.append(t)
    font['cmap'].tables = tables
    # the family stays "Noto Emoji": LunaCE's Qt fallback hook (QtEmojiFallback.cpp) names it
    font.save(OUT)

    kb_bad = [chr(c) for c in sorted(kb) if c >= 0x1F000 and winners.get(0xDC00 + (c - 0x1F000) % 0x400, (0, c))[1] != c]
    with open(os.path.join(HERE, 'codepoints.txt'), 'w') as fh:
        for c in sorted(cmap):
            fh.write('%04X\n' % c)
    print('%s: %d bytes, %d code points (+%d surrogate mappings); keyboard emoji not shown as themselves: %s'
          % (OUT, os.path.getsize(OUT), len(cmap), len(surrogates), ''.join(kb_bad) or 'none'))


if __name__ == '__main__':
    main()
