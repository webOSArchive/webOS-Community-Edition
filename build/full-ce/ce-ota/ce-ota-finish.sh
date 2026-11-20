#!/bin/sh
# ce-ota-finish -- webOS CE: what an OTA cannot do from the update ramdisk.
#
# An OTA payload is a diff of the root filesystem, applied with no Luna, no
# bus and no cryptofs. This job does the rest on the first boot of the new
# image, and on later boots until every step has verified:
#
#   seed    files this image seeds into /media/cryptofs (a flash copies them
#           once, after first use)
#   apps    the apps the image carries as staged ipks (Calendar, Email, ...).
#           A flash installs them on first boot; an installed device keeps its
#           old copy when the ipk changed under the same version
#   feeds   leftovers of the feed versions of what this image now bakes
#   gst     the GStreamer registry, which caches the plugin the image replaced
#   media   the default wallpaper, staged for a copy that runs once per flash
#   logo    bootie's still logo in NVRAM, which only the Doctor writes
#
# Nothing here knows a version. What changed is worked out on the device from
# this image and the lists in /usr/share/ce-ota/finish/from-*.list, which hold
# the md5 of every staged ipk and every seed file of the images a device can
# have come from (build/ota/make-payload.py finish-list).
#
# House rules (see the other ce-* jobs): verify, then flag; a step that could
# not verify leaves the flag unset and the job tries again next boot; never
# fail loudly; / is read-only and is opened under the shared lock.
#
# Run by /etc/event.d/ce-ota-finish. Docs/OTA-PLAN.md section 2.2.

PREFS=/var/luna/preferences
FLAG=$PREFS/ce-ota-finish            # holds the BUILDMARK the steps finished for
LOGO_FLAG=$PREFS/ce-ota-finish-logo  # the same, for the NVRAM logo alone
APPLIED=$PREFS/ce-ota-finish-apps    # md5 of each staged ipk already reinstalled
LOG=/var/log/ce-ota-finish.log
LISTS=/usr/share/ce-ota/finish
APPS=/media/cryptofs/apps
T=/tmp/ce-ota-finish.$$

log() { echo "$(date 2>/dev/null) $*" >> "$LOG" 2>/dev/null; }
md5of() { md5sum "$1" 2>/dev/null | cut -c1-32; }

MARK=$(sed -n 's/^BUILDMARK=//p' /etc/palm-build-info 2>/dev/null)
[ -n "$MARK" ] || exit 0
[ "$(cat $FLAG 2>/dev/null)" = "$MARK" ] && [ "$(cat $LOGO_FLAG 2>/dev/null)" = "$MARK" ] && exit 0

# A device that has not finished first use on this image was flashed, not
# updated: the flash laid everything down and first use is about to wipe
# cryptofs anyway. Nothing to finish, now or later.
if [ ! -f $PREFS/ran-first-use ]; then
    mkdir -p $PREFS
    echo "$MARK" > $FLAG
    echo "$MARK" > $LOGO_FLAG
    log "$MARK: first use not finished, so this is a flash -- nothing to do"
    exit 0
fi

mkdir -p "$T" || exit 0
trap 'rm -rf "$T"' EXIT

# / is read-only; ce-firstboot-tweaks, ce-remove-preloads and
# ce-reclaim-customization-media open it too. mkdir is atomic: a spinlock.
rootfs_rw() {
    _n=0
    while ! mkdir /tmp/.ce-rootfs-rw.lock 2>/dev/null && [ $_n -lt 60 ]; do sleep 1; _n=$((_n+1)); done
    mount -o remount,rw / 2>/dev/null
}
rootfs_ro() {
    sync
    mount -o remount,ro / 2>/dev/null
    rmdir /tmp/.ce-rootfs-rw.lock 2>/dev/null
}

# luna-send can wait for ever on a bus that is not answering.
lsq() {
    luna-send -n 1 "$@" < /dev/null > "$T/ls.out" 2>&1 &
    _p=$!
    _i=0
    while [ $_i -lt 20 ] && kill -0 $_p 2>/dev/null; do sleep 1; _i=$((_i+1)); done
    kill $_p 2>/dev/null
    cat "$T/ls.out" 2>/dev/null
}

