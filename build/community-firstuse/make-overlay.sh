#!/bin/bash
# make-overlay.sh — generate build/overlays/community-firstuse/ : the CE Doctor
# overlay that swaps stock first-use for the community webOS Account flow.
#
# What lands in the overlay (see README.md here for the full story):
#   1. com.palm.app.firstuse replaced IN PLACE (id unchanged) with the community
#      webOS Account app from AddToImage/OOBE (org.webosarchive.webosaccount
#      ipk — the full app source, already carrying the community account flow),
#      plus the OOBE deltas in oobe/ (real Wi-Fi join, markFirstUseDone + reboot
#      completion, no Museum self-updater) and the trimmed OOBE card list
#      (oobe/config.js). The ipk's appinfo.json files are all EXCLUDED — the
#      app must keep the stock com.palm.app.firstuse identity or LunaSysMgr's
#      firstuse-mode launch can't find it.
#   2. com.palm.service.palmprofile: the ipk's service/ files laid over the
#      stock service (services.json + sources.json at the service root,
#      palm_profile_util.js -> utils/, the assistants -> handlers/) — the
#      webOS Archive backend plus updateUsername/syncDeviceName/signOut.
#   3. The account flow's hard transport prerequisites, baked into the rootfs:
#      modern curl (TLS 1.3) from the OpenSSL-legacyWebOS ipk, the ntpdate-sync
#      upstart job (TLS needs a sane clock), and a current CA bundle.
#   4. /var/gadget/novacom_enabled — every CE device is dev-unlocked out of the
#      box (community decision; deviceTool never needed again).
#
# Usage:  ./make-overlay.sh          (from build/community-firstuse/)
# Env:    TLSIPKS=<path to OpenSSL-legacyWebOS/ipks>
#         CA_BUNDLE=<current Mozilla bundle>            (default: pinned in-repo)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"                    # build/community-firstuse
BUILD="$(dirname "$HERE")"                               # build/
TLSIPKS="${TLSIPKS:-$BUILD/../../OpenSSL-legacyWebOS/ipks}"
# Pinned in-repo (see ca-certificates.README.md): defaulting to the build
# host's bundle made the image's trust store depend on whatever
# ca-certificates version that machine had installed.
CA_BUNDLE="${CA_BUNDLE:-$HERE/ca-certificates.crt}"
# Variant-aware (see bake.py's VARIANTS): bake.py hands us the OEM variant's
# work dir and overlay path. Defaults are the hp (Wi-Fi) build, so a standalone
# run behaves exactly as before.
ROOTFS_TGZ="${CE_ROOTFS_TGZ:-$BUILD/work/webos/nova-cust-image-topaz.rootfs.tar.gz}"
OUT="${CE_CF_OVERLAY:-$BUILD/overlays/community-firstuse}"
# assembled here first, moved to $OUT only when COMPLETE: a mid-run failure
# used to leave a half-built $OUT (changes.json is written last), which
# harness.py accepts as a valid overlay and turns into a flashable JAR
# missing curl/TLS/the CA bundle. Sibling path so the final mv is a rename.
STAGE="$OUT.new"

# prefer the project's AddToImage/PatchOrReplace copies (the user's statement
# of intent for image contents); fall back to the OpenSSL-legacyWebOS repo.
ATI_POR="$BUILD/../AddToImage/PatchOrReplace"

