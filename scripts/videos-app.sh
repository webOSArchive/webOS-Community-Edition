#!/bin/sh
# Dev loop for apps/com.palm.app.videos (the CE video player rewrite).
#
#   scripts/videos-app.sh package            -> build/work/ipk/com.palm.app.videos_<ver>_all.ipk
#   scripts/videos-app.sh install            -> package + palm-install on the connected device
#   scripts/videos-app.sh launch <target> [extra-json]
#                                            -> palm-launch with {"target":...} (+ merged extra params)
#   scripts/videos-app.sh selftest <target> [scrub|eos|all] [rounds]
#                                            -> launch in self-test mode and wait for the summary
#   scripts/videos-app.sh log                -> the app's console lines from /var/log/messages
#   scripts/videos-app.sh close              -> close every open card of the app
#   scripts/videos-app.sh feed               -> the distributable ipk (app + postinst/prerm)
#   scripts/videos-app.sh deploy [ipk]       -> install the feed ipk on the connected device the
#                                               way Preware's service does (ipkg as root + postinst)
#                                               and restart Luna. Also the upgrade path.
#   scripts/videos-app.sh undeploy           -> prerm + ipkg remove + Luna restart (stock player back)
#   scripts/videos-app.sh release            -> feed + copy the ipk into AddToImage/NewApps
#                                               (bake.py picks the highest version there)
#
# Pushed Enyo edits are cached by WebAppMgr: 'install' closes the app first, and if
# a change still does not show up, restart Luna (see memory: enyo-app-cache-luna-restart).
set -e
APP=com.palm.app.videos
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/apps/$APP"
OUT="$ROOT/build/work/ipk"
VER=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$SRC/appinfo.json")
IPK="$OUT/${APP}_${VER}_all.ipk"

