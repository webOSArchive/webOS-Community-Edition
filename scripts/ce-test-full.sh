#!/bin/sh
# webOS CE full automated test pass — everything in Docs/TEST-PLAN.md that a shell can
# decide. Anything needing eyes or hands is NOT here; those stay [Human] in the plan.
#
#   sh ce-test-full.sh [EXPECTED_BUILDMARK]      (default 600029)
#
# Output: [PASS] / [FAIL] / [INFO] <section> <test> -- detail
# Run AFTER first use completes. luna-send needs </dev/null under novacom.
EXPECT=${1:-600029}
P() { echo "[PASS] $*"; }
F() { echo "[FAIL] $*"; }
I() { echo "[INFO] $*"; }
have() { [ -e "$1" ]; }

APPS=/media/cryptofs/apps/usr/palm/applications
STATUS=/media/cryptofs/apps/usr/lib/ipkg/status
LOG=/var/log/messages

echo "===== webOS CE automated pass — expecting BUILDMARK=$EXPECT — $(date) ====="

# ---------------------------------------------------------------- identity
BI=$(cat /etc/palm-build-info 2>/dev/null)
echo "$BI" | grep -q "BUILDMARK=$EXPECT" && P "id  BUILDMARK=$EXPECT" || F "id  BUILDMARK -- $BI"
echo "$BI" | grep -q "PRODUCT_VERSION_STRING=webOS CE 3.1.0" && P "id  version string webOS CE 3.1.0" || F "id  version string"
I  "id  $(grep BUILDTIME /etc/palm-build-info 2>/dev/null)"
I  "id  uptime:$(uptime | sed 's/.*up/ up/')"

# ---------------------------------------------------------------- 0b. respawn storm
n=$(grep -c "ipkgservice main process ended, respawning" $LOG 2>/dev/null)
[ "$n" = "0" ] && P "0b  no ipkgservice respawn events" || F "0b  ipkgservice respawned $n time(s)"
n=$(grep "respawning too fast" $LOG 2>/dev/null | grep -c ipkgservice)
[ "$n" = "0" ] && P "0b  no 'respawning too fast'" || F "0b  respawning too fast x$n"
# Luna Restart prerequisite: the service must be upstart-resident, not on-demand
if initctl status org.webosinternals.ipkgservice 2>/dev/null | grep -qE "\(start\) running"; then
  P "0   ipkgservice resident (Luna Restart prerequisite)"
else
  F "0   ipkgservice NOT resident -- Luna Restart may freeze: $(initctl status org.webosinternals.ipkgservice 2>&1)"
fi

# upstart crash + self re-exec. On a fatal signal upstart forks a core-dumper and
# then execl()s itself; the re-exec loses its job table, so `respawn` silently
# stops working for anything already running. Check this BEFORE concluding that a
# dead daemon "just died" -- it may have died normally and simply not come back.
n=$(grep -cE "Caught .*(segmentation fault|core dumped)|Failed to re-execute" $LOG 2>/dev/null)
[ "$n" = "0" ] && P "0b  upstart never crashed/re-exec'd" \
  || F "0b  upstart crashed + re-exec'd ($n) -- respawn is UNRELIABLE for already-running jobs from that point"

