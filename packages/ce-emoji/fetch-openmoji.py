#!/usr/bin/env python3
"""Fetch the OpenMoji colour PNGs CE uses, at a pinned OpenMoji release.

    fetch-openmoji.py <list.txt> <outdir> [size]

<list.txt> holds emoji (whitespace-separated, # comments). Each is saved as <outdir>/<HEX>.png,
HEX being its code points in upper-case hex joined by '-' with U+FE0F dropped: one name per
emoji whichever form the text arrives in. OpenMoji names some files with FE0F and some without,
so both are tried.

OpenMoji (https://openmoji.org) is CC BY-SA 4.0: ship ATTRIBUTION.txt with the images.
"""
import os, sys, urllib.request

OPENMOJI_TAG = '17.0.0'
BASE = 'https://raw.githubusercontent.com/hfg-gmuend/openmoji/%s/color/%s/%s.png'


def hexname(e, keep_fe0f):
    cps = [ord(c) for c in e if keep_fe0f or ord(c) != 0xFE0F]
    return '-'.join('%X' % c for c in cps)


def main():
    src, out = sys.argv[1], sys.argv[2]
    size = sys.argv[3] if len(sys.argv) > 3 else '72x72'
    os.makedirs(out, exist_ok=True)
    emoji = [e for l in open(src, encoding='utf-8') if l.strip() and not l.lstrip().startswith('#')
             for e in l.split()]
    missing = []
    for e in emoji:
        dest = os.path.join(out, hexname(e, False) + '.png')
        if os.path.exists(dest):
            continue
        for name in dict.fromkeys([hexname(e, True), hexname(e, False)]):
            try:
                data = urllib.request.urlopen(BASE % (OPENMOJI_TAG, size, name), timeout=30).read()
            except Exception:
                continue
            with open(dest, 'wb') as fh:
                fh.write(data)
            break
        else:
            missing.append(e)
    print('%d emoji, %d missing %s' % (len(emoji), len(missing), ' '.join(missing)))
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main())