dev() { novacom run file:///bin/sh; }

close_app() {
    dev <<EOF
luna-send -n 1 palm://com.palm.applicationManager/running '{}' </dev/null | tr ',' '\n' | grep -A1 '$APP' | grep -o '"[0-9]*"' | tr -d '"' | while read p; do luna-send -n 1 palm://com.palm.applicationManager/close "{\"processId\":\"\$p\"}" </dev/null >/dev/null; done
EOF
}

case "$1" in
package)
    mkdir -p "$OUT"
    for f in "$SRC"/source/*.js; do node --check "$f"; done
    palm-package -o "$OUT" "$SRC"
    ;;
install)
    "$0" package
    close_app
    palm-install "$IPK"
    ;;
launch)
    T="$2"; EXTRA="${3:-{\}}"
    [ -n "$T" ] || { echo "usage: $0 launch <path-or-url> [extra-json]" >&2; exit 2; }
    palm-launch -p "{\"target\":\"$T\",\"videoTitle\":\"$(basename "$T")\"$(echo "$EXTRA" | sed 's/^{/,/; s/}$//; s/^,$//')}" $APP
    ;;
selftest)
    T="$2"; MODE="${3:-all}"; ROUNDS="${4:-3}"
    [ -n "$T" ] || { echo "usage: $0 selftest <path-or-url> [scrub|eos|all] [rounds]" >&2; exit 2; }
    close_app
    START=$(dev <<'EOF'
date -u +%FT%TZ
EOF
)
    palm-launch -p "{\"target\":\"$T\",\"selftest\":\"$MODE\",\"rounds\":$ROUNDS}" $APP
    echo "started $START, waiting for summary..."
    while :; do
        SUM=$(dev <<EOF
awk '\$1 >= "$START"' /var/log/messages | grep '$APP' | grep 'SELFTEST \(PASS\|FAIL\) pass=' | tail -1
EOF
)
        [ -n "$SUM" ] && break
        sleep 10
    done
    dev <<EOF
awk '\$1 >= "$START"' /var/log/messages | grep '$APP' | grep -E 'SELFTEST|RECOVER|DEADLINE|FAILED|media error|seekable=' | sed -r 's/^([0-9T:.-]+)Z.*\[vids\] /\1 /; s/, file:.*\$//' | cut -c1-200
echo "pids: mediaserver \$(pidof mediaserver) / rdxd \$(ls /var/log/rdxd/pending | wc -l)"
EOF
    ;;
log)
    dev <<EOF
grep -h '$APP' /var/log/messages | grep -v 'QDebug\|ev timeupdate' | sed -r 's/^([0-9T:.-]+)Z.*\[vids\] /\1 /; s/, file:.*\$//' | tail -${2:-60} | cut -c1-200
EOF
    ;;
close)
    close_app
    ;;
feed)
    # The distributable ipk: the app plus a ce-install/ payload (Photos patch,
    # videoplayer appinfo, Tweaks definition) and postinst/prerm that replay what the
    # baked image does, undoably, on a running 3.0.5 / CE 3.1.0 device.
    # Control metadata is rewritten for Preware (palm-package's defaults would list
    # it untitled and Unsorted). bake.py extracts this same ipk and drops ce-install/.
    "$0" package
    FEED="$ROOT/build/full-ce/videos-app/feed"
    VA="$ROOT/build/full-ce/videos-app"
    STOCK="$ROOT/build/work/stock-videoplayer"
    W="$ROOT/build/work/feed"; rm -rf "$W"; mkdir -p "$W/app" "$W/ipk"
    cp -r "$SRC"/. "$W/app/"
    mkdir -p "$W/app/ce-install"
    cp "$VA/patches/AlbumGridView-videos-handoff.js.patch" "$SRC/tweaks/com.palm.app.videos.json" "$W/app/ce-install/"
    cp "$VA/videoplayer-app/appinfo.json" "$W/app/ce-install/videoplayer-appinfo.json"
    # md5 constants for the postinst guards. The stock Photos file and stock
    # app-assistant.js come from the device pull (build/work/stock-videoplayer);
    # both are identical on stock 3.0.5 and CE 3.1.0 (no CE patch touches them).
    PHS=$(md5sum < "$STOCK/com.palm.app.photos/source/AlbumGridView.js" | cut -c1-32)
    VPI=$(md5sum < "$STOCK/applications/com.palm.app.videoplayer/index.html" | cut -c1-32)
    [ "$PHS" = "fc748840bb83c65bd0d2504226bfee55" ] || { echo "stock AlbumGridView.js md5 changed ($PHS) -- re-pull or update the guard" >&2; exit 1; }
    # the patched result the device must reproduce byte for byte
    cp "$STOCK/com.palm.app.photos/source/AlbumGridView.js" "$W/agv.js"
    (cd "$W" && patch -s -p2 -i "$VA/patches/AlbumGridView-videos-handoff.js.patch" agv.js) || { echo "Photos patch no longer applies to the stock file" >&2; exit 1; }
    PHP=$(md5sum < "$W/agv.js" | cut -c1-32)
    palm-package -o "$W/ipk" "$W/app" >/dev/null
    cd "$W/ipk" && ar x "$(basename "$IPK")" && rm -f "$(basename "$IPK")" \
        && mkdir ctl && tar xzf control.tar.gz -C ctl \
        && sed "s/@VERSION@/$VER/; s/@EPOCH@/$(date +%s)/" "$FEED/control" > ctl/control \
        && sed "s/@PHOTOS_STOCK_MD5@/$PHS/; s/@PHOTOS_PATCHED_MD5@/$PHP/; s/@VP_INDEX_STOCK_MD5@/$VPI/" "$FEED/postinst" > ctl/postinst \
        && cp "$FEED/prerm" ctl/prerm && chmod 755 ctl/postinst ctl/prerm \
        && sh -n ctl/postinst && sh -n ctl/prerm \
        && (cd ctl && tar czf ../control.tar.gz ./control ./postinst ./prerm) \
        && ar rc "$IPK" debian-binary control.tar.gz data.tar.gz \
        && echo "feed ipk: $IPK" && ls -la "$IPK"
    ;;
deploy)
    F="${2:-$IPK}"
    [ -f "$F" ] || { echo "no ipk at $F -- run '$0 feed' first" >&2; exit 2; }
    B=$(basename "$F")
    novacom put "file:///media/internal/downloads/$B" < "$F"
    dev <<EOF
export IPKG_OFFLINE_ROOT=/media/cryptofs/apps
ipkg -o /media/cryptofs/apps -force-overwrite -force-reinstall install /media/internal/downloads/$B 2>&1 | tail -1
sh /media/cryptofs/apps/usr/lib/ipkg/info/$APP.postinst
rm -f /media/internal/downloads/$B
echo "restarting Luna..."; initctl stop LunaSysMgr >/dev/null 2>&1; sleep 2; initctl start LunaSysMgr >/dev/null 2>&1; sleep 25
echo "LunaSysMgr: \$(pidof LunaSysMgr)"
EOF
    ;;
undeploy)
    dev <<EOF
export IPKG_OFFLINE_ROOT=/media/cryptofs/apps
[ -f /media/cryptofs/apps/usr/lib/ipkg/info/$APP.prerm ] && sh /media/cryptofs/apps/usr/lib/ipkg/info/$APP.prerm
ipkg -o /media/cryptofs/apps remove $APP 2>&1 | tail -1
echo "restarting Luna..."; initctl stop LunaSysMgr >/dev/null 2>&1; sleep 2; initctl start LunaSysMgr >/dev/null 2>&1; sleep 25
echo "LunaSysMgr: \$(pidof LunaSysMgr)"
EOF
    ;;
release)
    "$0" feed
    cp -v "$IPK" "$ROOT/AddToImage/NewApps/"
    ;;
*)
    sed -n '2,16p' "$0"; exit 2
    ;;
esac
