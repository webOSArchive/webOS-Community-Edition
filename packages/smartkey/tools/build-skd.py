#!/usr/bin/env python3
"""Build a SmartKey correction dictionary (.skd) from an AOSP LatinIME wordlist.

    build-skd.py <xx_wordlist.combined.gz> <out.skd>

Input: AOSP LatinIME's dictionaries/<lang>_wordlist.combined.gz (Apache-2.0):
    dictionary=main:en_us,locale=en_US,...
     word=the,f=222,flags=,originalFreq=222
      shortcut=I'll,f=whitelist

Output (little-endian, mmap'd read-only by SkDict on the device):
    header   8 x u32: magic 'SKD1', nodeCount, nodesOffset, casedCount, casedOffset,
                      shortCount, shortOffset, stringsOffset
    nodes    nodeCount x 12 bytes, BFS order, children of a node contiguous and sorted by cp:
                 u32 firstChild, u16 cp, u16 childCount, u8 freq, u8 flags, u16 pad
             freq: 0 = not a word end, else f+1 (f = AOSP 0..254)
             flags: 1 offensive, 2 never suggest (f=0 / not_a_word / nonword), 4 cased form
                    in the cased table, 8 capitalized (first letter upper, rest as keyed)
    cased    casedCount x (u32 node, u32 stringOffset), sorted by node: the word's real
             spelling where it has no all-lowercase form (I, Monday, iPhone)
    short    shortCount x (u32 node, u32 stringOffset), sorted by node: whitelist shortcuts
             kept only when they differ from the word by apostrophes or case (im -> I'm)
    strings  NUL-terminated UTF-8

The trie is keyed by the lowercased word. Lowercasing is Python's str.lower(), restricted to
what SkUtf8::toLower folds on the device (Latin-1 + Latin Extended-A + Greek/Cyrillic basics).
"""
import gzip, struct, sys


def parse(path):
    words = {}   # lower -> dict(forms={form: f}, offensive, never)
    shortcuts = {}  # lower -> target
    last = None
    with gzip.open(path, 'rt', encoding='utf-8') as fh:
        for line in fh:
            if line.startswith(' word='):
                fields = {}
                for part in line.strip().split(','):
                    if '=' in part:
                        k, v = part.split('=', 1)
                        fields[k] = v
                w = fields.get('word', '')
                if not w or len(w) > 40:
                    last = None
                    continue
                f = int(fields.get('f', '0') or 0)
                flags = fields.get('flags', '')
                never = fields.get('not_a_word') == 'true' or flags == 'nonword' or f == 0
                lw = w.lower()
                e = words.setdefault(lw, {'forms': {}, 'offensive': False, 'never': True})
                if not never:
                    e['forms'][w] = max(f, e['forms'].get(w, 0))
                    e['never'] = False
                if flags == 'offensive':
                    e['offensive'] = True
                last = (w, lw)
            elif line.startswith('  shortcut=') and last:
                parts = dict(p.split('=', 1) for p in line.strip().split(',') if '=' in p)
                tgt = parts.get('shortcut', '')
                w, lw = last
                if parts.get('f') == 'whitelist' and tgt and \
                        tgt.replace("'", '').replace('’', '').lower() == lw:
                    shortcuts[lw] = tgt
                    # a shortcut source is never itself a suggestion target ("im" in a trie
                    # as a word would make it valid and block the shortcut)
    return words, shortcuts


def build(words, shortcuts):
    # trie over lowercase codepoints
    root = {'c': {}, 'end': None}
    for lw in sorted(set(words) | set(shortcuts)):
        n = root
        for ch in lw:
            n = n['c'].setdefault(ch, {'c': {}, 'end': None})
        n['end'] = lw
    # BFS layout
    order = [root]
    i = 0
    while i < len(order):
        n = order[i]
        n['kids'] = [n['c'][k] for k in sorted(n['c'], key=ord)]
        for k in sorted(n['c'], key=ord):
            n['c'][k]['cp'] = ord(k)
        order.extend(n['kids'])
        i += 1
    index = {id(n): k for k, n in enumerate(order)}
    strings = bytearray()
    soff = {}

    def s(x):
        if x not in soff:
            soff[x] = len(strings)
            strings.extend(x.encode('utf-8') + b'\0')
        return soff[x]

    nodes = bytearray()
    cased, short = [], []
    for k, n in enumerate(order):
        cp = n.get('cp', 0)
        if cp > 0xFFFF:
            cp = 0xFFFD
        first = index[id(n['kids'][0])] if n['kids'] else 0
        freq, flags = 0, 0
        lw = n['end']
        if lw is not None:
            e = words.get(lw)
            if e and not e['never']:
                form, f = max(e['forms'].items(), key=lambda kv: (kv[0] == lw, kv[1]))
                f = max(e['forms'].values())
                freq = min(f, 254) + 1
                if lw not in e['forms']:
                    if form == lw[:1].upper() + lw[1:] and len(lw[:1].upper()) == 1:
                        flags |= 8          # just a capital first letter: no string needed
                    else:
                        flags |= 4
                        cased.append((k, s(form)))
            else:
                flags |= 2
                freq = 1
            if e and e['offensive']:
                flags |= 1
            if lw in shortcuts:
                short.append((k, s(shortcuts[lw])))
        nodes += struct.pack('<IHHBBH', first, cp, len(n['kids']), freq, flags, 0)
    hdr = 32
    nodes_off = hdr
    cased_off = nodes_off + len(nodes)
    short_off = cased_off + 8 * len(cased)
    str_off = short_off + 8 * len(short)
    out = bytearray(struct.pack('<4sIIIIIII', b'SKD1', len(order), nodes_off, len(cased),
                                cased_off, len(short), short_off, str_off))
    out += nodes
    for a, b in sorted(cased):
        out += struct.pack('<II', a, b)
    for a, b in sorted(short):
        out += struct.pack('<II', a, b)
    out += strings
    return out, len(order), len(cased), len(short)


def main():
    words, shortcuts = parse(sys.argv[1])
    data, nn, nc, ns = build(words, shortcuts)
    with open(sys.argv[2], 'wb') as fh:
        fh.write(data)
    print('%s: %d words, %d nodes, %d cased, %d shortcuts, %d bytes' %
          (sys.argv[2], len(words), nn, nc, ns, len(data)))


if __name__ == '__main__':
    main()
