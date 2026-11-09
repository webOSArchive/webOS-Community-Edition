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
echo "$BI" | grep -q "PRODUCT_VERSION_STRING=webOS CE 3.2.0" && P "id  version string webOS CE 3.2.0" || F "id  version string"
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
# Emoji fallback font (Docs/EMOJI-FONT.md §4): libWebKitLuna's fifth fallback slot loads
# CE-Emoji.ttf. Both md5s are the pair tested on a TouchPad 2026-11-04; rendering itself is
# a TEST-PLAN eyes-on check. WebAppMgr maps the font once any web app has drawn text.
m=$(md5sum /usr/share/fonts/CE-Emoji.ttf 2>/dev/null | cut -d' ' -f1)
[ "$m" = "1d357754da12e42f1a66080337e33e53" ] && P "7   emoji fallback font CE-Emoji.ttf" || F "7   CE-Emoji.ttf missing or wrong (md5 ${m:-none})"
m=$(md5sum /usr/lib/libWebKitLuna.so 2>/dev/null | cut -d' ' -f1)
[ "$m" = "9c3a2e3eba662899691ea5c54c835a62" ] && P "7   libWebKitLuna emoji patch (fallback slot + astral glyphs)" || F "7   libWebKitLuna not the emoji build (md5 $m)"
wm=$(pidof LunaSysMgr | awk '{print $1}')
grep -q CE-Emoji /proc/$wm/maps 2>/dev/null && P "7   WebAppMgr has CE-Emoji.ttf loaded" || I "7   WebAppMgr hasn't loaded CE-Emoji.ttf (no web text drawn yet?)"
# Emoji keyboard (LunaCE): its keys draw these OpenMoji images; a missing one falls back to text.
n=$(ls /usr/palm/frameworks/ce-emoji/images/72/*.png 2>/dev/null | wc -l)
[ "$n" = "152" ] && [ -f /usr/palm/frameworks/ce-emoji/ATTRIBUTION.txt ] && P "7   emoji keyboard images: 152 + attribution" || F "7   emoji keyboard images: $n of 152 (or no ATTRIBUTION.txt)"
n=$(strings /usr/bin/LunaSysMgr 2>/dev/null | grep -c "QtEmojiFallback")
[ "$n" -gt 0 ] && P "7   LunaSysMgr has the emoji keyboard + Qt emoji fallback" || F "7   LunaSysMgr predates the emoji work"
# SmartKey (CE auto-correct, packages/smartkey): the service, its English dictionary, and an
# answer to the same query WebKit sends while typing.
m=$(md5sum /usr/bin/SmartKeyService 2>/dev/null | cut -d' ' -f1)
[ "$m" = "97475abdcc315d0f95d142d4831eabf6" ] && P "7   SmartKeyService is CE's auto-correct" || F "7   SmartKeyService not CE's (md5 ${m:-none})"
[ -f /usr/palm/smartkey/skd/en.skd ] && P "7   SmartKey English dictionary present" || F "7   /usr/palm/smartkey/skd/en.skd missing"
r=$( (luna-send -n 1 palm://com.palm.smartKey/search '{"query":"teh"}' </dev/null & p=$!; ( sleep 15; kill $p 2>/dev/null ) & wait $p) 2>/dev/null)
echo "$r" | grep -q '"str": "the", "sp": true, "auto-accept": true' && P "7   SmartKey corrects teh -> the" || F "7   SmartKey search teh: ${r:-no answer}"

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

# ---------------------------------------------------------------- 12. video player (3.2.0)
# The CE Video Player (com.palm.app.videos) and the stock id that hosts the same
# player, the Photos grid hand-off, the Tweaks toggle, the runtime handler, and
# then the player's own self-test on a local clip. The Media TLS plugin set is
# checked in section 9. Docs/VIDEO-3.2.0-NOTES.md has the background.
V=/usr/palm/applications/com.palm.app.videos
VP=/usr/palm/applications/com.palm.app.videoplayer
grep -q '"version": "3.2.0"' $V/appinfo.json 2>/dev/null \
  && P "12  Video Player 3.2.0 baked" || F "12  Video Player 3.2.0 not baked"
[ ! -d $APPS/com.palm.app.videos ] && P "12  Video Player unshadowed" \
  || F "12  Video Player SHADOWED by a cryptofs copy (feed install left behind?)"
[ ! -d $V/ce-install ] && P "12  feed ce-install/ payload dropped" || F "12  ce-install/ payload baked into the app"
# the stock id must BE the player (an id-launch pre-creates its card; a shim flashes a blank one)
ok=1
for f in index.html depends.js source/VideoEngine.js source/PlayerApp.js source/SelfTest.js css/player.css; do
  if [ ! -f $V/$f ] || [ ! -f $VP/$f ]; then ok=0; F "12  player file $f missing (videos=$(have $V/$f && echo yes || echo NO) videoplayer=$(have $VP/$f && echo yes || echo NO))"
  elif [ "$(md5sum < $V/$f)" != "$(md5sum < $VP/$f)" ]; then ok=0; F "12  videoplayer $f differs from the Video Player's"; fi
done
[ $ok = 1 ] && P "12  com.palm.app.videoplayer hosts the same player"
grep -q '"id": *"com.palm.app.videoplayer"' $VP/appinfo.json 2>/dev/null \
  && P "12  videoplayer keeps its stock id" || F "12  videoplayer appinfo id wrong"
n=$(find $V $VP /usr/lib/gstreamer-0.10 -name '*.webosce-orig' 2>/dev/null | wc -l)
[ "$n" = "0" ] && P "12  no feed-install backups (*.webosce-orig) in the image" || F "12  $n *.webosce-orig file(s) present"
# Photos is a cryptofs preload: the hand-off is in the installed copy
grep -q '"com.palm.app.videos"' $APPS/com.palm.app.photos/source/AlbumGridView.js 2>/dev/null \
  && P "12  Photos grid hands videos to the Video Player" || F "12  Photos grid hand-off missing"
have /media/cryptofs/apps/usr/palm/services/org.webosinternals.tweaks.prefs/preferences/com.palm.app.videos.json \
  && P "12  Tweaks toggle (Pause video when minimized) seeded" || F "12  Tweaks definition not seeded"
# runtime handler: ask LunaSysMgr what an .mp4 resolves to (guarded like the .ipk test)
have /var/luna/preferences/ce-video-handler-registered \
  && P "12  ce-register-video-handler ran and verified" \
  || F "12  ce-register-video-handler has not flagged ($(tail -1 /var/log/ce-register-video-handler.log 2>/dev/null))"
( luna-send -n 1 palm://com.palm.applicationManager/getResourceInfo \
    '{"uri":"file:///media/internal/downloads/.ce-test.mp4"}' </dev/null > /tmp/.vidres 2>&1 ) &
_p=$!; _i=0
while [ $_i -lt 10 ] && kill -0 $_p 2>/dev/null; do sleep 1; _i=$((_i+1)); done
kill -9 $_p 2>/dev/null
res=$(cat /tmp/.vidres 2>/dev/null); rm -f /tmp/.vidres
case "$res" in
  *com.palm.app.videos*'"canStream": true'*|*'"canStream": true'*com.palm.app.videos*)
    P "12  .mp4 resolves to the Video Player, streamable" ;;
  *) F "12  .mp4 handler wrong: $(printf '%s' "$res" | cut -c1-140)" ;;
esac

# Self-test: the player drives its own engine (scrub storm + restart at end) and
# logs "[vids] SELFTEST ..." lines. Needs a clip on the media partition, which
# survives a flash; the canonical one is build/work/test-media/bars-30s-h264.mp4
# (Docs/VIDEO-3.2.0-NOTES.md §7). Set CE_VIDEO_CLIP to use another.
# Opens a card and closes it again afterwards.
CLIP=${CE_VIDEO_CLIP:-/media/internal/Videos/bars-30s-h264.mp4}
if [ ! -f "$CLIP" ]; then
  I "12  self-test skipped: no clip at $CLIP (push build/work/test-media/bars-30s-h264.mp4 to run it)"
else
  ms0=$(pidof mediaserver); rd0=$(ls /var/log/rdxd/pending 2>/dev/null | wc -l)
  l0=$(wc -l < $LOG)
  ( luna-send -n 1 palm://com.palm.applicationManager/launch \
      "{\"id\":\"com.palm.app.videos\",\"params\":{\"target\":\"$CLIP\",\"selftest\":\"all\",\"rounds\":2}}" \
      </dev/null >/dev/null 2>&1 ) &
  _p=$!; sleep 10; kill -9 $_p 2>/dev/null
  sum=""; _i=0
  while [ $_i -lt 48 ]; do                       # up to 4 minutes; a pass takes ~1-2
    l1=$(wc -l < $LOG); [ "$l1" -lt "$l0" ] && l0=0  # syslog rotated under us
    sum=$(tail -n +$((l0+1)) $LOG | grep 'SELFTEST \(PASS\|FAIL\) pass=' | tail -1 | sed 's/, file:.*$//')
    [ -n "$sum" ] && break
    sleep 5; _i=$((_i+1))
  done
  case "$sum" in
    *"SELFTEST PASS"*) P "12  player self-test: ${sum##*SELFTEST }" ;;
    *"SELFTEST FAIL"*) F "12  player self-test: ${sum##*SELFTEST }"
       tail -n +$((l0+1)) $LOG | grep 'SELFTEST FAIL' | sed 's/.*SELFTEST /[INFO] 12    /' | cut -c1-200 ;;
    *) F "12  player self-test: no summary within 4 min ($(tail -n +$((l0+1)) $LOG | grep '\[vids\]' | tail -1 | sed 's/.*\[vids\] //' | cut -c1-120))" ;;
  esac
  ms1=$(pidof mediaserver); rd1=$(ls /var/log/rdxd/pending 2>/dev/null | wc -l)
  [ -n "$ms0" ] && [ "$ms0" = "$ms1" ] && P "12  mediaserver survived (pid $ms0)" || F "12  mediaserver pid changed: $ms0 -> $ms1"
  [ "$rd0" = "$rd1" ] && P "12  no rdxd report during the self-test" || F "12  $((rd1-rd0)) new rdxd report(s) during the self-test"
  # close the card (test-launched cards must not be left open)
  luna-send -n 1 palm://com.palm.applicationManager/running '{}' </dev/null 2>/dev/null \
    | tr ',' '\n' | grep -A1 'com.palm.app.videos' | grep -o '"[0-9]*"' | tr -d '"' \
    | while read pid; do
        luna-send -n 1 palm://com.palm.applicationManager/close "{\"processId\":\"$pid\"}" </dev/null >/dev/null 2>&1
      done
fi

# ---------------------------------------------------------------- 13. 3.2.0 apps + system UI
# Labels use Docs/TEST-PLAN.md's section numbers (19-25), not this script's.
# Every marker below was read from the 600102 overlay; each is a file content or
# md5 the 3.2.0 change put there, so a stale or missing piece reads as FAIL.

# 19. Contacts 3.2.0 (rootfs app) + the photos service it imports photos through
C=/usr/palm/applications/com.palm.app.contacts
grep -q '"version"[^,]*"3.2.0"' $C/appinfo.json 2>/dev/null && P "19  Contacts 3.2.0 baked" || F "19  Contacts not 3.2.0"
have $C/app/utils/VCardParser.js && have $C/app/utils/VCardBatchImport.js \
  && P "19  Import vCards present" || F "19  VCardParser/VCardBatchImport missing"
have $C/appinfo.json && [ ! -e $C/tests ] && [ ! -e $C/jasminerunner.html ] && [ ! -e $C/jrgenerator.sh ] \
  && P "19  Contacts ships no test code" || F "19  Contacts test files still in the image"
PS=/media/cryptofs/apps/usr/palm/services/org.webosarchive.photos.service
grep -q '"name": "remove"' $PS/services.json 2>/dev/null && grep -q contactphotos $PS/service.js 2>/dev/null \
  && P "19  photos service takes Contacts photos (remove + .contactphotos)" \
  || F "19  photos service predates Import vCards (contact photos will be dropped)"

# 20. Calendar 3.2.0 (cryptofs preload), calendar framework, tzdata 2026f
have $APPS/com.palm.app.calendar/app/import/ICalImport.js \
  && P "20  Calendar has Import Calendar (3.2.0 tree installed)" || F "20  installed Calendar has no Import Calendar"
I  "20  calendar $(grep -o '"version"[^,]*' $APPS/com.palm.app.calendar/appinfo.json 2>/dev/null | head -1)"
CF=/usr/palm/frameworks/calendar/submission
ok=1
for f in 42/javascript/timezone-manager.js 42/concatenated.js 42calendar.js; do
  grep -q "Pacific Standard Time" $CF/$f 2>/dev/null || { ok=0; F "20  calendar framework $f lacks Windows zone names"; }
done
[ $ok = 1 ] && P "20  calendar framework knows Windows zone names"
m=$(md5sum /usr/share/zoneinfo/America/Vancouver 2>/dev/null | cut -c1-32)
[ "$m" = "d61f0346eaf154f3fdbd3f1aca473f26" ] && P "20  zoneinfo is tzdata 2026f (America/Vancouver)" || F "20  zoneinfo not 2026f (Vancouver md5 ${m:-none})"
m=$(md5sum /etc/palm/timezone.txt 2>/dev/null | cut -c1-32)
[ "$m" = "c80b9b4a4b6ef82a793557f993e02c0d" ] && P "20  /etc/palm/timezone.txt is CE's" || F "20  timezone.txt not CE's (md5 ${m:-none})"
m=$(md5sum /usr/palm/ext-timezones.json 2>/dev/null | cut -c1-32)
[ "$m" = "669f76f30ef24488b966d01e9499e95d" ] && P "20  ext-timezones.json is CE's" || F "20  ext-timezones.json not CE's (md5 ${m:-none})"

# 3/23. OOBE tutorial marker, USB banner, launcher layout
# LunaSysMgr also writes this marker once the tutorial has shown, so its
# presence says the tutorial is suppressed OR already shown; the plan's hand
# check (no tutorial on the first card) is what decides it.
have /var/luna/preferences/used-first-card && P "23  used-first-card marker present (no Dismissing Cards tutorial)" \
  || F "23  used-first-card missing: the tutorial will show"
grep -q "USB Connected" /usr/lib/luna/system/luna-systemui/data/StoragedService.js 2>/dev/null \
  && P "23  USB banner (StoragedService.js is CE's)" || F "23  StoragedService.js is stock: USB popup instead of banner"
grep -q '^IgnoreLegacyCustomizationFiles=true' /etc/palm/launcher3/launcher_operational_settings.conf 2>/dev/null \
  && P "23  launcher ignores the payload layout (IgnoreLegacyCustomizationFiles)" || F "23  IgnoreLegacyCustomizationFiles not set"
L=$(cat /etc/palm/default-launcher-page-layout.json 2>/dev/null | tr -d " \t\r\n" | tr "," "\n")
lm=$(echo "$L" | grep -n 'com.palm.app.musicplayer_default' | cut -d: -f1)
lv=$(echo "$L" | grep -n 'com.palm.app.videos_default' | cut -d: -f1)
[ -n "$lm" ] && [ "$lv" = "$((lm+1))" ] && P "23  launcher layout: Video Player right after Music" \
  || F "23  launcher layout: Video Player not after Music (music=$lm videos=$lv)"

# 24. HP branding: App Catalog art (md5 = system/ copies) and account templates
ok=1
for e in \
  2d832cf818ef111d0e92a2c6cbca7000:/usr/lib/luna/system/luna-systemui/images/notification-large-appcatalog.png \
  b3cfd794c4801f6abd61a6e803918e01:/usr/lib/luna/system/luna-systemui/images/notification-small-appcatalog.png \
  1b06a6e1ab4d137db61e82a44ce19b08:/usr/palm/applications/com.palm.app.exhibitionpreferences/images/appcatalog.png \
  1b06a6e1ab4d137db61e82a44ce19b08:/usr/palm/applications/com.palm.app.searchpreferences/images/appcatalog.png \
  69d107747bff09d98142c4f9fc8a4424:/usr/palm/applications/com.palm.app.swmanager/images/appcatalog_icon.png \
  2d832cf818ef111d0e92a2c6cbca7000:/usr/palm/frameworks/accounts.ui/submission/41/images/1.5/appcatalog-32x32.png \
  1b06a6e1ab4d137db61e82a44ce19b08:/usr/palm/frameworks/accounts.ui/submission/41/images/appcatalog-32x32.png \
  1b06a6e1ab4d137db61e82a44ce19b08:/usr/palm/frameworks/enyo/0.10/framework/lib/accounts/images/appcatalog-32x32.png \
  2d832cf818ef111d0e92a2c6cbca7000:/usr/palm/frameworks/enyo/0.10/framework/lib/accounts/images/appcatalog-48x48.png \
  69d107747bff09d98142c4f9fc8a4424:/usr/palm/ipkgs/payment/icon.png \
  69d107747bff09d98142c4f9fc8a4424:/usr/palm/services/com.palm.service.appcatalog/icon.png; do
  want=${e%%:*}; f=${e#*:}
  m=$(md5sum $f 2>/dev/null | cut -c1-32)
  [ "$m" = "$want" ] || { ok=0; F "24  App Catalog icon not CE's: $f (md5 ${m:-none})"; }
done
[ $ok = 1 ] && P "24  all 11 App Catalog icons are the webOS App Catalog art"
t=$(find /usr/palm/public/accounts -name '*.json' 2>/dev/null | wc -l)
n=$(grep -rl "HP webOS" /usr/palm/public/accounts 2>/dev/null | wc -l)
if [ "$t" -lt 10 ]; then F "24  only $t account template file(s) found: layout changed?"
elif [ "$n" = "0" ]; then P "24  account templates: 0 of $t say \"HP webOS\""
else F "24  $n of $t account template file(s) still say \"HP webOS\""; fi

# 25. Messaging unread-count fix, chatthreader 1.1.0.3
grep -q gotAddressThreads /usr/palm/applications/com.palm.app.messaging/app/buddies/BuddyService.js 2>/dev/null \
  && P "25  Messaging buddy unread-count fix present" || F "25  Messaging BuddyService.js lacks the unread-count fix"
grep -q "Always set a result" /usr/palm/services/com.palm.messaging.chatthreader/assistants/newmessageassistant.js 2>/dev/null \
  && P "25  chatthreader 1.1.0.3 (non-buddy first message threads)" || F "25  chatthreader predates 1.1.0.3"

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
