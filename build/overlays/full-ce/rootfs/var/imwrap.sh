#!/bin/sh
# Transport launch wrapper. The transport binary's ELF interpreter is patched to the
# synergy-glibc loader (/media/cryptofs/synergy-glibc/lib/ld-linux.so.3) so purple-signal's
# in-process JVM works (a plain stock/ld-teams.so.3 glibc SIGSEGVs libjvm). Put synergy-glibc/lib
# FIRST so its matching libc/pthread/dl/rt load (loader<->libc are build-coupled). libstdc++
# preloaded first so its operator new wins over libmojocore's weak _Znwj. Self-rotating at 30MB.
#
# synergy-glibc is a specific, frozen glibc 2.23 build (crosstool-NG) -- NOT interchangeable with
# Atlas's own wpe-252 deviceroot, even though both self-report "glibc 2.23": confirmed live that
# swapping in a copy of Atlas's current wpe-252/lib as synergy-glibc SIGSEGVs immediately
# (dmesg: "CRASH! ld-linux.so.3(...) received 11") the moment the kernel tries to use it as the
# transport's ELF interpreter, despite that exact ld-linux.so.3 running fine standalone as an
# ordinary program -- Atlas's build is roughly HALF the size of this one (different build/config
# entirely) and isn't ABI-compatible with the already-built imlibpurpletransport binary. So this
# dir can't be self-provisioned from anything else already on the device; it must be provisioned
# once, manually, per device (see README-device-launch.md) -- most simply by tar'ing it off a
# device that already has a working copy. A device missing it entirely crash-loops the transport
# forever with "env: can't execute ...: No such file or directory" (confirmed live) -- if that
# happens, check for this directory first before assuming anything else is broken.
LOG=/media/cryptofs/imstdout.log
SZ=$(wc -c < "$LOG" 2>/dev/null || echo 0)
if [ "$SZ" -gt 31457280 ] 2>/dev/null; then mv -f "$LOG" "$LOG.1" 2>/dev/null; fi

# SINGLETON LOCK: com.palm.imlibpurple's own .service AND every per-connector com.palm.<x>.call
# .service both point Exec here, and ls-hubd's on-demand activation races the upstart-managed
# resident daemon (imdaemon.sh) independently -- confirmed live: killing the transport and doing
# NOTHING else (no LS2 calls at all) still produces two fully independent imlibpurpletransport
# processes seconds later, each with its own g_service/g_sa and its own full Teams/Telegram/etc
# login. Whichever one loses a given connector's LSRegisterPalmService call can't receive LS2
# calls for it even though it may have its own valid, separately-logged-in session -- explains a
# night of "REGISTERED but never responds to dial", not any single connector's own code.
# mkdir is atomic on POSIX (unlike a plain file test+create) so this is race-safe without flock,
# which isn't reliably available here. PID-liveness check (not a trap-based cleanup) handles a
# stale lock from a kill -9'd previous instance -- SIGKILL can't be trapped, and this script's own
# `exec` at the bottom means a shell EXIT trap would never fire anyway (exec replaces the process
# image, it doesn't end the shell).
LOCKDIR=/var/run/imlibpurpletransport.lock
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  OLDPID=$(cat "$LOCKDIR/pid" 2>/dev/null)
  if [ -n "$OLDPID" ] && kill -0 "$OLDPID" 2>/dev/null; then
    if [ -z "$IM_RESIDENT" ]; then
      echo "$(date -Iseconds 2>/dev/null) imwrap.sh: already running as pid $OLDPID, not starting a second instance" >> "$LOG"
      exit 0
    fi
    # The resident (upstart) launch lost the race to an on-demand copy ls-hubd started first --
    # anything calling com.palm.imlibpurple before the imtransport job is up does that, e.g. the
    # loginstate activities at boot. Exiting here made upstart respawn the job every few seconds
    # (through its pre-start, if it has one) until its respawn limit stopped it for good, leaving
    # only the on-demand copy, which idles out once every account is offline with nothing
    # resident behind it. Stay up as the job's main process instead, and take over (through the
    # stale-lock reclaim below) once that copy exits.
    echo "$(date -Iseconds 2>/dev/null) imwrap.sh: on-demand pid $OLDPID holds the transport; resident launch waiting for it to exit" >> "$LOG"
    # An on-demand copy that never got past startup will never exit by itself: one thread blocked
    # on a futex before its first log line (a PmLog client killed mid-init during boot leaves
    # sem.PmLogLib locked; see the self-heal below). A healthy transport waits in poll(), so after
    # 60 s of that, kill it and take over -- the reclaim below clears the semaphore first.
    stuck=0
    while kill -0 "$OLDPID" 2>/dev/null; do
      sleep 5
      if [ "$(cat /proc/$OLDPID/wchan 2>/dev/null)" = futex_wait_queue_me ] &&
         grep -q '^Threads:[[:space:]]*1$' /proc/$OLDPID/status 2>/dev/null; then
        stuck=$((stuck+5))
        if [ $stuck -ge 60 ]; then
          echo "$(date -Iseconds 2>/dev/null) imwrap.sh: on-demand pid $OLDPID stuck in startup for 60s (futex, 1 thread); killing it" >> "$LOG"
          kill -9 "$OLDPID" 2>/dev/null
        fi
      else
        stuck=0
      fi
    done
  fi
  echo "$(date -Iseconds 2>/dev/null) imwrap.sh: stale lock (pid $OLDPID gone), reclaiming" >> "$LOG"
  rm -rf "$LOCKDIR"
  mkdir "$LOCKDIR" 2>/dev/null || exit 0   # lost a race against another launcher - let IT run
