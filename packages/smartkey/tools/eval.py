#!/usr/bin/env python3
"""Score the corrector against smartkey-hun's Hunspell-first behaviour.

    eval.py --skcli BIN --skd en_US.skd --aff en_US.aff --dic en_US.dic \
            --wordlist en_US_wordlist.combined.gz --wiki wiki-misspell.txt [param=value ...]

Three test sets, all deterministic (fixed seed):
  touch   synthetic touchscreen typos of words drawn by frequency: a neighbouring key (50%),
          a missed letter (20%), an extra neighbouring or doubled tap (15%), two letters
          swapped (10%), any other key (5%). Biased toward this engine's own keyboard model.
  wiki    Wikipedia's "Lists of common misspellings/For machines": spelling errors, not typos.
  clean   words that must be left alone: frequent words drawn by frequency, plus names,
          brands and slang no dictionary has (CLEAN_OOV).
For typo sets: fixed = became the intended word, wrong = became another word, kept = unchanged.
For clean: damaged = changed at all.
"""
import argparse, gzip, math, os, random, subprocess, sys

ROWS = [("qwertyuiop", 0.0), ("asdfghjkl", 0.25), ("zxcvbnm", 0.75)]
POS = {ch: (x + off, y) for y, (row, off) in enumerate(ROWS) for x, ch in enumerate(row)}

CLEAN_OOV = """webOS Preware TouchPad Kubernetes jonwise codepoet Herrie LuneOS Lunacy Enyo Mojo
Synergy novacom ipkg luna-send Pixel Fold3 BlueBubbles WhatsApp Spotify Netflix YouTube
GitHub Reddit Zoho Ubuntu Debian Raspbian Arduino Wireguard Tailscale Nextcloud Mastodon
lol omg tbh idk brb btw imo ngl smh lmao gotta wanna kinda dunno yeah nah yep nope okay
Siobhan Aoife Niamh Saoirse Tadhg Oisin Ximena Thiago Mateo Anaya Priya Arjun Kenji Haruto
Yusuf Oluwaseun Chidi Ngozi Bartholomew Maximilian Giuseppe Wojciech Zbigniew Krzysztof
Brisbane Kalgoorlie Wollongong Saskatoon Kelowna Albuquerque Tucson Boise Spokane Duluth
quinoa kombucha matcha sriracha gochujang tzatziki shawarma pho ramen bao
async refactor dockerfile kubectl nginx systemd regex localhost wifi bluetooth hotspot
emoji hashtag selfie podcast livestream unfollow retweet screenshot""".split()


def load_words(path):
    words = []
    with gzip.open(path, 'rt', encoding='utf-8') as fh:
        for line in fh:
            if not line.startswith(' word='):
                continue
            parts = dict(p.split('=', 1) for p in line.strip().split(',') if '=' in p)
            w, f = parts.get('word', ''), int(parts.get('f', '0') or 0)
            if f >= 60 and w.isalpha() and w.islower() and w.isascii() and len(w) >= 3 \
                    and parts.get('flags', '') == '':
                words.append((w, f))
    return words


def neighbours(ch):
    if ch not in POS:
        return []
    x, y = POS[ch]
    return [c for c, (a, b) in POS.items() if c != ch and math.hypot(a - x, b - y) < 1.3]


def typo(w, rnd):
    for _ in range(20):
        r = rnd.random()
        i = rnd.randrange(len(w))
        if r < 0.50:
            nb = neighbours(w[i])
            if not nb:
                continue
            t = w[:i] + rnd.choice(nb) + w[i + 1:]
        elif r < 0.70:
            if len(w) < 4:
                continue
            t = w[:i] + w[i + 1:]
        elif r < 0.85:
            nb = neighbours(w[i]) + [w[i]]
            t = w[:i + 1] + rnd.choice(nb) + w[i + 1:]
        elif r < 0.95:
            if i == len(w) - 1 or w[i] == w[i + 1]:
                continue
            t = w[:i] + w[i + 1] + w[i] + w[i + 2:]
        else:
            t = w[:i] + rnd.choice('abcdefghijklmnopqrstuvwxyz') + w[i + 1:]
        if t != w:
            return t
    return None


