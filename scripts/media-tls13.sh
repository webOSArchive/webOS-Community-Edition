#!/bin/sh
# Build/package/deploy org.webosarchive.media-tls13: the libcurl souphttpsrc
# replacement (build/full-ce/media-tls13/curlhttpsrc).
#
#   scripts/media-tls13.sh build      -> cross-compile libgstcurlhttpsrc.so (make)
#   scripts/media-tls13.sh feed       -> build + the Preware ipk in build/work/ipk/
#   scripts/media-tls13.sh deploy     -> install it on the connected device as
#                                        ipkgservice would (ipkg + postinst)
#   scripts/media-tls13.sh undeploy   -> prerm + ipkg remove
#   scripts/media-tls13.sh release    -> feed + copy into AddToImage/NewApps
#
# The build inputs (header sysroot, stock rootfs libs, curl headers, CE
# libcurl) are described at the top of curlhttpsrc/Makefile.
set -e
PKG=org.webosarchive.media-tls13
ROOT=$(cd "$(dirname "$0")/.." && pwd)
MT="$ROOT/build/full-ce/media-tls13"
OUT="$ROOT/build/work/ipk"
VER=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$MT/app/appinfo.json")
IPK="$OUT/${PKG}_${VER}_armv7.ipk"
SO="$ROOT/build/work/curlhttpsrc/out/libgstcurlhttpsrc.so"

dev() { novacom run file:///bin/sh; }

case "$1" in
build)
    make -C "$MT/curlhttpsrc"
    ;;
feed)
    "$0" build
    W="$ROOT/build/work/media-tls13-feed"; rm -rf "$W"; mkdir -p "$W/app/files" "$W/ipk" "$OUT"
    cp "$MT/app/appinfo.json" "$MT/app/index.html" "$W/app/"
    cp "$ROOT/apps/com.palm.app.videos/icon.png" "$W/app/icon.png"
    cp "$SO" "$W/app/files/"
    palm-package -o "$W/ipk" "$W/app" >/dev/null
    cd "$W/ipk" && B=$(ls *.ipk) && ar x "$B" && rm -f "$B" \
        && mkdir ctl && tar xzf control.tar.gz -C ctl \
        && sed "s/@VERSION@/$VER/; s/@EPOCH@/$(date +%s)/" "$MT/feed/control" > ctl/control \
        && cp "$MT/feed/postinst" "$MT/feed/prerm" ctl/ && chmod 755 ctl/postinst ctl/prerm \
        && sh -n ctl/postinst && sh -n ctl/prerm \
        && (cd ctl && tar czf ../control.tar.gz ./control ./postinst ./prerm) \
        && ar rc "$IPK" debian-binary control.tar.gz data.tar.gz \
        && echo "feed ipk: $IPK" && ls -la "$IPK"
    ;;
deploy)
    [ -f "$IPK" ] || { echo "no ipk at $IPK -- run '$0 feed' first" >&2; exit 2; }
    B=$(basename "$IPK")
    novacom put "file:///media/internal/downloads/$B" < "$IPK"
    dev <<EOF
export IPKG_OFFLINE_ROOT=/media/cryptofs/apps
ipkg -o /media/cryptofs/apps -force-overwrite -force-reinstall install /media/internal/downloads/$B 2>&1 | tail -1
sh /media/cryptofs/apps/usr/lib/ipkg/info/$PKG.postinst
rm -f /media/internal/downloads/$B
EOF
    ;;
undeploy)
    dev <<EOF
export IPKG_OFFLINE_ROOT=/media/cryptofs/apps
[ -f /media/cryptofs/apps/usr/lib/ipkg/info/$PKG.prerm ] && sh /media/cryptofs/apps/usr/lib/ipkg/info/$PKG.prerm
ipkg -o /media/cryptofs/apps remove $PKG 2>&1 | tail -1
EOF
    ;;
release)
    "$0" feed
    cp -v "$IPK" "$ROOT/AddToImage/NewApps/"
    ;;
*)
    sed -n '2,13p' "$0"; exit 2
    ;;
esac
