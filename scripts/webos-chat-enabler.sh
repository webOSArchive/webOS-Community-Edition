#!/bin/sh
# Builds the webOS Chat Enabler (AIM) for webOS CE: org.webosarchive.webos-chat.
#
#   scripts/webos-chat-enabler.sh feed   -> build/work/ipk/org.webosarchive.webos-chat_<ver>_armv7.ipk
#
# Inputs:
#   packages/webos-chat/          control, postinst, prerm, ls2 roles + launchers, VERSION,
#                                 OSCAR_COMMIT (pinned Oscar commit), TRANSPORT_COMMIT (pinned
#                                 imlibpurpleservice commit, built by build-imlibpurpletransport.sh,
#                                 which also supplies files/var/imdaemon.sh from that commit)
#   $OSCAR_REPO (../Oscar)        the Oscar-AIM-for-webOS checkout. The pinned commit's client/
#                                 is exported with git archive, so local edits there are ignored.
#                                 libaim.so is built from it with Oscar's own build-touchpad.sh,
#                                 which needs that checkout's uncommitted inputs: ref/ (Pidgin
#                                 sources) and build/touchpad/{deb,devlib}, plus the crosstool-NG
#                                 arm-cortex_a8 toolchain in ~/x-tools.
#
# The legacy-webOS enabler shares the package name; this one is versioned 3.1.0 up, and its
# postinst refuses anything but webOS CE.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="$ROOT/packages/webos-chat"
PKG=org.webosarchive.webos-chat
SVCID=com.palm.webosarchive.chat
TPL=org.webosarchive.chat
SETUP=org.webosarchive.chat.setup
VER=$(cat "$SRC/VERSION")
COMMIT=$(cat "$SRC/OSCAR_COMMIT")
OSCAR_REPO=${OSCAR_REPO:-$ROOT/../Oscar}
OUT="$ROOT/build/work/ipk"
IPK="$OUT/${PKG}_${VER}_armv7.ipk"

case "$1" in
feed)
    W="$ROOT/build/work/webos-chat"; rm -rf "$W"; mkdir -p "$W/oscar" "$W/ipk" "$OUT"
    git -C "$OSCAR_REPO" archive "$COMMIT" client | tar -x -C "$W/oscar"

    # libaim.so, built from the pinned sources into the work dir (not into the Oscar checkout)
    for d in ref build/touchpad/deb build/touchpad/devlib; do
        [ -d "$OSCAR_REPO/$d" ] || { echo "missing $OSCAR_REPO/$d (Oscar's build inputs)" >&2; exit 1; }
    done
    mkdir -p "$W/oscar/build/touchpad"
    ln -s "$OSCAR_REPO/ref" "$W/oscar/ref"
    ln -s "$OSCAR_REPO/build/touchpad/deb" "$W/oscar/build/touchpad/deb"
    ln -s "$OSCAR_REPO/build/touchpad/devlib" "$W/oscar/build/touchpad/devlib"
    sh "$W/oscar/client/libaim/build-touchpad.sh" > "$W/libaim-build.log" 2>&1 \
        || { tail -20 "$W/libaim-build.log" >&2; exit 1; }
    AIM="$W/oscar/build/touchpad/out/libaim.so"
    for s in oscar.webosarchive.org md5_login no_encryption; do
        strings "$AIM" | grep -qx "$s" || { echo "libaim.so lacks the webOS Chat default '$s'" >&2; exit 1; }
    done
    file "$AIM" | grep -q 'ARM, EABI5' || { echo "libaim.so is not an ARM EABI5 object" >&2; exit 1; }

    # the staged payload: postinst puts each piece in place
    node --check "$W/oscar/client/webos-chat/service/service.js"
    D="$W/data/usr/palm/webosarchive/webos-chat"
    mkdir -p "$D/purple-2" "$D/accounts" "$D/ls2/prv" "$D/ls2/pub"
    cp "$AIM" "$D/purple-2/libaim.so"
    cp -r "$W/oscar/client/webos-chat/accounts/$TPL" "$D/accounts/$TPL"
    cp -r "$W/oscar/client/webos-chat/service" "$D/service"
    mkdir -p "$D/app"
    cp -r "$W/oscar/client/webos-chat/app/$SETUP" "$D/app/$SETUP"
    for f in "$D/app/$SETUP"/source/*.js "$D/app/$SETUP/depends.js"; do node --check "$f"; done
    cp "$SRC/ls2/prv/$SVCID.json" "$D/ls2/prv/"
    cp "$SRC/ls2/pub/$SVCID.json" "$D/ls2/pub/"
    cp "$SRC/ls2/$SVCID.service" "$D/ls2/"
    printf '%s\n' "$COMMIT" > "$D/OSCAR_COMMIT"

    # the fixed IM transport, built from the pinned imlibpurpleservice commit
    "$ROOT/scripts/build-imlibpurpletransport.sh" > "$W/transport-build.log" 2>&1 \
        || { tail -20 "$W/transport-build.log" >&2; exit 1; }
    mkdir -p "$D/bin"
    cp "$ROOT/build/work/transport-build/out/imlibpurpletransport" "$D/bin/"
    # its keep-alive job script, from the same commit (has ls-hubd launch the transport)
    cp "$ROOT/build/work/transport-build/src/imlibpurpleservice/files/var/imdaemon.sh" "$D/bin/"
    sh -n "$D/bin/imdaemon.sh"
    cp "$SRC/TRANSPORT_COMMIT" "$D/TRANSPORT_COMMIT"
    for f in $(find "$D" -name '*.json') $(find "$D/service/configuration" -type f); do
        node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$f" \
            || { echo "bad JSON: $f" >&2; exit 1; }
    done
    (cd "$W/data" && tar --owner=0 --group=0 -czf "$W/ipk/data.tar.gz" ./usr)

    mkdir "$W/ctl"
    sed "s/@VERSION@/$VER/; s/@EPOCH@/$(date +%s)/" "$SRC/control" > "$W/ctl/control"
    echo "Installed-Size: $(du -sk "$W/data" | cut -f1)" >> "$W/ctl/control"
    install -m 755 "$SRC/postinst" "$SRC/prerm" "$W/ctl/"
    sh -n "$W/ctl/postinst"; sh -n "$W/ctl/prerm"
    (cd "$W/ctl" && tar --owner=0 --group=0 -czf "$W/ipk/control.tar.gz" ./control ./postinst ./prerm)
    printf '2.0\n' > "$W/ipk/debian-binary"
    rm -f "$IPK"
    (cd "$W/ipk" && ar rc "$IPK" debian-binary control.tar.gz data.tar.gz)
    echo "feed ipk: $IPK (Oscar $COMMIT)" && ls -la "$IPK"
    ;;
*)
    sed -n '2,4p' "$0"; exit 2
    ;;
esac
