#!/bin/sh
# ce-preload-versions -- webOS CE: the package list says what is really installed.
#
# Calendar and Photos are staged in the image under their stock version numbers
# (com.palm.app.photos_3.0.8001_all.ipk holds Photos 3.2.0), so that the stock
# preload pass, which goes by the file name, does not reinstall them at every
# boot. ipkg then records 3.0.8001, Preware compares that with its feed's 3.2.0
# and offers an "update" to the app the device already has.
#
# So: for every staged preload that is installed and recorded under exactly the
# staged file's version, while the installed app's own appinfo.json declares a
# higher one, record the app's own version. Never downwards, and never for a
# package recorded under any other version (a feed install is left alone).
# The preload pass still does not reinstall: it only installs a staged version
# that is not lower than the recorded one.
#
#   ce-preload-versions.sh          one pass
#   ce-preload-versions.sh wait     keep passing until every staged preload is
#                                   installed (first boot after first use)
#   ce-preload-versions.sh finish   one pass, from ce-ota-finish
#
# Run by /etc/event.d/ce-preload-versions, and by ce-ota-finish after it has
# reinstalled apps. Idempotent; no flag.

APPS=/media/cryptofs/apps
STATUS=$APPS/usr/lib/ipkg/status
LOG=/var/log/ce-preload-versions.log
T=/tmp/ce-preload-versions.$$
log() { echo "$(date 2>/dev/null) $*" >> "$LOG" 2>/dev/null; }

ver_lt() {      # dotted numbers; true when $1 is lower than $2
    awk -v a="$1" -v b="$2" 'BEGIN {
        if (a !~ /^[0-9]+(\.[0-9]+)*$/ || b !~ /^[0-9]+(\.[0-9]+)*$/) exit 1
        n = split(a, x, "."); m = split(b, y, ".")
        for (i = 1; i <= (n > m ? n : m); i++) {
            if (x[i] + 0 < y[i] + 0) exit 0
            if (x[i] + 0 > y[i] + 0) exit 1
        }
        exit 1 }'
}
recorded() {
    awk -v p="$1" '$1 == "Package:" { on = ($2 == p) } on && $1 == "Version:" { print $2; exit }' "$STATUS" 2>/dev/null
}
# ipkg rewrites the whole status file: never write it while an install runs.
busy() {
    pidof ipkg ipkg-cl > /dev/null 2>&1 && return 0
    ps 2>/dev/null | grep -q '[a]pp-install\|[A]pplicationInstallerUtility' && return 0
    return 1
}

PENDING=0
one_pass() {
    PENDING=0
    [ -f "$STATUS" ] || { PENDING=1; return 0; }
    for _ipk in $(find /usr/palm/ipkgs -type f -name '*.ipk' 2>/dev/null); do
        _base=${_ipk##*/}
        _pkg=${_base%%_*}
        _rest=${_base#*_}
        _sver=${_rest%%_*}
        _have=$(recorded "$_pkg")
        [ -n "$_have" ] || { PENDING=$((PENDING+1)); continue; }
        [ "$_have" = "$_sver" ] || continue
        _own=$(sed -n 's/.*"version"[^"]*"\([^"]*\)".*/\1/p' \
               "$APPS/usr/palm/applications/$_pkg/appinfo.json" 2>/dev/null | head -1)
        [ -n "$_own" ] && ver_lt "$_have" "$_own" || continue
        busy && { PENDING=$((PENDING+1)); continue; }
        _n=$(grep -c '^Package:' "$STATUS")
        awk -v p="$_pkg" -v v="$_own" '$1 == "Package:" { on = ($2 == p) }
            on && $1 == "Version:" { print "Version: " v; on = 0; next } { print }' "$STATUS" > "$T" 2>/dev/null
        if [ "$(grep -c '^Package:' "$T" 2>/dev/null)" = "$_n" ] && ! busy \
           && [ "$(grep -c '^Package:' "$STATUS")" = "$_n" ]; then
            cat "$T" > "$STATUS.ce-new" && mv -f "$STATUS.ce-new" "$STATUS"
            log "$_pkg: recorded as $_own (was the staged file's $_have)"
        else
            PENDING=$((PENDING+1))
        fi
        rm -f "$T" "$STATUS.ce-new"
    done
}

# While an update is being finished, ce-ota-finish reinstalls apps and calls
# this itself ("finish"). A pass of our own in the middle of that records the
# higher version first, and ipkg then refuses the staged file as a downgrade
# (seen on a TouchPad: Clock was not replaced).
if [ "$1" != finish ] && [ -f /usr/share/ce-ota/ce-ota-finish.sh ] \
   && [ -f /var/luna/preferences/ran-first-use ] \
   && [ "$(cat /var/luna/preferences/ce-ota-finish 2>/dev/null)" != \
        "$(sed -n 's/^BUILDMARK=//p' /etc/palm-build-info 2>/dev/null)" ]; then
    exit 0
fi

if [ "$1" = wait ]; then
    _i=0
    while [ $_i -lt 30 ]; do
        one_pass
        [ $PENDING -eq 0 ] && break
        sleep 20
        _i=$((_i+1))
    done
    [ $PENDING -eq 0 ] || log "$PENDING staged preload(s) still not installed or busy after 10 minutes"
else
    one_pass
fi
exit 0