fi
echo $$ > "$LOCKDIR/pid"   # $$ stays correct after exec below: exec keeps the same PID
# libpurple.so + purple-2/ plugins now live at the real /usr/lib(+/purple-2) -- see
# packaging/README.md "why /usr/lib now". RUNTIME holds only the private, non-stock-colliding
# runtime deps (libstdc++/libgcrypt/libpng16/libwebp/libopus/... -- third-party link deps unique
# to specific prpls, kept OUT of /usr/lib so they can't silently replace a system-wide lib version
# other apps rely on) that used to sit alongside the engine under com.palm.app.teams/backend/lib
# for no good reason (that app dir never had anything to do with the shared backend).
#
# Both /usr/lib/purple-2 and /usr/lib/synergy-runtime are actually BIND-MOUNTED from
# /media/cryptofs (root is a fixed 559MB partition; connector plugins are large enough -- WhatsApp/
# Telegram ~29MB each -- that keeping them there fills it, confirmed live: 0 bytes free after
# installing 4 connectors, one install segfaulted, one left a corrupted ipkg record). Bind mounts
# don't survive a reboot, so re-establish both here on every launch (postinst does the same setup
# once at install time so a fresh install works before the first reboot too).
for _PAIR in "synergy-purple-plugins:/usr/lib/purple-2" "synergy-runtime:/usr/lib/synergy-runtime"; do
  _CDIR="/media/cryptofs/${_PAIR%%:*}"
  _MNT="${_PAIR#*:}"
  mkdir -p "$_CDIR" "$_MNT"
  mount | grep -q " on $_MNT type" || mount --bind "$_CDIR" "$_MNT"
done
RUNTIME=/usr/lib/synergy-runtime
W=/media/cryptofs/apps/usr/palm/applications/org.webosports.app.atlas/deviceroot/wpe-252/lib
G=/media/cryptofs/synergy-glibc
S=/media/cryptofs/sslfix
if [ ! -f "$G/lib/ld-linux.so.3" ]; then
  echo "$(date -Iseconds 2>/dev/null) FATAL: $G/lib/ld-linux.so.3 missing -- transport cannot start." \
       "This is a frozen glibc build that must be provisioned once per device; see README-device-launch.md." \
       >> "$LOG"