# rdxd crash reports, by component. The /var/log/crash* count in section 8 does
# NOT see these, and every crash found during 600029-600033 triage was an rdxd
# report. NB a report whose component is "upstart" is usually upstart's own
# core-dumper child working as designed, not an upstart bug.
n=0; comps=""
for f in /var/log/rdxd/pending/*.tgz; do
  [ -e "$f" ] || continue
  c=$(tar xzOf "$f" overview.txt 2>/dev/null | sed -n 's/^REPORT_COMPONENT=//p')
  comps="$comps $c"; n=$((n+1))
done
[ "$n" = "0" ] && P "0b  no rdxd crash reports" || F "0b  $n rdxd crash report(s):$(printf '%s' "$comps" | tr ' ' '\n' | sort | uniq -c | tr '\n' ' ')"

# LunaDownloadMgr: hosts com.palm.appInstallService too, so its death also breaks
# the App Catalog. 600033 shipped a one-byte patch disabling the runtime glibcurl
# multi-handle restart (a crash trigger); "Restarting glibcurl" must stay at 0.
if pidof LunaDownloadMgr >/dev/null 2>&1; then
  P "0b  LunaDownloadMgr running (pid $(pidof LunaDownloadMgr))"
else
  F "0b  LunaDownloadMgr NOT running -- downloads and App Catalog are dead (recover: start LunaDownloadMgr)"
fi
m=$(md5sum /usr/bin/LunaDownloadMgr 2>/dev/null | cut -d' ' -f1)
[ "$m" = "a618391be0d8f16f8b70fd653f85a583" ] && P "0b  LunaDownloadMgr is the patched build" \
  || F "0b  LunaDownloadMgr md5 $m -- expected patched a618391be0d8f16f8b70fd653f85a583"
n=$(grep -c "Restarting glibcurl" $LOG 2>/dev/null)
[ "$n" = "0" ] && P "0b  glibcurl restart path dead (patch holding)" || F "0b  glibcurl restarted $n time(s) -- patch NOT in effect"
n=$(grep -c "LunaDownloadMgr main process .* killed by SEGV" $LOG 2>/dev/null)
[ "$n" = "0" ] && P "0b  LunaDownloadMgr no SEGV this boot" || F "0b  LunaDownloadMgr SEGV x$n"

# ---------------------------------------------------------------- 1. first-boot seeding
have /var/luna/preferences/ce-cryptofs-seeded && P "1   cryptofs seed flag set" || F "1   cryptofs seed flag missing"
if have /var/log/ce-cryptofs-seed.log; then
  grep -q "seed verified complete" /var/log/ce-cryptofs-seed.log \
    && P "1   seed verified complete" || F "1   seed never verified"
  I "1   seed log tail: $(tail -1 /var/log/ce-cryptofs-seed.log)"
else
  F "1   no ce-cryptofs-seed.log"
fi
for f in ce-cryptofs-deshadowed ce-preloads-deshadowed ce-default-wallpaper ce-customization-media-reclaimed; do
  have /var/luna/preferences/$f && P "1   flag $f" || F "1   flag $f MISSING"
done
have /media/cryptofs/apps/etc/ipkg/arch.conf && P "1   Preware feeds seeded" || F "1   Preware feeds missing"

# ---------------------------------------------------------------- 4. core apps
for a in com.palm.app.contacts com.palm.app.messaging com.palm.app.phone com.palm.app.accounts; do
  if [ -d /usr/palm/applications/$a ]; then
    if [ -d $APPS/$a ]; then F "4   $a SHADOWED by a cryptofs copy"; else P "4   $a baked, unshadowed"; fi
  else
    F "4   $a missing from rootfs"
  fi
done
v=$(grep -o '"version"[^,]*' /usr/palm/applications/com.palm.app.accounts/appinfo.json 2>/dev/null | head -1)
I  "4   accounts app $v"
if luna-send -n 1 -a com.palm.app.contacts palm://com.palm.db/find '{"query":{"from":"com.palm.person:1"}}' </dev/null 2>/dev/null | grep -q '"returnValue":true'; then
  P "4   db8 healthy (com.palm.person:1 answers)"
else
  F "4   db8 query for com.palm.person:1 failed"
fi

# ---------------------------------------------------------------- 5. synergy runtime
have /media/cryptofs/synergy-glibc/lib/ld-linux.so.3 && P "5   synergy glibc ld-linux present" || F "5   synergy glibc missing"
[ -d /media/cryptofs/synergy-runtime ] && [ -d /media/cryptofs/synergy-purple-plugins ] \
  && P "5   synergy runtime dirs present" || F "5   synergy runtime dirs missing"
imt=$(initctl status imtransport 2>/dev/null)
imtpid=$(echo "$imt" | sed -n 's/.*process \([0-9]*\).*/\1/p')
if echo "$imt" | grep -qE "\(start\) running" && [ -n "$imtpid" ] \
   && tr '\0' ' ' < /proc/$imtpid/cmdline 2>/dev/null | grep -q imlibpurpletransport; then
  P "5   imtransport running (pid $imtpid = imlibpurpletransport)"
else
  F "5   imtransport not running -- $imt"
