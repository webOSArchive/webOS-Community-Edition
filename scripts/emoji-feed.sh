#!/bin/bash
# Builds the "Emoji for webOS" feed ipk (org.webosarchive.emoji) from packages/emoji-feed.
#
#   scripts/emoji-feed.sh   -> build/work/ipk/org.webosarchive.emoji_<VERSION>_armv7.ipk
#
# Payload (staged at /usr/palm/webosarchive/emoji; the postinst puts it in place):
#   CE-Emoji.ttf, OFL.txt      build/full-ce/emoji-font (the font the CE bake ships)
#   webkit/<offset>.orig|.new   the libWebKitLuna patch as byte sites, derived from
#                               build/full-ce/emoji-font/webkit_fallback_patch.py applied to the
#                               CE 3.1.0 library, and checked to hold the same original bytes in
#                               the stock 3.0.5 library (the two differ only in strings)
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC=$ROOT/packages/emoji-feed
EF=$ROOT/build/full-ce/emoji-font
PKG=org.webosarchive.emoji
VER=$(cat "$SRC/VERSION")
OUT=$ROOT/build/work/ipk
IPK=$OUT/${PKG}_${VER}_armv7.ipk
W=$ROOT/build/work/emoji-feed
CE_LIB=${CE_LIB:-$ROOT/build/overlays/full-ce/rootfs/usr/lib/libWebKitLuna.so}
STOCK_TGZ=$ROOT/build/work/webos/nova-cust-image-topaz.rootfs.tar.gz

rm -rf "$W"; mkdir -p "$W/data/usr/palm/webosarchive/emoji/webkit" "$W/ctl" "$W/ipk" "$OUT"
D=$W/data/usr/palm/webosarchive/emoji
install -m 644 "$EF/CE-Emoji.ttf" "$EF/OFL.txt" "$D/"

python3 - "$EF" "$CE_LIB" "$STOCK_TGZ" "$D/webkit" <<'PY'
import hashlib, os, sys, tarfile
ef, ce_lib, stock_tgz, out = sys.argv[1:]
sys.path.insert(0, ef)
import webkit_fallback_patch as p
ce = open(ce_lib, 'rb').read()               # tier 19b output: the patcher's input
pat = p.patch(ce)
with tarfile.open(stock_tgz) as t:
    stock = t.extractfile('./usr/lib/libWebKitLuna.so').read()
# the four sites: program header (p_filesz/p_memsz of the first PT_LOAD), the two redirected
# instructions, the caves
sites = [(0x60, 12), (p.CALL_AT, 4), (p.FILL_BIG, 4), (p.CAVE, p.CAVE_END - p.CAVE)]
changed = [i for i in range(len(ce)) if ce[i] != pat[i]]
covered = lambda i: any(o <= i < o + n for o, n in sites)
assert all(covered(i) for i in changed), 'patch touches bytes outside the sites'
for o, n in sites:
    assert stock[o:o + n] == ce[o:o + n], 'stock 3.0.5 differs at 0x%x' % o
    open(os.path.join(out, '%d.orig' % o), 'wb').write(ce[o:o + n])
    open(os.path.join(out, '%d.new' % o), 'wb').write(pat[o:o + n])
# the result must be byte-identical to what the bake ships
def apply(data):
    d = bytearray(data)
    for o, n in sites:
        d[o:o + n] = pat[o:o + n]
    return bytes(d)
assert apply(ce) == pat
print('sites ok; stock 3.0.5 patched -> md5 %s, CE -> %s' %
      (hashlib.md5(apply(stock)).hexdigest()[:12], hashlib.md5(apply(ce)).hexdigest()[:12]))
PY

(cd "$W/data" && tar --owner=0 --group=0 -czf "$W/ipk/data.tar.gz" ./usr)
sed "s/@VERSION@/$VER/; s/@EPOCH@/$(date +%s)/" "$SRC/control" > "$W/ctl/control"
echo "Installed-Size: $(du -sk "$W/data" | cut -f1)" >> "$W/ctl/control"
install -m 755 "$SRC/postinst" "$SRC/prerm" "$W/ctl/"
sh -n "$W/ctl/postinst"; sh -n "$W/ctl/prerm"
(cd "$W/ctl" && tar --owner=0 --group=0 -czf "$W/ipk/control.tar.gz" ./control ./postinst ./prerm)
printf '2.0\n' > "$W/ipk/debian-binary"
rm -f "$IPK"
(cd "$W/ipk" && ar rc "$IPK" debian-binary control.tar.gz data.tar.gz)
echo "feed ipk: $IPK" && ls -la "$IPK"