# ---------------------------------------------------------------- logo ----
# Its own flag: a low battery must not hold the other steps back, nor make
# them run twice.
logo_in_nvram() {     # is this BootLogo.tga stored, whole, in the NVRAM partition?
    # A copy first: node cannot size a block device.
    dd if=/dev/mmcblk0p12 of="$T/nv.img" bs=1M 2>/dev/null || return 1
    CE_IMG="$1" CE_NV="$T/nv.img" node -e '
var fs = require("fs");
var img = fs.readFileSync(process.env.CE_IMG), nv = fs.readFileSync(process.env.CE_NV);
var n = img.length, last = nv.length - n, found = false;
if (n < 1024 || nv.length < 1048576) process.exit(2);
for (var i = 0; i <= last && !found; i++) {
    if (nv[i] !== img[0] || nv[i + n - 1] !== img[n - 1]) continue;
    var j = 1;
    while (j < n && nv[i + j] === img[j]) j++;
    found = (j === n);
}
process.exit(found ? 0 : 1);' 2>/dev/null
    _r=$?
    rm -f "$T/nv.img"
    return $_r
}

battery_percent() {
    for _f in /sys/class/power_supply/*/capacity /sys/devices/w1*/*/getpercent \
              /sys/devices/w1_bus_master1/*/getpercent; do
        [ -r "$_f" ] || continue
        _v=$(cat "$_f" 2>/dev/null | tr -cd '0-9')
        [ -n "$_v" ] && { echo "$_v"; return; }
    done
}

step_logo() {
    [ "$(cat $LOGO_FLAG 2>/dev/null)" = "$MARK" ] && return 0
    [ -f /boot/boot-images.tar.gz ] && [ -f /boot/image-update.xml ] && [ -x /sbin/trenchcoat ] \
        || { log "logo: no boot images or no trenchcoat in this image -- skipped"; return 1; }
    mkdir -p "$T/boot-images" && tar xzf /boot/boot-images.tar.gz -C "$T/boot-images" 2>/dev/null
    _tga=$(find "$T/boot-images" -name BootLogo.tga | head -1)
    [ -n "$_tga" ] || { log "logo: no BootLogo.tga in boot-images.tar.gz"; return 1; }
    if logo_in_nvram "$_tga"; then
        echo "$MARK" > $LOGO_FLAG
        log "logo: NVRAM already holds this image's boot logo"
        return 0
    fi
    _pct=$(battery_percent)
    if [ -z "$_pct" ] || [ "$_pct" -lt 30 ]; then
        log "logo: battery at '${_pct:-unknown}' -- NVRAM not written, will try next boot"
        return 1
    fi
    # trenchcoat rewrites the whole partition, device tokens included.
    _bak=/var/ce-ota-nvram-backup.img
    dd if=/dev/mmcblk0p12 of=$_bak bs=1M 2>/dev/null && sync
    cmp -s /dev/mmcblk0p12 $_bak || { log "logo: could not save NVRAM -- not written"; rm -f $_bak; return 1; }
    /sbin/tokens --list > "$T/tokens.before" 2>&1
    ( cd "$(dirname "$_tga")" && /sbin/trenchcoat --config=/boot/image-update.xml ) >> "$LOG" 2>&1
    _rc=$?
    sync
    /sbin/tokens --list > "$T/tokens.after" 2>&1
    if [ $_rc -eq 0 ] && [ -s "$T/tokens.before" ] && cmp -s "$T/tokens.before" "$T/tokens.after" \
       && logo_in_nvram "$_tga"; then
        echo "$MARK" > $LOGO_FLAG
        rm -f $_bak
        log "logo: boot logo written to NVRAM, tokens unchanged (battery ${_pct}%)"
        return 0
    fi
    log "logo: NOT VERIFIED (trenchcoat exit $_rc). NVRAM as it was is kept in $_bak;"
    log "logo: restore with: dd if=$_bak of=/dev/mmcblk0p12 bs=1M"
    return 1
}

# ------------------------------------------------------------ cryptofs ----
cryptofs_writable() {
    _i=0
    while [ $_i -lt 60 ]; do
        grep -q " /media/cryptofs " /proc/mounts \
            && mkdir -p /media/cryptofs/.ce-ota-probe 2>/dev/null \
            && touch /media/cryptofs/.ce-ota-probe/w 2>/dev/null && break
        sleep 5
        _i=$((_i+1))
    done
    rm -rf /media/cryptofs/.ce-ota-probe 2>/dev/null
    [ $_i -lt 60 ]
}

# ---------------------------------------------------------------- seed ----
# For every file this image seeds: absent and new in this image -> copy;
# absent but seeded before -> the owner removed it, leave it; same -> nothing;
# equal to what an older image seeded -> replace; anything else -> the owner's
# own, leave it. Files an older image seeded and this one does not -> remove,
# if untouched.
step_seed() {
    _seed=/usr/palm/ce-seed/cryptofs
    [ -d $_seed ] || return 0
    awk '$1 == "S" { print $2 "  " $3 }' $LISTS/from-*.list 2>/dev/null | sort -u > "$T/seed.old"
    ( cd $_seed && find . -type f | sed 's#^\./##' | grep -v ' ' ) > "$T/seed.new"
    _bad=0; _put=0; _kept=0
    while read _p; do
        _src=$_seed/$_p; _dst=/media/cryptofs/$_p
        _want=$(md5of "$_src")
        if [ ! -e "$_dst" ]; then
            grep -q "  $_p\$" "$T/seed.old" && continue
        else
            _have=$(md5of "$_dst")
            [ "$_have" = "$_want" ] && continue
            if ! grep -q "^$_have  $_p\$" "$T/seed.old"; then
                _kept=$((_kept+1)); log "seed: kept the device's own $_p"
                continue
            fi
        fi
        mkdir -p "$(dirname "$_dst")" 2>/dev/null
        cp -p "$_src" "$_dst.ce-new" 2>/dev/null && mv -f "$_dst.ce-new" "$_dst" 2>/dev/null
        if [ "$(md5of "$_dst")" = "$_want" ]; then _put=$((_put+1)); else
            _bad=$((_bad+1)); rm -f "$_dst.ce-new"; log "seed: FAILED to place $_p"; fi
    done < "$T/seed.new"
    _gone=0
    while read _m _p; do
        grep -q "^$_p\$" "$T/seed.new" && continue
        [ "$(md5of "/media/cryptofs/$_p")" = "$_m" ] || continue
        rm -f "/media/cryptofs/$_p" && _gone=$((_gone+1))
    done < "$T/seed.old"
    log "seed: $_put placed, $_gone removed, $_kept kept as the device's own, $_bad failed"
    [ $_bad -eq 0 ]
}

# ---------------------------------------------------------------- apps ----
installed_version() {
    awk -v p="$1" '$1 == "Package:" { on = ($2 == p) } on && $1 == "Version:" { print $2; exit }' \
        $APPS/usr/lib/ipkg/status 2>/dev/null
}

app_matches_ipk() {   # is every file of the ipk installed with the same bytes?
    rm -rf "$T/x"; mkdir -p "$T/x"
    ar p "$1" data.tar.gz 2>/dev/null | tar xzf - -C "$T/x" 2>/dev/null || return 1
    ( cd "$T/x" && find . -type f -print0 | xargs -0 md5sum 2>/dev/null | sort -k 2 ) > "$T/x.want"
    ( cd "$T/x" && find . -type f -print0 ) | ( cd $APPS && xargs -0 md5sum 2>/dev/null | sort -k 2 ) > "$T/x.have"
    [ -s "$T/x.want" ] && cmp -s "$T/x.want" "$T/x.have"
    _r=$?
    rm -rf "$T/x"
    return $_r
}

# A staged ipk whose bytes changed under an unchanged file name: the stock
# preload pass compares versions and will never touch it. Reinstall it through
# that same pass, which is how a flashed device got it. A changed file name is
# a new version, and the preload pass's own business.
step_apps() {
    _bad=0
    touch $APPLIED 2>/dev/null
    for _ipk in $(find /usr/palm/ipkgs -type f -name '*.ipk' 2>/dev/null); do
        _rel=${_ipk#/usr/palm/ipkgs/}
        _old=$(awk -v p="$_rel" '$1 == "I" && $3 == p { print $2 }' $LISTS/from-*.list 2>/dev/null)
        [ -n "$_old" ] || continue
        _m=$(md5of "$_ipk")
        echo "$_old" | grep -q "^$_m\$" && continue
        grep -q "^$_m " $APPLIED 2>/dev/null && continue
        _ctl=$(ar p "$_ipk" control.tar.gz 2>/dev/null | tar xzOf - ./control 2>/dev/null)
        [ -n "$_ctl" ] || _ctl=$(ar p "$_ipk" control.tar.gz 2>/dev/null | tar xzOf - control 2>/dev/null)
        _pkg=$(echo "$_ctl" | sed -n 's/^Package: *//p' | head -1)
        _ver=$(echo "$_ctl" | sed -n 's/^Version: *//p' | head -1)
        _inst=$(installed_version "$_pkg")
        if [ -z "$_pkg" ] || [ -z "$_inst" ]; then
            log "apps: ${_pkg:-$_rel} is not installed -- left alone"
            continue
        fi
        if [ "$_inst" != "$_ver" ]; then
            log "apps: $_pkg is at $_inst, the image stages $_ver -- left alone"
            continue
        fi
        if app_matches_ipk "$_ipk"; then
            echo "$_m $_pkg" >> $APPLIED
            log "apps: $_pkg already matches the staged ipk"
            continue
        fi
        log "apps: reinstalling $_pkg $_ver from the staged ipk"
        /usr/bin/app-install -force-reinstall -install-only -package "$(basename "$_ipk")" >> "$LOG" 2>&1
        if app_matches_ipk "$_ipk"; then
            echo "$_m $_pkg" >> $APPLIED
            lsq -f palm://com.palm.applicationManager/forceSingleAppScan "{\"id\":\"$_pkg\"}" >> "$LOG" 2>&1
            touch "$T/apps-changed"
            log "apps: $_pkg reinstalled and verified"
        else
            _bad=$((_bad+1))
            log "apps: $_pkg NOT VERIFIED after the reinstall -- will try next boot"
        fi
    done
    [ $_bad -eq 0 ]
}