fi
# SSLFIX: synergy-glibc/lib ships an OLD libcrypto.so.3 (OpenSSL 3.0.16). Because synergy-glibc must
# be FIRST on LD_LIBRARY_PATH (above), it shadows the newer Atlas OpenSSL in wpe-252/lib, so
# wpe-252's libssl.so.3 (built against 3.3.0+) fails to load ("version OPENSSL_3.3.0 not found").
# libpurple then registers NO ssl provider (purple_ssl_is_supported()==FALSE) and purple-facebook
# -- the ONLY prpl using libpurple's native purple_ssl_* (others bring their own TLS) -- can't do
# HTTPS ("Unable to connect to graph.facebook.com: Cancelled" after a ~30s hang). Fix: prepend a
# dir holding ONLY the matched wpe-252 libcrypto+libssl pair, so OpenSSL loads from there while
# libc/pthread/dl/rt still fall through to synergy-glibc. Self-provisioned from wpe-252 below (a
# re-flash restores it automatically); real copies (not symlinks) so it's self-contained and
# refreshed when the Atlas build changes size.
mkdir -p "$S"
for L in libcrypto.so.3 libssl.so.3; do
  if [ "$(wc -c < "$S/$L" 2>/dev/null || echo 0)" != "$(wc -c < "$W/$L" 2>/dev/null || echo x)" ]; then
    cp -f "$W/$L" "$S/$L" 2>/dev/null
  fi
done
# ENTROPY: this 2.6.35 kernel has no getrandom(2) syscall, so crypto that seeds from the OS
# (SQLCipher/OpenSSL/ring inside purple-presage) falls back to BLOCKING /dev/random. With the tiny
# entropy pool (~130 bits) that read stalls during dlopen, so the presage plugin load HANGS and the
# whole transport looks dead -- intermittently, depending on how much entropy exists at respawn time
# (this is why presage "loaded at boot but crashed on a later respawn"). Point /dev/random at the
# non-blocking /dev/urandom (cryptographically fine post-boot). /dev is a tmpfs, so re-apply each launch.
if [ ! -L /dev/random ]; then
  rm -f /dev/random && ln -s /dev/urandom /dev/random 2>/dev/null
fi

# SELF-HEAL the PmLog init semaphore before EVERY transport launch. libPmLogLib takes a one-time init
# lock on /dev/shm/sem.PmLogLib; if a transport was killed mid-init (kill -9, OR reaped during the boot
# ordering) the sem stays LOCKED and the next transport hangs forever on its first PmLog call -- 1
# thread, no log, no accounts ("no messages come in"). This lives in imwrap.sh (not just imdaemon.sh)
# because BOTH launch paths exec here: the upstart resident daemon (imdaemon.sh) AND the on-demand LS2
# .service. Unlinking is harmless -- sem_open recreates a fresh unlocked one; other holders keep theirs.
# See the imtransport-pmlog-sem-hang note.
rm -f /dev/shm/sem.PmLogLib

# Also preload the SYSTEM libasound (/usr/lib/libasound.so.2): the in-plugin call bridges
# (WhatsApp glue/call.c, Telegram tdlib-purple) open the "voip"/"voipsource" ALSA PCMs, but the
# Atlas wpe-252 libasound on LD_LIBRARY_PATH can't find its pulse plugin module ("No such device").
# The system libasound has /usr/lib/alsa-lib's pulse module + /etc/asound.conf's voip PCMs — the
# same route the standalone wacallm/Signal engines used. Without this: "audio playback/capture-FAIL".
#
# exec /usr/bin/imlibpurpletransport DIRECTLY -- do NOT invoke synergy-glibc's ld-linux.so.3
# explicitly as the command. LS2 (_LSTransportPidToExe in libluna-service2) identifies the calling
# process via readlink(/proc/PID/exe), which only resolves to the real target when the KERNEL
# performs the PT_INTERP hand-off itself; explicitly exec'ing the interpreter makes IT the process's
# own exe, so ls-hubd logs "No role file for executable: .../ld-linux.so.3" and every LS2 call
# gets rejected ("Invalid permissions"). (An earlier version of this file explicitly invoked
# ld-linux.so.3, misdiagnosed as a kernel difference at the time -- it was really just this.)
exec env \
  LD_PRELOAD="$RUNTIME/libstdc++.so.6 $G/lib/librt.so.1 /usr/lib/libasound.so.2" \
  LD_LIBRARY_PATH="$S:$G/lib:$RUNTIME:$W:/usr/lib:/lib" \
  /usr/bin/imlibpurpletransport "$@" >> "$LOG" 2>&1
