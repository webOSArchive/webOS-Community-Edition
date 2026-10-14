#!/bin/sh
# Packaging and dev loop for apps/com.palm.app.photos (Photos & Videos with the CE changes)
# and apps/org.webosarchive.photos.service (the file writer behind its photo editor).
#
#   scripts/photos-app.sh feed      -> build/work/ipk/com.palm.app.photos_<ver>_all.ipk
#   scripts/photos-app.sh release   -> feed + copy the ipk into AddToImage/PatchOrReplace
#   scripts/photos-app.sh push      -> copy the working tree over the installed app on the
#                                      connected device and restart Luna (dev only)
#
# The package and the app id are both com.palm.app.photos -- the stock preload's names --
# so Preware installs it as an upgrade of the stock 3.0.8001 in /media/cryptofs/apps. No
# postinst: the payload is the app, its service and their packageinfo.json, which is safe
# under mmipkg's remove-then-install upgrades and its abort-on-nonzero-postinst rule.
#
# The service is registered on the bus by com.palm.appinstaller, from packageinfo.json
# (the same layout as the QuickOffice preload). Preware installs Application packages
# through the appinstaller, so a plain `ipkg install` of this ipk leaves the service
# unregistered -- use palm-install (or Preware) to install it by hand.
#
# The image does not install this ipk: bake.py puts its app tree into the stock staged
# preload ipk instead (edit_photos), the same way it handles the Calendar. The ipk in
# PatchOrReplace is where bake.py reads the tree from.
#
# The Photos SERVICE half of the Synergy integration (com.palm.service.photos, rootfs) is
# still patched by bake.py and is not in this package.
set -e
PKG=com.palm.app.photos
SVC=org.webosarchive.photos.service
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/apps/$PKG"
SSRC="$ROOT/apps/$SVC"
OUT="$ROOT/build/work/ipk"
# the base appinfo.json pads the key with a tab ("version":<tab>"x")
VER=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SRC/appinfo.json")
IPK="$OUT/${PKG}_${VER}_all.ipk"

case "$1" in
feed)
    find "$SRC/source" "$SRC/css" -name '*.js' -exec node --check {} \;
    node --check "$SRC/depends.js"
    node --check "$SSRC/service.js"
    for f in $(find "$SRC" -name appinfo.json); do
        grep -q "\"version\"[[:space:]]*:[[:space:]]*\"$VER\"" "$f" || { echo "$f is not at version $VER" >&2; exit 1; }
    done
    W="$ROOT/build/work/photos-feed"; rm -rf "$W"
    mkdir -p "$W/data/usr/palm/applications" "$W/data/usr/palm/services" "$W/data/usr/palm/packages/$PKG" "$W/ctl" "$OUT"
    cp -r "$SRC" "$W/data/usr/palm/applications/$PKG"
    cp -r "$SSRC" "$W/data/usr/palm/services/$SVC"
    sed "s/@VERSION@/$VER/" "$ROOT/build/full-ce/photos-app/packageinfo.json" > "$W/data/usr/palm/packages/$PKG/packageinfo.json"
    # HP's development leftovers: specs, Ruby/rake and make build files.
    (cd "$W/data/usr/palm/applications/$PKG" && \
        rm -rf spec Gemfile Gemfile.lock Rakefile .rvmrc ci_build.sh Makefile Makefile-CreateAndInstallPackage.sh && \
        find . -name .DS_Store -delete)
    cd "$W"
    (cd data && tar --sort=name --owner=0 --group=0 -czf ../data.tar.gz ./usr)
    SIZE=$(du -sk data | cut -f1)
    sed "s/@VERSION@/$VER/; s/@EPOCH@/$(date +%s)/" "$ROOT/build/full-ce/photos-app/feed/control" > ctl/control
    echo "Installed-Size: $SIZE" >> ctl/control
    echo "webOS-Package-Format-Version: 2" >> ctl/control
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
    (cd "$SRC" && tar czf "$T" --owner=0 --group=0 --exclude=.DS_Store depends.js index.html photosVideos.html slideshow.html appinfo.json css images resources source)
    novacom put file:///tmp/photos-push.tgz < "$T"
    (cd "$SSRC" && tar czf "$T" --owner=0 --group=0 .)
    novacom put file:///tmp/photos-svc-push.tgz < "$T"; rm -f "$T"
    # the service files only take effect once palm-install/Preware has registered it
    novacom run file:///bin/sh <<X
cd /media/cryptofs/apps/usr/palm/applications/$PKG && tar xzf /tmp/photos-push.tgz 2>/dev/null; rm -f /tmp/photos-push.tgz
D=/media/cryptofs/apps/usr/palm/services/$SVC
[ -d \$D ] && (cd \$D && tar xzf /tmp/photos-svc-push.tgz 2>/dev/null); rm -f /tmp/photos-svc-push.tgz
pkill -f "$SVC" 2>/dev/null
killall -HUP LunaSysMgr
X
    ;;
*)
    sed -n '2,7p' "$0"; exit 2
    ;;
esac
