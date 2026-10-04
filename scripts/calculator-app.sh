#!/bin/sh
# Packaging and dev loop for apps/com.palm.app.calculator (scientific landscape layout).
#
#   scripts/calculator-app.sh feed      -> build/work/ipk/com.palm.app.calculator_<ver>_all.ipk
#   scripts/calculator-app.sh release   -> feed + copy the ipk into AddToImage/PatchOrReplace
#   scripts/calculator-app.sh push      -> copy the working tree over the installed app on the
#                                          connected device and restart Luna (dev only)
#
# The package is named com.palm.app.calculator -- the stock preload's ipkg package name --
# so Preware installs it as an upgrade of the stock 1.0.0 in /media/cryptofs/apps. The app
# id stays com.palm.calculator, so an OTA install to the rootfs (/usr/palm/applications)
# takes over from the cryptofs copy by declaring the higher version. No postinst: the
# payload is the whole app and nothing else, which is safe under mmipkg's
# remove-then-install upgrades and its abort-on-nonzero-postinst rule.
set -e
PKG=com.palm.app.calculator
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/apps/$PKG"
OUT="$ROOT/build/work/ipk"
VER=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$SRC/appinfo.json")
APPID=$(sed -n 's/.*"id": *"\([^"]*\)".*/\1/p' "$SRC/appinfo.json")
IPK="$OUT/${PKG}_${VER}_all.ipk"

case "$1" in
feed)
    for f in "$SRC"/source/*.js "$SRC"/depends.js; do node --check "$f"; done
    for f in $(find "$SRC" -name appinfo.json); do
        grep -q "\"version\": *\"$VER\"" "$f" || { echo "$f is not at version $VER" >&2; exit 1; }
    done
    W="$ROOT/build/work/calculator-feed"; rm -rf "$W"; mkdir -p "$W/app" "$W/ipk" "$OUT"
    cp -r "$SRC"/. "$W/app/"
    # HP's development leftovers: specs and their runner, Ruby/rake build files.
    (cd "$W/app" && rm -rf spec jasminerunner.html Gemfile Gemfile.lock Rakefile .rvmrc build.sh ci_build.sh)
    palm-package -o "$W/ipk" "$W/app" >/dev/null
    cd "$W/ipk"
    ar x "${APPID}_${VER}_all.ipk" && rm -f "${APPID}_${VER}_all.ipk"
    # palm-package names the package and its directory after the app id; the stock
    # preload lives under the package name, so move the payload there.
    mkdir data && tar xzf data.tar.gz -C data
    mv "data/usr/palm/applications/$APPID" "data/usr/palm/applications/$PKG"
    (cd data && tar --owner=0 --group=0 -czf ../data.tar.gz ./usr)
    mkdir ctl && tar xzf control.tar.gz -C ctl
    SIZE=$(du -sk data | cut -f1)
    sed "s/@VERSION@/$VER/; s/@EPOCH@/$(date +%s)/" "$ROOT/build/full-ce/calculator-app/feed/control" > ctl/control
    echo "Installed-Size: $SIZE" >> ctl/control
    (cd ctl && tar --owner=0 --group=0 -czf ../control.tar.gz ./control)
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
    (cd "$SRC" && tar czf "$T" depends.js appinfo.json resources source css images)
    novacom put file:///tmp/calc-push.tgz < "$T"; rm -f "$T"
    novacom run file:///bin/sh <<X
cd /media/cryptofs/apps/usr/palm/applications/$PKG && tar xzf /tmp/calc-push.tgz 2>/dev/null; rm -f /tmp/calc-push.tgz
killall -HUP LunaSysMgr
X
    ;;
*)
    sed -n '2,9p' "$0"; exit 2
    ;;
esac
