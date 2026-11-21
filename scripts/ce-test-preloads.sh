#!/bin/sh
# webOS CE preload/exhibition delta checks. Build-agnostic:
#   sh ce-test-preloads.sh [EXPECTED_BUILDMARK]   (default 600029)
# Run AFTER first boot completes (OOBE done); preloads install during first
# use, so running earlier reports them as pending, not failed.
# For the general test plan, also re-run ce-test-600011.sh.
# Output format: [PASS]/[FAIL]/[INFO] <test> -- detail
P() { echo "[PASS] $*"; }
F() { echo "[FAIL] $*"; }
I() { echo "[INFO] $*"; }

EXPECT=${1:-600029}
echo "===== webOS CE $EXPECT delta checks: $(date) ====="

# --- Build identity ---
BI=$(cat /etc/palm-build-info 2>/dev/null)
echo "$BI" | grep -q "BUILDMARK=$EXPECT" && P "build identity BUILDMARK=$EXPECT" || F "build identity -- $BI"

# --- 1. Un-baking: neither app may exist on the rootfs any more ---
[ ! -d /usr/palm/applications/com.palm.app.enyo-findapps ] \
  && P "App Catalog not baked (rootfs dir absent)" \
  || F "App Catalog STILL BAKED at /usr/palm/applications/com.palm.app.enyo-findapps"
[ ! -d /usr/palm/applications/com.palm.app.maps ] \
  && P "Maps not baked (rootfs dir absent)" \
  || F "Maps STILL BAKED at /usr/palm/applications/com.palm.app.maps"

# --- 2. Staged preloads present; stock stale ipks gone ---
[ -f /usr/palm/ipkgs/com.palm.app.enyo-findapps_6.1.2901_all.ipk ] \
  && P "catalog 6.1.2901 staged in /usr/palm/ipkgs" || F "catalog staged ipk MISSING"
[ ! -f /usr/palm/ipkgs/com.palm.app.enyo-findapps_5.0.2900_all.ipk ] \
  && P "stock 5.0.2900 catalog ipk removed" || F "stock 5.0.2900 catalog ipk still staged"
M=/usr/palm/ipkgs/com.palm.app.maps
if [ -f $M/com.palm.app.maps_4.0.1_all.ipk ] && [ -f $M/com.palm.app.maps-icon.png ] \
   && [ -f $M/manifest.json ]; then
  P "maps 4.0.1 staged (ipk + icon + manifest)"
else
  F "maps staging incomplete: $(ls $M 2>&1)"
fi
[ ! -f $M/com.palm.app.maps_3.0.1_all.ipk ] \
  && P "stock 3.0.1 maps ipk removed" || F "stock 3.0.1 maps ipk still staged"
grep -q '"com.palm.app.maps"' $M/manifest.json 2>/dev/null \
  && grep -q '4.0.1' $M/manifest.json 2>/dev/null \
  && P "maps manifest points at 4.0.1" || F "maps manifest wrong: $(cat $M/manifest.json 2>&1)"

# --- 3. Top-level preload registry ---
TM=/usr/palm/ipkgs/manifest.json
grep -q '6.1.2901' $TM && P "manifest: catalog entry -> 6.1.2901" || F "manifest: catalog entry stale"
grep -q 'com.palm.app.maps_4.0.1' $TM && P "manifest: maps entry -> 4.0.1" || F "manifest: maps entry stale"
if grep -qE '"com.palm.app.(contacts|messaging)"' $TM; then
  F "manifest still advertises baked contacts/messaging"
else
  P "manifest: baked contacts/messaging entries dropped"
fi

