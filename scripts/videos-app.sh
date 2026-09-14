#!/bin/sh
# Dev loop for apps/org.webosarchive.videos (the CE video player rewrite).
#
#   scripts/videos-app.sh package            -> build/work/ipk/org.webosarchive.videos_<ver>_all.ipk
#   scripts/videos-app.sh install            -> package + palm-install on the connected device
#   scripts/videos-app.sh launch <target> [extra-json]
#                                            -> palm-launch with {"target":...} (+ merged extra params)
#   scripts/videos-app.sh selftest <target> [scrub|eos|all] [rounds]
#                                            -> launch in self-test mode and wait for the summary
#   scripts/videos-app.sh log                -> the app's console lines from /var/log/messages
#   scripts/videos-app.sh close              -> close every open card of the app
#   scripts/videos-app.sh release            -> package and copy the ipk into AddToImage/NewApps
#                                               (bake.py picks the highest version there)
#
# Pushed Enyo edits are cached by WebAppMgr: 'install' closes the app first, and if
# a change still does not show up, restart Luna (see memory: enyo-app-cache-luna-restart).
set -e
APP=org.webosarchive.videos
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
release)
    "$0" package
    cp -v "$IPK" "$ROOT/AddToImage/NewApps/"
    ;;
*)
    sed -n '2,16p' "$0"; exit 2
    ;;
esac