def run(args, extra, inputs):
    # Hunspell's suggest is slow; its answers never change, so keep them in --cache.
    base = {}
    if args.cache and os.path.exists(args.cache):
        with open(args.cache, encoding='utf-8') as fh:
            for line in fh:
                t, h = line.rstrip('\n').split('\t')
                base[t] = h
    need = [t for t in inputs if t not in base]
    out = {}
    for batch, flag in ((need, []), ([t for t in inputs if t in base], ['baseline=0'])):
        if not batch:
            continue
        p = subprocess.run([args.skcli, args.skd, args.aff, args.dic] + extra + flag,
                           input='\n'.join(batch) + '\n', capture_output=True, text=True,
                           check=True)
        for line in p.stdout.splitlines():
            f = line.split('\t')
            if f[6] != '-':
                base[f[0]] = f[6]
            out[f[0]] = (f[3], base[f[0]])
    if args.cache and need:
        with open(args.cache, 'w', encoding='utf-8') as fh:
            for t, h in sorted(base.items()):
                fh.write('%s\t%s\n' % (t, h))
    return out


def score(name, pairs, res, show):
    tot = len(pairs)
    for eng, k in (('new', 0), ('hunspell', 1)):
        fixed = sum(1 for t, w in pairs if res[t][k] == w)
        kept = sum(1 for t, w in pairs if res[t][k] == t)
        wrong = tot - fixed - kept
        print('  %-6s %-9s fixed %5.1f%%  wrong %5.1f%%  kept %5.1f%%' %
              (name, eng, 100.0 * fixed / tot, 100.0 * wrong / tot, 100.0 * kept / tot))
    if show:
        bad = [(t, w, res[t][0]) for t, w in pairs if res[t][0] not in (w, t)]
        print('    new wrong e.g.: ' + ', '.join('%s->%s (want %s)' % (t, g, w) for t, w, g in bad[:show]))


def main():
    ap = argparse.ArgumentParser()
    for a in ('skcli', 'skd', 'aff', 'dic', 'wordlist', 'wiki'):
        ap.add_argument('--' + a, required=True)
    ap.add_argument('--n', type=int, default=3000)
    ap.add_argument('--show', type=int, default=0)
    ap.add_argument('--cache', help='file to keep the Hunspell baseline answers in')
    args, extra = ap.parse_known_args()
    rnd = random.Random(1234)
    words = load_words(args.wordlist)
    weights = [2 ** (f / 16.0) for _, f in words]
    picks = rnd.choices([w for w, _ in words], weights=weights, k=args.n)
    touch = []
    for w in picks:
        t = typo(w, rnd)
        if t:
            touch.append((t, w))
    wiki = []
    for line in open(args.wiki, encoding='utf-8'):
        if '->' in line:
            a, b = line.strip().split('->', 1)
            if ',' not in b and b.isalpha():
                wiki.append((a.strip(), b.strip()))
    clean_freq = rnd.choices([w for w, _ in words], weights=weights, k=args.n // 2)
    clean = [(w, w) for w in clean_freq] + [(w, w) for w in CLEAN_OOV]
    inputs = sorted(set(t for t, _ in touch + wiki + clean))
    res = run(args, extra, inputs)
    # a typo that happens to be a real word can't be fixed by any spell checker: report apart
    real = sum(1 for t, w in touch if res[t][0] == t and res[t][1] == t)
    print('touch typos: %d (%d of them real words)' % (len(touch), real))
    score('touch', touch, res, args.show)
    score('wiki', wiki, res, args.show)
    tot = len(clean)
    for eng, k in (('new', 0), ('hunspell', 1)):
        dmg = [t for t, _ in clean if res[t][k] != t]
        oov = [t for t in CLEAN_OOV if res[t][k] != t]
        print('  clean  %-9s damaged %5.1f%%  (OOV names/slang damaged: %d of %d)' %
              (eng, 100.0 * len(dmg) / tot, len(oov), len(CLEAN_OOV)))
        if args.show and k == 0:
            print('    new damaged e.g.: ' + ', '.join('%s->%s' % (t, res[t][0]) for t in dmg[:args.show]))


if __name__ == '__main__':
    main()