# --------------------------------------------------------------- feeds ----
# A 3.1.0 device may run the feed versions of what this image bakes (Videos,
# Calculator, Media TLS). Their postinsts changed / and kept the stock files
# beside the new ones; their prerms would put those stock files back over the
# baked ones. Make a later removal in Preware harmless, drop the backups and
# the shadowing cryptofs copies, and add the status entries a flash seeds.
baked_version() {     # the version preware-seed.sh records for a baked package
    awk -v p="$1" '/echo "Package: / { on = ($3 == p "\"") } on && /echo "Version: / { v = $3; sub(/"$/, "", v); print v; exit }' \
        /usr/palm/ce-seed/preware-seed.sh 2>/dev/null
}

appinfo_version() {
    sed -n 's/.*"version"[^"]*"\([^"]*\)".*/\1/p' "$1/appinfo.json" 2>/dev/null | head -1
}

step_feeds() {
    _info=$APPS/usr/lib/ipkg/info
    # Only a feed copy that is this image's version or older: a newer one the
    # owner installed later is theirs.
    for _pkg in com.palm.app.videos com.palm.app.calculator org.webosarchive.media-tls13; do
        ls $_info/$_pkg.* > /dev/null 2>&1 || continue
        _bv=$(baked_version $_pkg); _iv=$(installed_version $_pkg)
        [ -n "$_bv" ] && [ -n "$_iv" ] && ipkg compare_versions "$_iv" '<=' "$_bv" > /dev/null 2>&1 || continue
        rm -f $_info/$_pkg.prerm $_info/$_pkg.postinst $_info/$_pkg.postrm $_info/$_pkg.list
        log "feeds: $_pkg $_iv from the feed is now the baked one; its remove scripts are gone"
    done
    for _app in com.palm.app.videos com.palm.app.calculator; do
        [ -d /usr/palm/applications/$_app ] && [ -d $APPS/usr/palm/applications/$_app ] || continue
        _bv=$(appinfo_version /usr/palm/applications/$_app)
        _cv=$(appinfo_version $APPS/usr/palm/applications/$_app)
        [ -n "$_bv" ] && [ -n "$_cv" ] && ipkg compare_versions "$_cv" '<=' "$_bv" > /dev/null 2>&1 || continue
        rm -rf $APPS/usr/palm/applications/$_app $APPS/usr/palm/packages/$_app
        # Its status entry stays, as a flash seeds one, at the baked version;
        # its file list and scripts describe files that are gone.
        rm -f $_info/$_app.list $_info/$_app.prerm $_info/$_app.postinst $_info/$_app.postrm
        awk -v p="$_app" -v v="$_bv" '$1 == "Package:" { on = ($2 == p) }
            on && $1 == "Version:" { print "Version: " v; next } { print }' \
            $APPS/usr/lib/ipkg/status > $APPS/usr/lib/ipkg/status.ce-new 2>/dev/null \
            && [ -s $APPS/usr/lib/ipkg/status.ce-new ] \
            && mv -f $APPS/usr/lib/ipkg/status.ce-new $APPS/usr/lib/ipkg/status
        rm -f $APPS/usr/lib/ipkg/status.ce-new
        touch "$T/apps-changed"
        log "feeds: removed the cryptofs copy of $_app ($_cv) that the baked $_bv shadows"
    done
    rm -f $APPS/usr/palm/applications/com.palm.app.photos/source/*.webosce-orig 2>/dev/null
    _left=$(ls /usr/lib/gstreamer-0.10/*.webosce-orig \
               /usr/palm/applications/com.palm.app.videoplayer/*.webosce-orig \
               /usr/palm/applications/com.palm.app.videoplayer/*/*.webosce-orig \
               /usr/palm/applications/com.palm.app.videoplayer/*/*/*.webosce-orig 2>/dev/null)
    if [ -n "$_left" ]; then
        rootfs_rw
        rm -f $_left
        rootfs_ro
        log "feeds: removed the feed postinsts' backups of stock files from /"
    fi
    # The entries a flash seeds, and only those: the part of preware-seed.sh
    # after the feed configuration, which adds each one only when absent.
    sed -n '/^if ! grep -q "\^Package: /,$p' /usr/palm/ce-seed/preware-seed.sh > "$T/stanzas.sh" 2>/dev/null
    if [ -s "$T/stanzas.sh" ] && [ -f $APPS/usr/lib/ipkg/status ]; then
        APPS=$APPS sh "$T/stanzas.sh" >> "$LOG" 2>&1
    else
        log "feeds: status entries not checked (no seed script section, or no status file)"
    fi
    return 0
}