fi
grep -q "synergy-runtime" /proc/mounts && P "5   synergy bind mount live" || F "5   synergy bind mount missing"
[ -d /usr/palm/applications/com.palm.app.cloud-auth ] && P "5   cloud-auth present" || F "5   cloud-auth missing"
[ ! -d $APPS/com.palm.app.docviewer ] && P "5   docviewer absent (intentional)" || F "5   docviewer present (should be excluded)"
gone=0
for a in com.palm.app.skype com.palm.app.yahoo; do [ -d /usr/palm/applications/$a ] && gone=1; done
[ $gone = 0 ] && P "5   retired accounts (skype/yahoo) gone" || F "5   a retired account app is still present"
miss=""
for g in audioresample matroska ogg opus speex vpx; do
  have /usr/lib/gstreamer-0.10/libgst$g.so || miss="$miss $g"
done
[ -z "$miss" ] && P "5   gst WebM/Opus plugins present (6/6)" || F "5   gst plugins missing:$miss"
for a in com.quickoffice.ar com.quickoffice.webos com.palm.app.photos; do
  [ -d $APPS/$a ] && P "5   $a installed to cryptofs" || F "5   $a NOT installed"
done
have $APPS/com.quickoffice.webos/source/RemoteFileService.js \
  && P "5   QuickOffice RemoteFileService.js present (synergy patch)" || F "5   QuickOffice synergy patch missing"
grep -q "Synergy-revival" /usr/palm/services/com.palm.service.photos/photos-src/base/Utils.js 2>/dev/null \
  && P "5   photos service patch marker present" || F "5   photos service patch marker missing"

# ---------------------------------------------------------------- 6. preware / status
if luna-send -n 1 palm://org.webosinternals.ipkgservice/getStatus '{}' </dev/null 2>/dev/null | grep -q returnValue; then
  P "6   ipkgservice answers"
else
  F "6   ipkgservice did not answer"
fi
for pk in org.webosinternals.preware org.webosinternals.govnah com.palm.synergy.generic \
          com.palm.app.videos com.palm.app.calculator org.webosarchive.media-tls13; do
  c=$(grep -c "^Package: $pk\$" $STATUS 2>/dev/null)
  [ "$c" = "1" ] && P "6   status stanza $pk (1)" || F "6   status stanza $pk = $c (want 1)"
done
for pk in com.webosarchive.usbsettings org.webosarchive.btgamepad; do
  c=$(grep -c "^Package: $pk\$" $STATUS 2>/dev/null)
  [ "$c" = "0" ] && P "6   $pk correctly absent from ipkg status" || F "6   $pk present in status ($c)"
