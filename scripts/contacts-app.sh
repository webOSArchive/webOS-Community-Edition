#!/bin/sh
# Packaging for apps/com.palm.app.contacts (on-device contacts, no HP account).
#
#   scripts/contacts-app.sh feed      -> build/work/ipk/com.palm.app.contacts_<ver>_all.ipk
#   scripts/contacts-app.sh release   -> feed + copy the ipk into AddToImage/PatchOrReplace
#
# The app is the community 3.0.6701 Contacts plus CE's changes (see git history). The
# account-template and accounts-library changes it goes with are files outside the app,
# kept under system/ (system/README.md).
#
# bake.py bakes the ipk in PatchOrReplace as a rootfs app (tier 15g). It replaces the
# community 3.0.6701 overwrite ipk that used to sit there; that one is the baseline commit
# of apps/com.palm.app.contacts.
set -e
PKG=com.palm.app.contacts
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/apps/$PKG"
OUT="$ROOT/build/work/ipk"
VER=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SRC/appinfo.json")
IPK="$OUT/${PKG}_${VER}_all.ipk"

case "$1" in
feed)
    find "$SRC/app" -name '*.js' -exec node --check {} \;
    node --check "$SRC/depends.js"
    W="$ROOT/build/work/contacts-feed"; rm -rf "$W"; mkdir -p "$W/data/usr/palm/applications" "$W/ctl" "$OUT"
    cp -r "$SRC" "$W/data/usr/palm/applications/$PKG"
    find "$W/data" -name .DS_Store -delete
    cd "$W"
    (cd data && tar --sort=name --owner=0 --group=0 -czf ../data.tar.gz ./usr)
    SIZE=$(du -sk data | cut -f1)
    sed "s/@VERSION@/$VER/; s/@EPOCH@/$(date +%s)/" "$ROOT/build/full-ce/contacts-app/feed/control" > ctl/control
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
*)
    sed -n '2,5p' "$0"; exit 2
    ;;
esac