# ----------------------------------------------------------------- gst ----
step_gst() {
    rm -f /var/home/*/.gstreamer-0.10/registry.*.bin 2>/dev/null
    return 0
}

# --------------------------------------------------------------- media ----
# The customization copy runs once per flash, so an updated device never gets
# a newly staged wallpaper. Copy what is missing, then let the reclaim job
# remove the staged copies as it does after a flash. Nobody's wallpaper is
# changed.
step_media() {
    _stage=/usr/lib/luna/customization/copy_binaries/media/internal
    [ -d $_stage ] || return 0
    grep -q " /media/internal " /proc/mounts || { log "media: /media/internal not mounted -- later"; return 1; }
    _bad=0
    for _src in $(find $_stage -type f 2>/dev/null); do
        _dst=/media/internal/${_src#$_stage/}
        [ -e "$_dst" ] && continue
        mkdir -p "$(dirname "$_dst")" 2>/dev/null
        cp "$_src" "$_dst" 2>/dev/null
        cmp -s "$_src" "$_dst" || { _bad=$((_bad+1)); log "media: FAILED to copy ${_src#$_stage/}"; }
    done
    [ $_bad -eq 0 ] || return 1
    rm -f $PREFS/ce-customization-media-reclaimed
    log "media: staged media copied; ce-reclaim-customization-media removes the staged copies next boot"
    return 0
}

# ---------------------------------------------------------------- main ----
step_logo

if [ "$(cat $FLAG 2>/dev/null)" != "$MARK" ]; then
    if ! cryptofs_writable; then
        log "$MARK: cryptofs not writable -- will try next boot"
        exit 0
    fi
    log "$MARK: finishing the update"
    _fail=0
    step_seed  || _fail=$((_fail+1))
    step_apps  || _fail=$((_fail+1))
    step_feeds || _fail=$((_fail+1))
    step_gst   || _fail=$((_fail+1))
    step_media || _fail=$((_fail+1))
    if [ $_fail -eq 0 ]; then
        echo "$MARK" > $FLAG
        log "$MARK: finished and verified"
    else
        log "$MARK: $_fail step(s) not verified -- NOT flagging, will try next boot"
    fi
    [ -f "$T/apps-changed" ] && log "apps changed: an app that was already running keeps its old code until Luna restarts"
fi
exit 0