done
en=$(grep -l "" /media/cryptofs/apps/etc/ipkg/*.conf 2>/dev/null | wc -l)
dis=$(ls /media/cryptofs/apps/etc/ipkg/*.disabled 2>/dev/null | wc -l)
I  "6   feed configs: $en enabled, $dis disabled"
for f in webos-patches webos-kernels; do
  have /media/cryptofs/apps/etc/ipkg/$f.conf.disabled && P "6   $f ships disabled" \
    || { have /media/cryptofs/apps/etc/ipkg/$f.conf && F "6   $f is ENABLED (should ship disabled)" || I "6   $f feed not present"; }
done
# .ipk -> Preware handoff. Do NOT test the static command-resource-handlers.json:
# a static entry is always registered non-streamable, and the browser only hands a
# .ipk URL to the handler when canStream is true, so a static entry actively BREAKS
# this (and dedupes the runtime call that would fix it). The shipped mechanism is
# the ce-register-ipk-handler job calling addResourceHandler at first boot, so ask
# LunaSysMgr what it actually resolves. Guarded: an unknown method hangs luna-send.
if grep -q '"extn": *"ipk"' /usr/palm/command-resource-handlers.json 2>/dev/null; then
  F "6   a STATIC ipk entry is present -- it forces streamable=false and breaks the handoff"
else
  P "6   no static ipk entry (correct; registration is done at runtime)"
fi
( luna-send -n 1 palm://com.palm.applicationManager/getResourceInfo \
    '{"uri":"file:///media/internal/downloads/.ce-test.ipk"}' </dev/null > /tmp/.ipkres 2>&1 ) &
_p=$!; _i=0
while [ $_i -lt 10 ] && kill -0 $_p 2>/dev/null; do sleep 1; _i=$((_i+1)); done
kill -9 $_p 2>/dev/null
res=$(cat /tmp/.ipkres 2>/dev/null); rm -f /tmp/.ipkres
case "$res" in
  *org.webosinternals.preware*) app=ok ;;
  *) app=no ;;
esac
case "$res" in
  *'"canStream": true'*) strm=ok ;;
  *) strm=no ;;
esac
if [ "$app" = ok ] && [ "$strm" = ok ]; then
  P "6   .ipk resolves to Preware AND is streamable (browser will hand off)"
else
  F "6   .ipk handoff broken (handler=$app streamable=$strm): $(printf '%s' "$res" | cut -c1-140)"
fi
have /var/luna/preferences/ce-ipk-handler-registered \
  && P "6   ce-register-ipk-handler ran and verified" \
  || F "6   ce-register-ipk-handler has not flagged (it retries next boot)"

# ---------------------------------------------------------------- 7. CE tweaks
grep -q "turnOnNovacomAtStart=true" /etc/palm/sysservice.conf 2>/dev/null \
  && P "7   novacom-at-start baked" || F "7   novacom-at-start missing"
grep -q '"keyboardSize":-1\|keyboardSize.*-1' /etc/palm/defaultPreferences.txt 2>/dev/null \
  && P "7   keyboard defaults small" || I "7   keyboard default: $(grep -i keyboard /etc/palm/defaultPreferences.txt 2>/dev/null | head -1)"
n=$(strings /usr/bin/LunaSysMgr 2>/dev/null | grep -c "HP webOS ")
[ "$n" = "0" ] && P "7   version-prefix patch: 0 'HP webOS ' in LunaSysMgr" || F "7   'HP webOS ' still in LunaSysMgr x$n"

# Device Info account label (600070): "HP webOS Account" -> "webOS Account" across
# every locale's view overrides. Counts the phrase in the VIEW files only -- the
# app's other "HP webOS" strings are the retail demo feature and stay put, so a
# grep over the whole app would always hit.
DI=/usr/palm/applications/com.palm.app.deviceinfo
# Explicit globs rather than find -path: busybox find is not guaranteed to have
# -path, and an empty result piped to xargs grep would read stdin and hang.
di_seen=0; di_bad=0
for f in $DI/app/views/list/list-scene.html \
         $DI/app/views/erase/fullerase-dialog.html \
         $DI/resources/*/views/list/list-scene.html \
         $DI/resources/*/views/erase/fullerase-dialog.html \
         $DI/resources/*/*/views/list/list-scene.html \
         $DI/resources/*/*/views/erase/fullerase-dialog.html; do
  [ -f "$f" ] || continue
  di_seen=$((di_seen + 1))
  grep -q "HP webOS" "$f" 2>/dev/null && { di_bad=$((di_bad + 1)); I "7   still branded: $f"; }
done
if [ "$di_seen" -lt 10 ]; then
  F "7   Device Info: only $di_seen view file(s) found -- expected ~12, check the layout"
elif [ "$di_bad" = "0" ]; then
  P "7   Device Info account label de-branded ($di_seen view files, 0 say 'HP webOS')"
else
  F "7   Device Info still says 'HP webOS' in $di_bad of $di_seen view file(s)"
fi

# ---------------------------------------------------------------- 8. regressions
for a in com.palm.app.kindle com.palm.app.enyo-facebook com.palm.app.youtube; do
  [ ! -d $APPS/$a ] && P "8   HP preload $a absent" || F "8   HP preload $a present"
done
n=$(grep -c "is not listed in any role file" $LOG 2>/dev/null)
[ "$n" = "0" ] && P "8   ls-hubd clean (0 unlisted-service errors)" || F "8   ls-hubd unlisted-service errors: $n"
n=$(ls /var/ssl/trustedcerts 2>/dev/null | wc -l)
[ "$n" -gt 150 ] && P "8   trust store populated ($n entries)" || F "8   trust store thin ($n)"
# Real assertion, not an INFO: any crash artifact is a failure.
arts=$(ls /media/cryptofs/.crash* /var/log/crash* 2>/dev/null)
n=$(printf '%s' "$arts" | grep -c .)
[ "$n" = "0" ] && P "8   no crash artifacts" \
  || { F "8   $n crash artifact(s):"; printf '%s\n' "$arts" | sed 's/^/       /'; }

# Did the ipkgservice upstart race fire this boot (KNOWN-ISSUES #1)? The repair
# in ce-cryptofs-seed makes it recoverable, so this is INFO, not FAIL -- the
# pass/fail assertion is the "ipkgservice resident" check in section 0. But the
# marker is how we learn the race's real frequency across builds, so surface it.
# NB "seen at least once", NOT "this boot": ce-cryptofs-seed.log is never
# truncated, so it spans every boot since the flash. Saying "this boot" once
# reported a repair from the PREVIOUS boot as if it had just happened.
n=$(grep -c "REPAIRING ipkgservice" /var/log/ce-cryptofs-seed.log 2>/dev/null)
if [ "${n:-0}" != "0" ]; then
  I "0b  ipkgservice race fired $n time(s) since this flash, each repaired:"
  grep -A2 "REPAIRING ipkgservice" /var/log/ce-cryptofs-seed.log | tail -3 | sed 's/^/       /'
  I "       (last repair above; ipkgservice residency is asserted in section 0)"
else
  P "0b  ipkgservice job intact (race has not fired since this flash)"
fi

# App-store root + repair marker (KNOWN-ISSUES #10). A flash whose AppDeletion
# stage hit a read-only /media/internal leaves the encrypted store half-wiped:
# /media/cryptofs/apps never comes back, so the stock preload pass fails every
# package and retries forever on the pulsing logo. ce-cryptofs-seed now recreates
# the root -- so ALSO fail when it had to, because a repair on a supposedly clean
# flash means the wipe failed and we are only papering over it.
if [ -d /media/cryptofs/apps/usr/palm/applications ]; then
  P "8   app-store root present ($(ls /media/cryptofs/apps/usr/palm/applications 2>/dev/null | wc -l) apps)"
else
  F "8   app-store root MISSING -- preloads cannot install (see KNOWN-ISSUES #10)"
fi
n=$(grep -c "REPAIRED" /var/log/ce-cryptofs-seed.log 2>/dev/null)
if [ "${n:-0}" = "0" ]; then
  P "8   no store repair needed (flash wiped the app store cleanly)"
else
  F "8   store root was REPAIRED by ce-cryptofs-seed -- the flash left it missing:"
  grep "REPAIRED" /var/log/ce-cryptofs-seed.log 2>/dev/null | head -2 | sed 's/^/       /'
fi

# Power-off path (RC2 issue #1). /sbin/{halt,poweroff} are symlinks to
# /sbin/reboot, and that binary picks halt vs power-off vs reboot from
# basename(argv[0]) -- so ANY wrapper in front of these three names turns the
# power menu's Shut Down into a reboot. The retired 600011..600058 reboot
# tripwire did exactly that. Assert the three names still reach the real
# binary directly: ELF, not a script, and no *.real leftovers.
# Test for a SHEBANG, not for ELF: this busybox (1.17.3) has no `head -c` and no
# `od`, so the first version of this check read every binary as a script and
# failed on a device that was correct. `head -n 1 | grep "^#!"` needs nothing
# busybox lacks, and it tests the thing that actually matters — whether a shell
# wrapper sits in front of the name.
bad=""
for t in reboot poweroff halt telinit; do
  [ -e "/sbin/$t" ] || { bad="$bad $t:missing"; continue; }
  head -n 1 "/sbin/$t" 2>/dev/null | grep -q "^#!" && bad="$bad $t:script"
done
for t in /sbin/reboot.real /sbin/telinit.real; do
  [ -e "$t" ] && bad="$bad $t:present"
done
[ -z "$bad" ] && P "8   power-off path unwrapped (reboot/poweroff/halt/telinit are the real binaries)" \
  || F "8   power-off path WRAPPED -- Shut Down will reboot:$bad"
grep -q "webosarchive" /usr/palm/applications/com.palm.app.help/appinfo.json 2>/dev/null \
  || grep -rq "webosarchive" /usr/palm/applications/com.palm.app.help/ 2>/dev/null \
  && P "8   Help app repointed at webosarchive" || I "8   Help app repoint not detected by grep"

# ---------------------------------------------------------------- 9. preload/un-baking (600025+)
for a in com.palm.app.enyo-findapps com.palm.app.maps; do
  [ ! -d /usr/palm/applications/$a ] && P "9   $a not baked" || F "9   $a STILL BAKED"
  if [ -d $APPS/$a ]; then
    v=$(awk -v a=$a '$0=="Package: "a{f=1} f&&/^Version:/{print $2; exit}' $STATUS 2>/dev/null)
    c=$(grep -c "^Package: $a\$" $STATUS 2>/dev/null)
    [ "$c" = "1" ] && P "9   $a installed in cryptofs v${v:-?} (1 stanza)" \
                   || F "9   $a has $c stanzas (2 = installed alongside, not upgraded)"
  else
    F "9   $a NOT in cryptofs -- preload install failed or was deleted"
  fi
done
# Version-agnostic on purpose: these used to hardcode 6.1.2901 / 4.0.1 and went
# stale the moment AddToImage got a newer ipk, reporting a FAIL for a healthy build.
# Assert "exactly one staged, and it isn't the stock one" instead, and print what it is.
n=$(ls /usr/palm/ipkgs/com.palm.app.enyo-findapps_*_all.ipk 2>/dev/null | wc -l)
cat_ipk=$(ls /usr/palm/ipkgs/com.palm.app.enyo-findapps_*_all.ipk 2>/dev/null | head -1)
if [ "$n" = "1" ] && [ "$(basename "${cat_ipk:-none}")" != "com.palm.app.enyo-findapps_5.0.2900_all.ipk" ]; then
  P "9   catalog ipk staged ($(basename "$cat_ipk"))"
else
  F "9   catalog ipk staging wrong: $n staged [$(ls /usr/palm/ipkgs/com.palm.app.enyo-findapps_*_all.ipk 2>/dev/null | tr '\n' ' ')]"
fi
n=$(ls /usr/palm/ipkgs/com.palm.app.maps/com.palm.app.maps_*_all.ipk 2>/dev/null | wc -l)
map_ipk=$(ls /usr/palm/ipkgs/com.palm.app.maps/com.palm.app.maps_*_all.ipk 2>/dev/null | head -1)
[ "$n" = "1" ] && P "9   maps ipk staged ($(basename "$map_ipk"))" \
  || F "9   maps ipk staging wrong: $n staged"
[ ! -f /usr/palm/ipkgs/com.palm.app.enyo-findapps_5.0.2900_all.ipk ] && P "9   stock 5.0.2900 ipk removed" || F "9   stock catalog ipk still staged"
[ ! -e /usr/palm/ipkgs/com.palm.app.calculator ] && P "9   stock Calculator preload removed" || F "9   stock Calculator preload still staged"
grep -q '"version": "3.2.0"' /usr/palm/applications/com.palm.app.calculator/appinfo.json 2>/dev/null \
  && P "9   Calculator 3.2.0 baked" || F "9   Calculator 3.2.0 not baked"
[ -f /usr/lib/gstreamer-0.10/libgstcurlhttpsrc.so ] && [ ! -e /usr/lib/gstreamer-0.10/libgstsouphttpsrc.so ] \
  && P "9   souphttpsrc is the Media TLS element (stock plugin absent)" || F "9   Media TLS: plugin set wrong [$(ls /usr/lib/gstreamer-0.10 | grep -i http | tr '\n' ' ')]"
c=$(grep -c "org.webosarchive.appcatalog" $STATUS 2>/dev/null)
[ "$c" = "0" ] && P "9   no mis-named appcatalog stanza" || F "9   mis-named org.webosarchive.appcatalog stanza present"
# corrupt filenames from >100-char tar paths
n=$(find $APPS/com.palm.app.enyo-findapps -name "*000[0-7][0-7][0-7]*" -type f 2>/dev/null | wc -l)
[ "$n" = "0" ] && P "9   catalog files extracted cleanly" \
               || F "9   $n catalog files have CORRUPT names (>100-char tar paths mis-extracted)"
if grep -qE '"com.palm.app.(contacts|messaging)"' /usr/palm/ipkgs/manifest.json 2>/dev/null; then
  F "9   manifest still advertises baked contacts/messaging"
else
  P "9   manifest: baked contacts/messaging dropped"
fi

# ---------------------------------------------------------------- 10. exhibition + l10n
Q=/usr/palm/sysmgr/uiComponents/DockModeTime
have $Q/SimpleClock.qml && grep -q SimpleClock $Q/Clocks.qml 2>/dev/null \
  && P "10  SimpleClock present and referenced" || F "10  SimpleClock missing/unreferenced"
have $Q/AnalogClock.qml && have $Q/DigitalClock.qml && P "10  stock clock faces retained" || F "10  stock clock faces missing"
ok=1
for pair in de_de:SPIELE fr_fr:JEUX it_it:GIOCHI es_es:JUEGOS fr_ca:JEUX es_us:JUEGOS en_gb:GAMES en_ca:GAMES; do
  loc=${pair%%:*}; want=${pair##*:}
  grep -q "\"GAMES\": \"$want\"" /usr/palm/sysmgr/localization/$loc/strings.json 2>/dev/null || { ok=0; F "10  GAMES l10n $loc != $want"; }
done
[ $ok = 1 ] && P "10  GAMES localized in all 8 locales"
grep -q "favorites" /etc/palm/launcher3/app-keywords-to-designator-map.txt 2>/dev/null \
  && grep -q "games" /etc/palm/launcher3/app-keywords-to-designator-map.txt 2>/dev/null \
  && P "10  launcher page rename favorites->games configured" || F "10  launcher page rename missing"
PA=$APPS/com.palm.app.photos
if [ -d $PA ]; then
  have $PA/images/icn-slidetiming.png && grep -q ec-shadow $PA/css/SlideshowMode.css 2>/dev/null \
    && grep -q onClockToggleClicked $PA/source/modes/SlideshowMode.js 2>/dev/null \
    && P "10  photos exhibition clock installed (icon+CSS+JS)" || F "10  photos exhibition clock incomplete"
else
  F "10  photos app not installed"
fi

# ---------------------------------------------------------------- 10b. default search engine
USL=/usr/palm/universalsearchmgr/resources
n=0; bad=0
for f in $USL/*/UniversalSearchList.json; do
  [ -f "$f" ] || continue
  n=$((n+1))
  grep -q '"defaultSearchEngine": "duckduckgo"' "$f" || { bad=$((bad+1)); F "10b $(basename $(dirname $f)) default is not duckduckgo"; }
  grep -q '"id": "google"' "$f" && { bad=$((bad+1)); F "10b $(basename $(dirname $f)) still lists google"; }
done
[ "$n" -gt 0 ] && [ "$bad" = "0" ] && P "10b default search engine is DuckDuckGo in all $n locale list(s)" \
  || [ "$n" -gt 0 ] || F "10b no UniversalSearchList.json found at all"
have $USL/en_us/UniversalSearchList.json && grep -q "lite.duckduckgo.com/lite" $USL/en_us/UniversalSearchList.json \
  && P "10b search URL points at the /lite/ endpoint" || F "10b search URL is not DuckDuckGo Lite"
have /usr/lib/luna/system/luna-applauncher/images/search-icon-duckduckgo.png \
  && P "10b universal-search DDG icon present" || F "10b universal-search DDG icon missing"
B=/usr/palm/applications/com.palm.app.browser
have $B/images/list-icon-duckduckgo.png && P "10b browser DDG icon present" || F "10b browser DDG icon missing"
grep -q "lite.duckduckgo.com/lite" $B/source/URLSearch.js 2>/dev/null \
  && P "10b browser fallback search is DuckDuckGo" || F "10b browser fallback still not DuckDuckGo"
grep -qi "google" $B/source/URLSearch.js 2>/dev/null \
  && F "10b browser URLSearch.js still mentions google" || P "10b no google left in browser URLSearch.js"

# ---------------------------------------------------------------- 11. space / media
STAGE=/usr/lib/luna/customization/copy_binaries/media/internal
if have /var/luna/preferences/ce-customization-media-reclaimed; then
  [ ! -d "$STAGE" ] && P "11  staged customization media reclaimed" || F "11  flagged but staging still present"
else
  F "11  staged media NOT reclaimed"
fi
have /var/log/ce-reclaim-customization-media.log && I "11  reclaim: $(tail -1 /var/log/ce-reclaim-customization-media.log)"
I  "11  rootfs: $(df -k / | awk 'END{print $(NF-2)"K free, "$(NF-1)" used"}')"
I  "11  media: wallpapers=$(ls /media/internal/wallpapers 2>/dev/null | wc -l) ringtones=$(ls /media/internal/ringtones 2>/dev/null | wc -l)"
n=$(ls /media/internal/wallpapers/*.png 2>/dev/null | wc -l)
[ "$n" = "0" ] && P "11  no orphaned .png wallpapers" || I "11  $n orphaned .png wallpapers (upgrade-from-CE artifact, accepted)"
have /media/internal/wallpapers/22.jpg && P "11  default wallpaper 22.jpg present" || F "11  default wallpaper 22.jpg MISSING"

# ---------------------------------------------------------------- ota. CE OTA trust anchor
# The only OTA component in the image (600070). No private key on the device, so
# this cannot test a POSITIVE verification -- it tests that the anchor is the
# intended key, and that the verifier fails closed, which is the half that must
# never regress. A signed-payload test needs the offline key and stays [Human].
OTAK=/usr/share/ce-ota/keys/ce-ota-signing.pub
OTAV=/usr/bin/ce-ota-verify
OTA_FPR=3f02d369e69d86e3616f85f04b42db6dc7383817fc480789877216f2e3f9fa79
if have $OTAK && have $OTAV; then
  P "ota OTA anchor: key + verifier present"
  [ -x $OTAV ] && P "ota ce-ota-verify is executable" || F "ota ce-ota-verify not executable"
  # Fingerprint over the DER SubjectPublicKeyInfo -- stable across PEM re-encoding.
  got=$(openssl rsa -pubin -in $OTAK -outform DER 2>/dev/null \
         | openssl dgst -sha256 2>/dev/null | sed 's/.*=[ ]*//')
  if [ -z "$got" ]; then
    F "ota OTA key did not parse under stock openssl ($(openssl version 2>&1))"
  elif [ "$got" = "$OTA_FPR" ]; then
    P "ota OTA key fingerprint matches the baked anchor"
  else
    F "ota OTA key fingerprint MISMATCH: $got"
  fi
  # Fail-closed: a garbage signature must be refused, and so must a missing file.
  echo test-payload > /tmp/ce-ota-t.bin; echo not-a-signature > /tmp/ce-ota-t.sig
  $OTAV /tmp/ce-ota-t.bin /tmp/ce-ota-t.sig >/dev/null 2>&1 \
    && F "ota ce-ota-verify ACCEPTED a garbage signature" \
    || P "ota ce-ota-verify refuses a garbage signature"
  $OTAV /tmp/ce-ota-t.bin /tmp/nope.sig >/dev/null 2>&1 \
    && F "ota ce-ota-verify ACCEPTED a missing signature file" \
    || P "ota ce-ota-verify refuses a missing signature file"
  rm -f /tmp/ce-ota-t.bin /tmp/ce-ota-t.sig
  # The verifier targets stock openssl on purpose; if the image ever replaces it
  # the anchor's assumptions change, so record what is actually there.
  I  "ota openssl on device: $(openssl version 2>&1)"
else
  F "ota OTA anchor missing (key=$(have $OTAK && echo yes || echo NO) verifier=$(have $OTAV && echo yes || echo NO))"
fi
# Nothing else OTA may be baked -- the client ships via Preware, authenticated by
# this key. A daemon or Updates patch appearing here means the boundary slipped.
for p in /usr/bin/ce-ota-daemon /usr/palm/services/org.webosarchive.ota.service /var/palm/event.d/ce-ota; do
  [ ! -e "$p" ] || F "ota unexpected OTA client component baked: $p"
done

echo "===== done ====="