# highest-versioned <prefix>_*.ipk in a dir; prints nothing if none match.
# A plain `ls glob | tail` dies under set -euo pipefail when the glob is empty
# (ls exits 2, pipefail propagates, errexit kills the shell with stderr
# discarded) — which made the fallbacks below dead code and the missing-input
# diagnostics unreachable. Version order, not mtime: git does not preserve
# mtimes, so a fresh clone made an mtime pick arbitrary; a corrected rebuild
# that reuses the same version string overwrites the same filename, so version
# order loses nothing.
#
# Sort the VERSION FIELD, not the whole filename: for 1.0.1 vs 1.0.1.1 the tail
# after the common part is "_all.ipk" vs ".", and `sort -V` ranks the shorter
# version HIGHER there, so filename order would pick the superseded ipk. Same
# trap bake.py's _verkey() avoids.
newest_ipk() {
    local matches=() m ver
    shopt -s nullglob
    matches=("$1"/"$2"_*.ipk)
    shopt -u nullglob
    [ ${#matches[@]} -gt 0 ] || return 0
    for m in "${matches[@]}"; do
        ver="$(basename "$m")"; ver="${ver#"$2"_}"; ver="${ver%_*}"
        printf '%s\t%s\n' "$ver" "$m"
    done | sort -V -k1,1 | tail -n 1 | cut -f2-
}

CURL_IPK="$(newest_ipk "$ATI_POR" org.webosinternals.curl-tls13)"
[ -n "$CURL_IPK" ] || CURL_IPK="$(newest_ipk "$TLSIPKS" org.webosinternals.curl-tls13)"
NTP_IPK="$(newest_ipk "$ATI_POR" org.webosinternals.ntpdate-sync)"
[ -n "$NTP_IPK" ] || NTP_IPK="$(newest_ipk "$TLSIPKS" org.webosinternals.ntpdate-sync)"

# the firstuse replacement app: the AddToImage/OOBE webosaccount ipk
ATI_OOBE="$BUILD/../AddToImage/OOBE"
WOSA_IPK="$(newest_ipk "$ATI_OOBE" org.webosarchive.webosaccount)"

[ -n "$WOSA_IPK" ] || { echo "ERROR: no org.webosarchive.webosaccount_*.ipk in $ATI_OOBE" >&2; exit 1; }
[ -n "$CURL_IPK" ] || { echo "ERROR: no org.webosinternals.curl-tls13 ipk in $ATI_POR or $TLSIPKS" >&2; exit 1; }
[ -n "$NTP_IPK" ]  || { echo "ERROR: no org.webosinternals.ntpdate-sync ipk in $ATI_POR or $TLSIPKS" >&2; exit 1; }
for f in "$ROOTFS_TGZ" "$WOSA_IPK" "$CURL_IPK" "$NTP_IPK" "$CA_BUNDLE"; do
    [ -e "$f" ] || { echo "ERROR: missing input: $f" >&2; exit 1; }
done
echo ">> firstuse source: $(basename "$WOSA_IPK")"

APP=usr/palm/applications/com.palm.app.firstuse
SVC=usr/palm/services/com.palm.service.palmprofile

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP" "$STAGE"' EXIT

echo ">> 0) extract the webosaccount ipk (full app + service source)"
mkdir -p "$TMP/wosaipk" && (cd "$TMP/wosaipk" && ar x "$WOSA_IPK" && tar xzf data.tar.gz)
SRC="$TMP/wosaipk/usr/palm/webosarchive/webosaccount"
for f in "$SRC/app/FirstUse.js" "$SRC/app/source/tnc/Palm.js" "$SRC/service/services.json" \
         "$SRC/service/sources.json" "$SRC/service/palm_profile_util.js"; do
    [ -e "$f" ] || { echo "ERROR: webosaccount ipk payload missing $f" >&2; exit 1; }
done

echo ">> 1) assemble overlay rootfs (staged in $STAGE)"
rm -rf "$STAGE"
R="$STAGE/rootfs"
mkdir -p "$R/$APP" "$R/$SVC/utils" "$R/$SVC/handlers" \
         "$R/usr/lib/curl11" "$R/usr/bin" "$R/etc/ssl/certs" "$R/etc/event.d" "$R/var/gadget"

echo ">> 2) first-use app: webosaccount app over com.palm.app.firstuse"
# Every ipk appinfo.json is excluded (top-level AND per-locale resources/
# ones — they carry id com.palm.app.webosaccount; the com.palm.app.firstuse
# identity must survive or LunaSysMgr's firstuse-mode launch breaks).
# scripts/ is the author's dev tooling.
(cd "$SRC/app" && find . -type f ! -name appinfo.json ! -path "./scripts/*" -print0 \
    | while IFS= read -r -d '' f; do
        mkdir -p "$R/$APP/$(dirname "$f")"
        cp "$f" "$R/$APP/$f"
      done)
# hidden, matching stock firstuse (visible:false) — 2026-08-18 direction: this
# app is OOBE-only again. Post-OOBE account management is its own catalog app
# (own id, own service jail story — see accountservices-fork-server-wedge),
# not a launcher icon on this one. A standalone launch (no locale on the URL)
# still just closes like a normal app — the 1.1.10+ closeApp only finishes
# OOBE for the firstuse launch — but nothing routes a user to that launch.
WOSA_VER="$(basename "$WOSA_IPK" | cut -d_ -f2)"
cat > "$R/$APP/appinfo.json" <<APPINFO
{
	"id": "com.palm.app.firstuse",
	"version": "$WOSA_VER",
	"vendor": "webOS Archive",
	"type": "web",
	"main": "index.html",
	"title": "webOS Account",
	"icon": "images/icon.png",
	"visible": false,
	"uiRevision": 2
}
APPINFO

echo ">> 3) OOBE deltas on the app copy"
# The ipk is the STANDALONE build (assumes Wi-Fi is up, never marks first use
# done); the oobe/ deltas turn it into a real OOBE. patch -f: a mismatch with a
# new app build must fail the build loudly, not ship a half-OOBE image.
(cd "$R/usr/palm/applications" && patch -p1 -s -f) < "$HERE/oobe/FirstUse-oobe.patch"
echo "   patched $APP/FirstUse.js"
(cd "$R/usr/palm/applications" && patch -p1 -s -f) < "$HERE/oobe/Palm-oobe.patch"
echo "   patched $APP/source/tnc/Palm.js"
(cd "$R/usr/palm/applications" && patch -p1 -s -f) < "$HERE/oobe/Language-oobe.patch"
echo "   patched $APP/source/language/Language.js"
(cd "$R/usr/palm/applications" && patch -p1 -s -f) < "$HERE/oobe/StartOver-oobe.patch"
echo "   patched $APP/source/signin/StartOver.js"
cp "$HERE/oobe/config.js" "$R/$APP/config.js"   # trimmed OOBE card list
# NB: grep for the actual call, not "markFirstUseDone" — that string now survives
# only in a comment, so the old guard proved nothing and would have broken on a
# comment reword.
grep -q "PalmSystem.shutdown()" "$R/$APP/FirstUse.js" \
    || { echo "ERROR: OOBE completion delta missing from FirstUse.js" >&2; exit 1; }
# The launcher icon runs this same app, so a launch-mode check must survive every
# rebase onto a new app build: without it the language card renders on a normal
# launch, its constructor deletes the device's palm profile, and Done powers the
# device off (both seen live on 600009).
grep -q "wosaIsOobe" "$R/$APP/FirstUse.js" \
    || { echo "ERROR: launch-mode (isMinimal) delta missing from FirstUse.js" >&2; exit 1; }
grep -q "isMinimal" "$R/$APP/source/language/Language.js" \
    || { echo "ERROR: account-delete guard missing from Language.js" >&2; exit 1; }
grep -q 'typeof(inLocale) === "string") {' "$R/$APP/FirstUse.js" \
    && { echo "ERROR: closeApp still gates shutdown on inLocale" >&2; exit 1; }
# Start Over deletes the CONNECTED Wi-Fi profile; it renders on the terms and
# sign-in cards, which a launcher launch reaches. Both guards must survive.
grep -q "wosaIsOobe" "$R/$APP/source/signin/StartOver.js" \
    || { echo "ERROR: Start Over Wi-Fi-wipe guard missing from StartOver.js" >&2; exit 1; }
grep -q "if (this.wosaIsOobe) {" "$R/$APP/FirstUse.js" \
    || { echo "ERROR: OOBE-only gates missing from FirstUse.js start()" >&2; exit 1; }
# Setup must finish without a network or with our server down (no Wi-Fi in
# range, no internet, App Museum unreachable): every dialog that covers the
# cards' skip link needs its own Skip, and a silent terms request must time out.
grep -q "wifiPopupCancelDialogSkip" "$R/$APP/FirstUse.js" \
    || { echo "ERROR: offline Skip missing from the network dialog (FirstUse.js)" >&2; exit 1; }
grep -q "palmErrorSkip" "$R/$APP/source/tnc/Palm.js" \
    || { echo "ERROR: Skip missing from the terms error popup (Palm.js)" >&2; exit 1; }
grep -q "wosaTermsTimer" "$R/$APP/source/tnc/Palm.js" \
    || { echo "ERROR: terms request timeout missing (Palm.js)" >&2; exit 1; }

# Syntax-check every JS file we patch. These are hand-written diffs against an
# app we do not own; a bad hunk produces valid-looking JS that only fails when
# the card is rendered on a flashed device. node --check costs milliseconds.
JSCHECK="$(command -v node || command -v nodejs || true)"
if [ -n "$JSCHECK" ]; then
    for f in "$R/$APP/FirstUse.js" "$R/$APP/config.js" \
             "$R/$APP/source/tnc/Palm.js" \
             "$R/$APP/source/language/Language.js" \
             "$R/$APP/source/signin/StartOver.js"; do
        "$JSCHECK" --check "$f" \
            || { echo "ERROR: $f is not valid JavaScript after patching" >&2; exit 1; }
    done
    echo "   syntax-checked 5 patched JS files"
elif [ "${CE_SKIP_JS_CHECK:-0}" = "1" ]; then
    echo "   WARNING: node not found, JS syntax check SKIPPED (CE_SKIP_JS_CHECK=1)" >&2
else
    echo "ERROR: node/nodejs not found — cannot syntax-check the patched app JS." >&2
    echo "       Install node, or set CE_SKIP_JS_CHECK=1 to build anyway." >&2
    exit 1
fi

echo ">> 4) palmprofile service files from the ipk"
# The ipk ships the service files flat; the stock service layout is
# services.json + sources.json at the root, utils/ and handlers/ below —
# exactly how the ipk's own sources.json references them.
cp "$SRC/service/services.json"        "$R/$SVC/services.json"
cp "$SRC/service/sources.json"         "$R/$SVC/sources.json"
cp "$SRC/service/palm_profile_util.js" "$R/$SVC/utils/palm_profile_util.js"
for f in "$SRC/service/"*.js; do
    b="$(basename "$f")"
    [ "$b" = "palm_profile_util.js" ] && continue
    cp "$f" "$R/$SVC/handlers/$b"
done

echo ">> 5) modern curl (TLS 1.3) baked into the rootfs"
# Same layout the ipk's postinst produces on-device, minus the symlink: the
# binary's DT_NEEDED is libcurl.so.4, so ship the library under that name.
mkdir -p "$TMP/curlipk" && (cd "$TMP/curlipk" && ar x "$CURL_IPK" && tar xzf data.tar.gz)
CSRC="$TMP/curlipk/usr/palm/applications/org.webosinternals.curl-tls13/files/curl11"
cp "$CSRC/curl"            "$R/usr/lib/curl11/curl"
cp "$CSRC/libcurl.so.4.8.0" "$R/usr/lib/curl11/libcurl.so.4"
cp "$CSRC/libssl.so.1.1"   "$R/usr/lib/curl11/libssl.so.1.1"
cp "$CSRC/libcrypto.so.1.1" "$R/usr/lib/curl11/libcrypto.so.1.1"
chmod 755 "$R/usr/lib/curl11/"*
# wrapper (identical as /usr/bin/curl and /usr/bin/curl11; stock has no /usr/bin/curl)
cat > "$R/usr/bin/curl11" <<'WRAP'
#!/bin/sh
[ -n "$CURL_CA_BUNDLE" ] || CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
export CURL_CA_BUNDLE LD_LIBRARY_PATH=/usr/lib/curl11
exec /usr/lib/curl11/curl "$@"
WRAP
cp "$R/usr/bin/curl11" "$R/usr/bin/curl"
chmod 755 "$R/usr/bin/curl" "$R/usr/bin/curl11"

echo ">> 6) clock + trust: ntpdate-sync job, current CA bundle"
mkdir -p "$TMP/ntpipk" && (cd "$TMP/ntpipk" && ar x "$NTP_IPK" && tar xzf data.tar.gz)
cp "$TMP/ntpipk/usr/palm/applications/org.webosinternals.ntpdate-sync/files/ntpdate-sync" \
   "$R/etc/event.d/ntpdate-sync"
chmod 755 "$R/etc/event.d/ntpdate-sync"
cp "$CA_BUNDLE" "$R/etc/ssl/certs/ca-certificates.crt"

echo ">> 7) dev unlock out of the box"
: > "$R/var/gadget/novacom_enabled"

# The STOCK per-locale appinfo.json overrides must go: webOS merges
# resources/<locale>/appinfo.json over the base appinfo, and stock's carry
# "HP webOS"/hidden — they silently override the CE "webOS Account" visible
# appinfo (confirmed live: getAppInfo returned the stock en locale merge and
# no launch point existed). Our ipk's locale appinfos are excluded too (they
# carry the wrong id), so the base appinfo is authoritative everywhere.
cat > "$STAGE/changes.json" <<'JSON'
{
  "description": "Community first-use swap: com.palm.app.firstuse replaced in place with the AddToImage/OOBE webosaccount app (OOBE deltas applied), palmprofile service -> device.php backend, + its transport prerequisites (modern curl/TLS 1.3, ntpdate-sync, current CA bundle) and novacom enabled. Generated by community-firstuse/make-overlay.sh - do not edit by hand.",
  "ce_package": "org.webosarchive.ce-files",
  "remove": [
    "/usr/palm/applications/com.palm.app.firstuse/resources/it/appinfo.json",
    "/usr/palm/applications/com.palm.app.firstuse/resources/de/appinfo.json",
    "/usr/palm/applications/com.palm.app.firstuse/resources/fr/appinfo.json",
    "/usr/palm/applications/com.palm.app.firstuse/resources/fr/ca/appinfo.json",
    "/usr/palm/applications/com.palm.app.firstuse/resources/es/appinfo.json",
    "/usr/palm/applications/com.palm.app.firstuse/resources/es/es/appinfo.json",
    "/usr/palm/applications/com.palm.app.firstuse/resources/en/appinfo.json",
    "/usr/palm/applications/com.palm.app.firstuse/resources/en/ca/appinfo.json"
  ]
}
JSON

# overlay is complete — only now replace the real output dir
rm -rf "$OUT"
mv "$STAGE" "$OUT"

echo ">> done: $OUT"
find "$OUT/rootfs" -type f | sed "s|$OUT/rootfs|  |" | sort
