#!/bin/sh
# Packaging and dev loop for apps/com.palm.app.calendar (on-device calendar, no HP account).
#
#   scripts/calendar-app.sh feed      -> build/work/ipk/com.palm.app.calendar_<ver>_all.ipk
#   scripts/calendar-app.sh release   -> feed + copy the ipk into AddToImage/PatchOrReplace
#   scripts/calendar-app.sh push      -> copy the working tree over the installed app on the
#                                        connected device and restart Luna (dev only)
#
# The package and the app id are both com.palm.app.calendar -- the stock preload's names --
# so Preware installs it as an upgrade of the stock 3.0.11007 in /media/cryptofs/apps. No
# postinst: the payload is the whole app and nothing else, which is safe under mmipkg's
# remove-then-install upgrades and its abort-on-nonzero-postinst rule.
#
# The image does not install this ipk: bake.py puts its app tree into the stock staged
# preload ipk instead, which keeps the stock install path (the app carries db8 kinds and
# activities under configuration/). The ipk in PatchOrReplace is what bake.py reads it from.
#
# The Facebook and "webOS Account" template edits ship in the image (bake.py tier 11d),
# not in this package -- they are rootfs files outside the app.
set -e
PKG=com.palm.app.calendar
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/apps/$PKG"
OUT="$ROOT/build/work/ipk"
# the base appinfo.json pads the key with tabs ("version"<tabs>: "x")
VER=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SRC/appinfo.json")
IPK="$OUT/${PKG}_${VER}_all.ipk"

case "$1" in
feed)
    find "$SRC/app" "$SRC/libs" -name '*.js' -exec node --check {} \;
    node --check "$SRC/index.js"; node --check "$SRC/depends.js"
    for f in $(find "$SRC" -name appinfo.json); do
        grep -q "\"version\"[[:space:]]*:[[:space:]]*\"$VER\"" "$f" || { echo "$f is not at version $VER" >&2; exit 1; }
    done
    W="$ROOT/build/work/calendar-feed"; rm -rf "$W"; mkdir -p "$W/data/usr/palm/applications" "$W/ctl" "$OUT"
    cp -r "$SRC" "$W/data/usr/palm/applications/$PKG"
    # HP's development leftovers: specs, Ruby/rake build files, design notes.
    (cd "$W/data/usr/palm/applications/$PKG" && \
        rm -rf spec docs Gemfile Gemfile.lock Rakefile .rvmrc ci_build.sh && \
        find . -name .DS_Store -delete)
    cd "$W"
    (cd data && tar --sort=name --owner=0 --group=0 -czf ../data.tar.gz ./usr)
    SIZE=$(du -sk data | cut -f1)
    sed "s/@VERSION@/$VER/; s/@EPOCH@/$(date +%s)/" "$ROOT/build/full-ce/calendar-app/feed/control" > ctl/control
    echo "Installed-Size: $SIZE" >> ctl/control
    (cd ctl && tar --owner=0 --group=0 -czf ../control.tar.gz ./control)
    echo "2.0" > debian-binary
    rm -f "$IPK"
    ar rc "$IPK" debian-binary control.tar.gz data.tar.gz
    echo "feed ipk: $IPK" && ls -la "$IPK"
    ;;
release)
    "$0" feed
    rm -f "$ROOT/AddToImage/PatchOrReplace/${PKG}"_*.ipk
    cp -v "$IPK" "$ROOT/AddToImage/PatchOrReplace/"
    ;;
push)
    T=$(mktemp)
    (cd "$SRC" && tar czf "$T" --exclude=.DS_Store depends.js index.js index.html appinfo.json app libs resources images)
    novacom put file:///tmp/cal-push.tgz < "$T"; rm -f "$T"
    novacom run file:///bin/sh <<X
cd /media/cryptofs/apps/usr/palm/applications/$PKG && tar xzf /tmp/cal-push.tgz 2>/dev/null; rm -f /tmp/cal-push.tgz
killall -HUP LunaSysMgr
X
    ;;
*)
    sed -n '2,7p' "$0"; exit 2
    ;;
esac
