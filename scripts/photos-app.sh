#!/bin/sh
# Packaging and dev loop for apps/com.palm.app.photos (Photos & Videos with the CE changes).
#
#   scripts/photos-app.sh feed      -> build/work/ipk/com.palm.app.photos_<ver>_all.ipk
#   scripts/photos-app.sh release   -> feed + copy the ipk into AddToImage/PatchOrReplace
#   scripts/photos-app.sh push      -> copy the working tree over the installed app on the
#                                      connected device and restart Luna (dev only)
#
# The package and the app id are both com.palm.app.photos -- the stock preload's names --
# so Preware installs it as an upgrade of the stock 3.0.8001 in /media/cryptofs/apps. No
# postinst: the payload is the whole app and nothing else, which is safe under mmipkg's
# remove-then-install upgrades and its abort-on-nonzero-postinst rule.
#
# The image does not install this ipk: bake.py puts its app tree into the stock staged
# preload ipk instead (edit_photos), the same way it handles the Calendar. The ipk in
# PatchOrReplace is where bake.py reads the tree from.
#
# The Photos SERVICE half of the Synergy integration (com.palm.service.photos, rootfs) is
# still patched by bake.py and is not in this package.
set -e
PKG=com.palm.app.photos
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/apps/$PKG"
OUT="$ROOT/build/work/ipk"
# the base appinfo.json pads the key with a tab ("version":<tab>"x")
VER=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SRC/appinfo.json")
IPK="$OUT/${PKG}_${VER}_all.ipk"

case "$1" in
feed)
    find "$SRC/source" "$SRC/css" -name '*.js' -exec node --check {} \;
    node --check "$SRC/depends.js"
    for f in $(find "$SRC" -name appinfo.json); do
        grep -q "\"version\"[[:space:]]*:[[:space:]]*\"$VER\"" "$f" || { echo "$f is not at version $VER" >&2; exit 1; }
    done
    W="$ROOT/build/work/photos-feed"; rm -rf "$W"; mkdir -p "$W/data/usr/palm/applications" "$W/ctl" "$OUT"
    cp -r "$SRC" "$W/data/usr/palm/applications/$PKG"
    # HP's development leftovers: specs, Ruby/rake and make build files.
    (cd "$W/data/usr/palm/applications/$PKG" && \
        rm -rf spec Gemfile Gemfile.lock Rakefile .rvmrc ci_build.sh Makefile Makefile-CreateAndInstallPackage.sh && \
        find . -name .DS_Store -delete)
    cd "$W"
    (cd data && tar --sort=name --owner=0 --group=0 -czf ../data.tar.gz ./usr)
    SIZE=$(du -sk data | cut -f1)
    sed "s/@VERSION@/$VER/; s/@EPOCH@/$(date +%s)/" "$ROOT/build/full-ce/photos-app/feed/control" > ctl/control
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
    (cd "$SRC" && tar czf "$T" --exclude=.DS_Store depends.js index.html photosVideos.html slideshow.html appinfo.json css images resources source)
    novacom put file:///tmp/photos-push.tgz < "$T"; rm -f "$T"
    novacom run file:///bin/sh <<X
cd /media/cryptofs/apps/usr/palm/applications/$PKG && tar xzf /tmp/photos-push.tgz 2>/dev/null; rm -f /tmp/photos-push.tgz
killall -HUP LunaSysMgr
X
    ;;
*)
    sed -n '2,7p' "$0"; exit 2
    ;;
esac