# --- 4. THE test: both installed to cryptofs and SURVIVING ---
# (installed by app-install during first use; ce-firstboot-tweaks must NOT
# delete them — they are out of its de-shadow list as of this build)
C=/media/cryptofs/apps/usr/palm/applications
S=/media/cryptofs/apps/usr/lib/ipkg/status
for app in com.palm.app.enyo-findapps com.palm.app.maps; do
  if [ -d $C/$app ]; then
    ver=$(awk -v a=$app '$0=="Package: "a{f=1} f&&/^Version:/{print $2; exit}' $S 2>/dev/null)
    P "$app installed in cryptofs (version ${ver:-unknown})"
  else
    F "$app NOT in cryptofs -- preload install failed, was deleted (de-shadow regression), or first use has not finished"
  fi
done
if [ -f /var/log/ce-firstboot-tweaks.log ]; then
  if grep -qE "enyo-findapps|com.palm.app.maps" /var/log/ce-firstboot-tweaks.log; then
    F "firstboot-tweaks log MENTIONS catalog/maps -- de-shadow touched them"
    I "log: $(grep -E 'enyo-findapps|com.palm.app.maps' /var/log/ce-firstboot-tweaks.log)"
  else
    P "firstboot-tweaks de-shadow did not touch catalog/maps"
  fi
else
  I "no ce-firstboot-tweaks.log (job may not have run yet)"
fi

# --- 5. Exhibition clock QML (SimpleClock default face, stock trio kept) ---
Q=/usr/palm/sysmgr/uiComponents/DockModeTime
[ -f $Q/SimpleClock.qml ] && grep -q "SimpleClock" $Q/Clocks.qml 2>/dev/null \
  && P "SimpleClock.qml present and referenced by Clocks.qml" \
  || F "dock-mode SimpleClock missing or unreferenced"
[ -f $Q/AnalogClock.qml ] && [ -f $Q/DigitalClock.qml ] \
  && P "stock analog/digital faces still present" || F "stock clock faces missing"

# --- 6. GAMES tab localization ---
L=/usr/palm/sysmgr/localization
ok=1
for pair in "de_de:SPIELE" "fr_fr:JEUX" "it_it:GIOCHI" "es_es:JUEGOS" "en_gb:GAMES"; do
  loc=${pair%%:*}; want=${pair##*:}
  grep -q "\"GAMES\": \"$want\"" $L/$loc/strings.json 2>/dev/null || { ok=0; F "GAMES l10n $loc != $want"; }
done
[ $ok = 1 ] && P "GAMES localized (de/fr/it/es + en fallback)"

# --- 7. Photos exhibition clock rode in via the repacked preload ipk ---
PA=$C/com.palm.app.photos
if [ -d $PA ]; then
  [ -f $PA/images/icn-slidetiming.png ] \
    && grep -q "ec-shadow" $PA/css/SlideshowMode.css 2>/dev/null \
    && grep -q "onClockToggleClicked" $PA/source/modes/SlideshowMode.js 2>/dev/null \
    && P "photos exhibition clock installed (icon + CSS + JS)" \
    || F "photos app installed but exhibition clock pieces missing"
else
  F "photos app not yet in cryptofs (first use finished?)"
fi

# --- 7b. staged customization media kept: the source a Full Erase copies from (issue #14) ---
STAGE=/usr/lib/luna/customization/copy_binaries/media/internal
if [ -f $STAGE/ringtones/Pre.mp3 ]; then
  P "staged customization media kept ($(du -sm $STAGE 2>/dev/null | cut -f1)MB)"
else
  F "staged customization media missing: a Full Erase would leave no ringtones/wallpapers"
fi
# live media must be untouched
I "live media: wallpapers=$(ls /media/internal/wallpapers 2>/dev/null | wc -l) ringtones=$(ls /media/internal/ringtones 2>/dev/null | wc -l)"

# --- 8. rootfs pressure ---
I "rootfs: $(df -h / | tail -1)"
echo "===== done ====="
# Human checks (not scriptable):
#  - Exhibition: opens on the new simple clock; swipe through all 4 faces
#  - Photos exhibition: clock shows, toggle works, interval persists across
#    dock sessions (NOTE: a Doctor flash wipes /var, so prefs start fresh)
#  - GAMES tab shows SPIELE after switching the device language to German
#  - App Catalog opens, browses, and can install an app
