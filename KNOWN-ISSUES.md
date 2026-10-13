# webOS CE 3.1.0 — Known Issues (600070 release; last hardware run 2026-08-30)

Everything below is reproduced, measured, or traced to a specific line. Each
entry says what it costs a user, what is actually known, and what a fix would
have to do. Nothing here is speculation dressed as a diagnosis.

Ordered by what should be solved first. None of these blocked the release; they
carry forward to the next one.

**Status on 600070 (released).** Automated: 90 checks, 0 failures on **two
independent devices** — the first fully clean runs of the cycle, with nothing
downgraded by judgement. Reboot soak: 7 cycles × 5 minutes, 112 checks, 0
failures. Restore onto the flashed image: 0 errors, 11/11 services back on the
bus. **#1 and #1b did not fire on either flash**, nor on any of the seven
reboots.

#14 is a new fault, found on hardware *after* the release went out and not
caught by any check in the suite. Of the rest, #12 and #13 are log noise that
was always there and had simply never been written down; #4 recurred and is
explicitly accepted for the release.

*What the clean runs do and do not settle:* #1 fires during the first-use preload
pass, which runs **once per flash**, so reboots cannot exercise it. 600070 has
two clean flashes on different hardware — the first flashes in the cycle to be
measured this way — which is evidence, not closure. #4 fires per **OOBE**, and
600070 saw three OOBEs with one hit.

---

## 14. USB Settings reports "Helper not running" on every fresh flash — DIAGNOSED ON HARDWARE (600070), NOT FIXED

**Severity: high — it is the first thing a user sees in a shipped app, and it is
wrong.** Listed first because it should be solved first; the numbering is
append-only so that the cross-references in older entries keep pointing at what
they were written about.

Opening USB Settings on a device flashed onto a clean media partition shows
"Helper not running. Install via Preware and reboot." The helper *is* running.
Nothing is missing from the image.

**What is actually wrong.** `usbctl-watchd` starts at ~3 s of uptime (`start on
stopped rcS`); `/media/internal`, where all of its IPC lives, does not mount
until ~2 min in. Its first `write_status` therefore fails silently against the
read-only root — but the suppression cache is latched *before* the write it
suppresses (`usbctl-watchd.sh:299-303`):

```sh
    [ "$s" = "$LAST_STATUS" ] && return
    LAST_STATUS="$s"                                    # <-- set before the write
    echo "$s" > "$STATUS.tmp" 2>/dev/null && mv -f "$STATUS.tmp" "$STATUS" 2>/dev/null
```

`LAST_STATUS` now holds a JSON string that was never written, so the 1 Hz loop
early-returns forever and `/media/internal/.usbctl-status` is never created. On an
idle device that string never changes, so nothing ever breaks the tie.
`GetStatusAssistant.js` returns `daemon:false` when it cannot read that file,
which is the warning row.

Measured on a broken device (600070, booted 05:39):

```
usbctl-watchd            pid 164, started at 3.09 s uptime   (/proc/164/stat)
/media/internal mounted  12:41:01  = ~2 min into boot        (messages.0)
/tmp/usbctl-watchd.log   no "started (pid 164)" line         <- even /tmp write failed
.usbctl-status           absent
.usbctl-state            absent
```

The JS service, the ls2 role, the D-Bus launcher on both buses, the upstart job
and the daemon itself are all present and correct. `getStatus` is answered
normally throughout — the log is full of it. Only the status *file* is missing.

**Why the release testing did not catch it.** `.usbctl-status` lives on
`/media/internal`, which a normal Doctor run does not wipe. Every development
device had exercised USB at some point under an earlier build, written the file
once, and carried it across every reflash since. This was read as "USB Settings
works" for the whole cycle. It was found only on two devices flashed onto media
partitions with no history. **Every CE 3.1.0 device is born with this fault**;
the working ones were healed by an event nobody recorded.

Confirmed on the reference device that does work: its `.usbctl-status` is dated
`Sep 3 16:48`, thirty-one hours into a boot that began Sep 2 — matching
`16:48:09 usbctl: mounted /dev/sda1 at /media/usb` in the daemon log. Its
`/tmp/usbctl-watchd.log` is *also* missing the startup line. That device failed
the same boot-time write; a USB stick rescued it a day later.

**What heals it.** Any change to the status JSON breaks the poisoned cache and
lets the write through:

- **Flipping High-power on and back off, inside the app.** `power` is part of the
  JSON, and `togglePower` has no guard on the warning state. Verified by writing
  `power-on` to the control file (both files appeared within 3 s), then
  independently reproduced from the UI on a second device.
- **Plugging in the OTG Y-cable — nothing attached to it.** Verified on a device
  wiped to bare partitions with the toolkit and re-flashed, so no `.usbctl-*`
  state survived from an earlier build. Registering the host controller is enough
  on its own: `otg` goes to `host` the moment `/sys/bus/usb/devices/usb1` appears.
- **Plugging in USB storage** — the same `otg` flip, plus `storage.present`.

The cable paths need the port to have armed at boot, which `arm_otg_once` skips
while `host_connected = 1`. A device that has sat on a PC connection since boot
can only be healed from the app.

Once written, the file persists across reboots and across a re-Doctor, so any of
these is a permanent fix for that media partition.

**What a fix has to do.** Latch `LAST_STATUS` only on a successful write, and
move the `$STATE` seed into the loop so it retries once `/media/internal`
arrives. The edits belong in the `com.webosarchive.usbsettings` ipk, not in the
generated overlay.

Because 600070 is released, the field fix has to come through Preware. The care
needed is on the CE side: the image bakes the app and seeds no ipkg status stanza
for it, so a same-id 1.1.10 would install into `/media/cryptofs/apps` as a fresh
package, and its service directory would claim `com.webosarchive.usbsettings.service`
dynamically against the baked static claim — a clash ls-hubd resolves by dropping
both, which would make the warning permanent and kill the toggle workaround with
it. Three candidate shapes (a CE-aware postinst, a separate CE-only package, or
the first community OTA payload), the recommendation, and the hardware test that
decides between them: `Docs/USB-SETTINGS-HOTFIX.md`.

**Candidate first OTA payload.** The OTA project's blocking open item #5 is that
no real payload exists — the server hosts only a placeholder offer — while
`org.webosarchive.otaready` 1.2.0 is already deployed to users and OTA Ready v2
would reach them as an ordinary app update. A one-file signed hotpatch of
`/usr/bin/usbctl-watchd` fits that gap, and 600070 already bakes the trust anchor
that would verify it. Note it would *not* exercise their open item #4, the
unverified armed flash — a benign payload bounds a failed apply, not a broken
flash path. Authoritative OTA status lives in `OTA-3.1.0.md` in the
`webos-update-exploration` repo, not in our stale `Docs/OTA-STRATEGY.md`.

`state_save` has the same write-then-latch shape and fails identically, so
`armed=yes` never persists and the OTG controller is re-armed every boot.
Harmless, same root cause, same fix.

---

## 15. A message from someone who isn't a linked buddy is never threaded — FIXED in webOS Chat Enabler 3.1.1 and chatthreader 1.1.0.3

**Severity: high for webOS Chat users. It drops the first message from every new
contact.** Found 2026-10-13 by the Lunacy agent on a Pixel, after the enabler's
own testing had passed. That testing only used buddies already linked to a person.

**What is wrong.** 3.1.0 bakes chatthreader 1.1.0 (Synergy's person-link
fallback). In `newmessageassistant.js`, `findPersonViaBuddy`'s second `then()`
reads `future.result` on a buddy miss but never sets a new one. Foundations
clears `isset` before each `then()` and only dispatches the next one on a new
result, so `contactReverseLookup` never resolves. The message is stored in db8
but never gets `conversations`. On CE, `findByIM` also misses linked buddies
(`curator`), so on topaz even those messages took this path and hung.

**Fix.**
- **3.1.0 devices:** webOS Chat Enabler 3.1.1. Postinst step 7 swaps in the
  fixed file, but only over the exact 3.1.0 file (md5 `37c050bc…`), and keeps
  the original. Removal puts the original back if the file is still ours.
- **3.2.0 bake:** chatthreader 1.1.0.3 in `AddToImage/PatchOrReplace`.
- **Upstream:** PR from `codepoet80/com.palm.messaging.chatthreader`
  (`fix-findpersonviabuddy-miss`) against Herrie's
  `herrie/milestone1-channel-routing`. Synergy devices have the same bug.

**Verified on topaz** with messages injected into db8 (see
`WEBOS-CHAT-HANDOFF.md`). Not yet verified with a real send from an account
that isn't a buddy. The enabler's removal restore hasn't been run.

---

## 1. ipkgservice wedged on first boot — REPAIR VERIFIED ON HARDWARE (600063)

**Severity: high — first observed on 600056.** Fires during first use; **clears
on the first reboot — verified on 600056**, not assumed:

```
after reboot:  imtransport                     (start) running, process 3242
               org.webosinternals.ipkgservice  (start) running, process 2124
               synergy bind mount              present
```

Preware's postinst owns `/var/palm/event.d/org.webosinternals.ipkgservice`
(confirmed: the path is listed in `/media/cryptofs/apps/usr/lib/ipkg/info/org.webosinternals.preware.list`).
During the first-use preload pass it stops ipkgservice, rewrites that job file,
and starts it again. Upstart watches that directory and re-reads on change — and caught the file **partially written**:

```
01:49:24  app-install -install-only                          preload pass
01:49:36  Control request to stop  org.webosinternals.ipkgservice
01:49:38  upstart: /var/palm/event.d/org.webosinternals.ipkgservice:
                   unable to read: Invalid argument          <-- partial read
01:49:39  Control request to start org.webosinternals.ipkgservice   (25ms later)
```

The start request had no valid job definition to act on, so the job sits
`(stop) waiting` and further `initctl start` does nothing.

**What it costs the user.** ipkgservice is Preware's backend, so **Preware does
not work** until the device is rebooted. Worse, a power-menu Luna Restart taken
in this state can freeze the device — the failure mode that made `respawn`
non-negotiable on this job in the first place.

**Collateral, same window.** `ce-cryptofs-seed`'s `kick_imtransport` fired while the synergy interpreter was still unseeded, so imtransport's pre-start correctly declined to exec (`interpreter still absent -- not exec'ing`, 18:50:16) — but the job is left wedged in `pre-start` pointing at **pid 8565, which no longer exists**. The missing synergy bind mount is downstream of that, not a third fault. All three automated FAILs on 600056 are this one race.

**Frequency: 1 of 6 observed boots.** Zero occurrences across
600033/600037/600052/600055 (`grep -c 'ipkgservice NOT resident' scripts/results-*.txt`).
Latent since Preware became a preload (`c3eff2b`, 600037) — every earlier roll
simply won the race.

**What a fix must do.** Make the partial read *impossible*, not less likely:
write the job file to a temp path in the same directory and `mv` it into place.
`mv` within a filesystem is atomic, so upstart's inotify sees either the old
file or the complete new one. The natural home is `ce-cryptofs-seed`, which
already runs after first use and already kicks this job.

**Why a timing tweak is not acceptable here.** The race fires roughly one boot in six, so a single clean boot after a change proves nothing. Any fix has to be
justified structurally and validated as "no regression across N boots", not by
one green run.

**What 600062 does.** `ce-cryptofs-seed` gains `repair_ipkgservice`, called from
`kick_dependents`:

1. Waits (bounded, ~90 s) for Preware's preload install to appear — our job and
   the preload pass are both triggered around first-use-finished and the order is
   not guaranteed.
2. Waits up to 60 s more for the service to come up on its own. On a healthy boot
   it returns on the **first** probe and touches nothing.
3. If it is still not `(start) running`, it rewrites the job file the way the
   postinst should have: `cp` to `/var/palm/.ce-org.webosinternals.ipkgservice.job`
   — **outside** the watched directory, same filesystem — then `mv` it into place.
   `rename(2)` is atomic, so upstart's inotify sees either the old file or the
   complete new one. Then `start`.

The settled-system fast path now also requires ipkgservice to be running, or a
Luna Restart on an already-wedged boot would exit early and skip the repair —
precisely the case that needs it.

**Confirmed working on hardware, 2026-08-29 (600063).** The race fired on a
real first boot and the repair caught it — the first live proof, not a bench
test:

```
13:03:49  REPAIRING ipkgservice: (00783/291415258) org.webosinternals.ipkgservice (stop) waiting
13:03:50    job file replaced atomically; starting org.webosinternals.ipkgservice
13:03:55    ipkgservice now: (00787/647624443) org.webosinternals.ipkgservice (start) running, process 13728
```

`(stop) waiting` is the documented signature of the partial read. Six seconds
from detection to a resident service; on RC2 that same boot would have left
Preware dead until the user rebooted. The automated pass on that device reported
the marker and `ipkgservice resident` in the same run.

Logged as `REPAIRING ipkgservice:` in `/var/log/ce-cryptofs-seed.log`;
`ce-test-full.sh` surfaces it as INFO with a count (a repaired boot is a
success, but the marker is how we learn the race's true frequency). The check
says "since this flash", not "this boot": that log is never truncated, so it
spans every boot — an earlier wording reported a previous boot's repair as if it
had just happened. Bench-tested under busybox ash
against all three states: service running (returns, file untouched), service
wedged (atomic rewrite, start issued, no temp left behind), Preware absent
(logs, no damage).

**Deliberately NOT fixed at the source.** The bad write is Preware's own
`pmPostInstall.script` (`rm -f` the job file; `cp` it back in place; `start`
25 ms later), inside a **signed** third-party ipk. Repacking it would invalidate
that signature, and a Preware updated from the feed later would reintroduce the
same `cp` regardless — so the repair has to exist on our side either way. See
"Worth fixing upstream" below.

**Still true after this change:** the race can still fire. What changes is the
cost — recovery within the same boot instead of "Preware is dead until you
reboot", and no window in which a power-menu Luna Restart can freeze the device.
Validation is unchanged: one clean boot proves nothing, and the repair's own
proof is a `REPAIRING` line followed by a resident service.

## 1b. …and a second way the same job dies: the respawn storm — FIXED, 5/5 boots

**Severity: high — found on 600064, root-caused, fixed at the source in Preware
1.9.19 (built into 600067). Distinct from #1: the job file is INTACT.**

From the outside it looks identical — `org.webosinternals.ipkgservice (stop)
waiting`, `ipkgservice NOT resident` — but Preware still *answers* on the bus and
`pidof` shows a live process. What upstart logged:

```
org.webosinternals.ipkgservice main process (17115) exited normally
main process ended, respawning
respawn_count: 11 > respawn_limit: 10
respawning too fast, stopped
goal changed from start to stop  ->  state: waiting
```

**Root cause, in Preware's own service.** `main()` in `source/src/ipkgservice.c`:

```c
if (luna_service_initialize("org.webosinternals.ipkgservice"))
    luna_service_start();      /* g_main_loop_run: never returns */
return 0;                      /* <-- ALSO the failure path */
```

`luna_service_initialize()` returns false when `LSRegisterPalmService()` cannot
take the bus name — which happens whenever the D-Bus hub has already activated an
instance, because `dbus/org.webosinternals.ipkgservice.service` and the upstart
job exec the *same* binary and can race on any boot. On that path `main` fell
through and returned **0**, so "I could not get the bus name" reached upstart as
a clean, successful exit. `respawn` restarted it instantly, it exited 0 again,
and eleven rounds inside one second tripped `respawn_limit: 10`, parking the job.

Preware kept working (the hub's instance serves the bus), which is why this hid
for years — but a power-menu Luna Restart with the job stopped is the failure
mode that made `respawn` non-negotiable in the first place.

**Fixed in Preware (1.9.19, built into 600067).** Registration failure now sleeps
5s and returns non-zero. The sleep spaces retries wider than upstart's limit
window (10 respawns / 5s), so a name conflict becomes a paced retry instead of a
storm, the job is never parked, and when the other instance goes away the next
respawn takes the name for real. `respawn` is kept, so the constraint above still
holds. Verified in the shipped binary: requires only `GLIBC_2.4` (the device has
2.8) and the same EABI5 / `ld-linux.so.3` ABI as the binary it replaces.

**Verified on hardware (600067, 2026-08-29): five consecutive reboots, each
soaked five minutes before checking.**

```
CYCLE 1: OK after 304s | ipkgservice resident, 0 storms, 0 crashes, repairs-since-flash=0
CYCLE 2: OK after 304s | ...
CYCLE 3: OK after 302s | ...
CYCLE 4: OK after 303s | ...
CYCLE 5: OK after 300s | ...
SOAK COMPLETE: 5/5 clean boots
```

`repairs-since-flash=0` is the part that matters: the storm never fired, rather
than firing and being repaired. Two full automated passes on that flash — before
the soak and after six boots — each 84 PASS / 0 FAIL
(`scripts/results-600067.txt`), with all four ipkgservice checks green
(`resident`, `answers`, `no respawn events`, `job intact`).

The exit-code fix makes the storm structurally impossible rather than unlikely:
upstart can no longer be told that a failed bus registration was a success. Five
boots would not be strong evidence for a 1-in-6 race; it is strong evidence when
the mechanism has been removed.

**Device-side backstop, kept deliberately.** `ce-cryptofs-seed`'s repair now
POLLS for ~3 minutes past the seed rather than checking once — a single early
check missed this entirely on 600064, because the service was healthy when we
looked and stormed a minute later. On finding the job not resident it compares
the job file with Preware's copy: rewrites atomically only if they differ (#1's
partial write), otherwise logs it as a respawn-limit stop and issues `start`.
Attempts are capped at 3, because while the hub's instance owns the name every
start re-runs the same futile cycle. This stays: the installed base can carry any
older Preware from a feed.

---

**Worth fixing upstream too.** The defect is not specific to CE preloads — every
Preware install and upgrade, on any webOS device, runs that same non-atomic `cp`
followed by an immediate `start`. It has gone unnoticed for years because on a
settled, idle device the write completes well inside upstart's read window; CE's
first-boot preload storm is what widens it enough to lose ~1 boot in 6. The
upstream fix is two lines in `pmPostInstall.script`:

```sh
# was:
cp $APPS/usr/palm/applications/${PID}/upstart/${SID} /var/palm/event.d/${SID}
# instead: write outside the watched dir, then rename atomically
cp $APPS/usr/palm/applications/${PID}/upstart/${SID} /var/palm/.${SID}.tmp
mv /var/palm/.${SID}.tmp /var/palm/event.d/${SID}
```

(The temp file must not live in `/var/palm/event.d` itself — upstart watches that
directory and would try to parse the temp name as a job.) Keep our repair even if
upstream takes the patch: CE ships Preware 1.9.19 today, and users can install any
version from a feed.

---

## 2. Restore silently dropped apps over ~350MB — FIXED, verified on 600056

**Severity: was high. Verified fixed on hardware 2026-08-23.** A 115-package
3.0.5 backup restored onto 600056 with **102 installed, 0 failed**, and both
previously-failing games came back. The measured times prove it was the budget:

```
com.ea.app.nfshp.pad.na    296MB archive   127s   old budget 120s -- missed by 7s
com.gameloft.app.driverhd  199MB archive   157s   old budget 120s -- missed by 37s
```

Worst observed cost was 0.79 s per archive-MB (driverhd); the budget allows 3 s,
so the thinnest real margin was 3.8x. Zero occurrences of "timed out" or
"failed" in the whole helper log. Retained here for the history and for the
constraint at the end, which still binds.

On the 600055 restore, 2 of 115 packages failed: Hot Pursuit (427MB) and
Driver HD (379MB). Sandstorm (261MB) and Tiger Woods (248MB) succeeded. A cutoff falling *between* archives written the same way is the signature of a fixed budget, not a bad archive — `restoreAppDirectories` extracted with a flat
`{ timeout: 120000 }`.

600056 sizes every restore stage by the archive it is handling:

```js
listBudget    = clamp(archiveMb * 3000, 600s, 1800s)   // was flat 180s
clearBudget   = clamp(archiveMb *  500, 120s,  600s)   // was flat  30s
extractBudget = clamp(archiveMb * 3000, 600s, 1800s)   // was flat 120s  <-- the bug
```

Sizing on the *archive* while the cost is driven by *installed* bytes is the
weak spot; the 600 s floor is what covers a large, highly compressible app. At
that floor every app size seen on a device keeps a ≥3x margin.

**Diagnosability was the deeper bug.** `exec()`'s timeout kill arrives as an
Error whose message is `Command failed:` with nothing after it — indistinguishable from a real tar error, which is why this read as archive corruption for a full release cycle. 600056 names the stage, says whether the clock ran out, and carries the reason into the restore receipt.

**Constraint for anyone tempted to add more room:** `PACKAGE_OP_TIMEOUT_MAX` in
`common.js` must **not** be raised. `doRestore` spends it twice, so 60 minutes
each already equals the bus's 7200 s `commandTimeout`. Past that the caller has
given up and there is no receipt at all.

---

## 3. Manifest cache collided by name — FIXED in woce-backup 3.1.1

**Severity: was high — cost a full day of work. Fixed in woce-backup 3.1.1,
staged into the image 2026-08-29; not yet exercised on hardware.**

`syncManifests` reconciles the on-device manifest cache **by name only**, and
manifest names (`NNNNNN-<nduId>`) are not unique: the counter restarts when a
store is cleared. `/media/internal` survives a Doctor flash, so a stale
`000001-19Q` from an earlier restore outlives the reflash and shadows the real
one from the backup being restored.

Observed: restore failed with "Error restoring data" / "No such file or
directory" and reported `restored 6 file(s), 0 skipped` for a 115-package
backup. The host copy of the backup was verified perfect (128/128 files, 0
corrupt) — the device was reading a different manifest of the same name
(md5 `3f601e2a…` on device vs `8213e447…` in the backup).

**Workaround** is in `BACKUP-RESTORE.md`: clear the manifest cache before
restoring a backup that came from another device or another store.

**The fix (woce-backup 3.1.1).** `syncManifests` now treats the target as the
source of truth for **content**, not just existence: it re-fetches every manifest
the target lists. The old code computed `missing` (fetch) and `stale` (drop) and
left any name present on BOTH sides untouched — which is the collision exactly.

Cheaper reconciliations were considered and rejected, recorded here so they are
not re-proposed:

- **Etag/hash from the listing** — `list()` reports an `Etag` only for the
  content-addressed `files/` store. Manifests carry none.
- **Size comparison** — specifically weak *here*: manifests list fixed-width
  checksum strings, so two manifests describing similarly-shaped backups can have
  identical byte length and different content.
- **Size + mtime** — `get()` is a plain copy and does not preserve mtime, so the
  local copy's mtime is its fetch time; the test degenerates to re-fetching.
- **The `nduId` inside the manifest vs its filename suffix** — cannot
  discriminate: the colliding copies come from the *same* device (the counter
  restarts when a store is cleared), so both carry the same nduId.

Manifests are small JSON and their count is bounded by `trimManifests()`, so
re-fetching all of them is the cheap correct answer. A fetch that fails now
**deletes** the cached copy rather than leaving it — an unverified cache entry is
the thing this sync exists to prevent — and each fetch is wrapped so one
unreachable manifest cannot strand the rest (`mapFuture` chains sequentially, and
an escaping exception would skip every manifest after it).

Covered by a regression test in `tools/test/run-tests.js` ("Manifest cache
collision") that tampers with a cached manifest and asserts the sync refreshes it.
Verified to fail on the old code (123 passed / 1 failed) and pass on the new
(124 passed / 0 failed).

**The second half of the old prescription — "a restored N files count wildly
below the package count should be treated as a failure" — was deliberately NOT
implemented.** Re-reading the incident, it would not have caught it: the stale
manifest genuinely described 6 files, so the restore faithfully restored 6 and
every count agreed with itself. The defence is the identity of the manifest,
which the sync fix now guarantees. Worth doing on its own merits; it is not a fix
for this bug and should not be recorded as one.

**Verified on hardware, 2026-08-29 (600067).** A 3.0.5 backup restored onto a
freshly flashed CE device:

```
Restore receipt: {"installed":102,"failed":0,"notCaptured":1,
                  "alreadyPresent":0,"imageProvided":12,"servicesRegistered":11}
Restore complete: 000001-19Q, 0 skipped, 102 package(s) reinstalled
```

Matches the RC2 gate (102/0) on a build with the rewritten reconciliation, and
`0 skipped` means `com.palm.appDataBackup` answered `postRestore` this time (#5
did not fire). The new path logged on all four call sites:

```
Manifest cache synced: 1 of 1 refreshed from the target; 0 stale dropped
```

Be precise about what that proves: `1 of 1` means one manifest and no name
collision, so the *collision* was not exercised on device — the regression test
covers that. What hardware proved is that always-refetching works in the real
service, on every path that calls it, without breaking a 115-package restore.
That was the regression risk worth testing on metal.

Zero `Error restoring`, zero `ENOSPC`, zero `timed out` in the whole run. The
only restore-adjacent error was `mojomail-eas: CREDENTIALS_NOT_FOUND` — an EAS
account restored without its password, which is expected (credentials are not in
a backup) and needs re-entering by hand.

**Partially exercised 2026-08-30.** A backup taken *on* the CE device now sits
beside the restored one from another device, and their names differ in the nduId
suffix exactly as designed — `000001-19Q` (the other device) and
`000002-z4hm8DO` (this one) — with `Manifest cache synced: 2 of 2 refreshed from
the target` handling both. That is the first run with more than one manifest.

**Still to do:** the collision itself needs two manifests with the *same* name
from different stores, which requires a device whose counter has restarted. Until
that has been restored through, the `BACKUP-RESTORE.md` workaround stands.

---

## 4. LunaSysMgr SIGSEGV at OOBE teardown — RECURRED on 600070, NOT a ship blocker

**Severity: low. Shipping with it.** Everything recovers: OOBE handoff completes,
the launcher comes up, upstart is untouched, and the device is fully functional
afterwards. The faulting process was exiting anyway.

The minimal-mode first-use instance (`LunaSysMgr -s -u minimal -a com.palm.app.firstuse`)
faults in `PrvLogThread` on a freed GLib async queue while tearing down at OOBE
handoff. Signature, identical every time:

```
Cmd: /usr/bin/LunaSysMgr -s -u minimal -a com.palm.app.firstuse
Signal: 11 (SIGSEGV), kernel-generated
pc/lr -> _ZL12PrvLogThreadPv
```

**Frequency across the 3.1 cycle — roughly one OOBE in three:**

| build / event | rdxd reports |
|---|---|
| 600052 flash | 0 |
| 600055 flash | 1 |
| 600056 flash | 0 |
| 600067 flash | 0 |
| 600070 flash (device 1) | 0 |
| 600070 full erase + German OOBE (device 1) | **1** |
| 600070 fresh flash + French OOBE (device 2) | 0 |

The last row is the useful new data point: it is an **OOBE without a flash**, which
localises the trigger to the first-use teardown itself rather than to anything the
Doctor does. It also means a factory reset can produce a crash report on a device
that was previously clean — worth knowing before someone reads that report as
evidence of a bad flash.

**Why it is not fixed:** the fault is in a thread being torn down on a path that
runs once per OOBE, in stock Palm code. The fix would be ordering work inside
`LunaSysMgr`'s log thread shutdown against the GLib queue's free, on a code path
with no user-visible symptom. That is real risk against a cosmetic report, on a
rootfs frozen for the release.

**If you are triaging a crash report on a CE device, check the component first.**
This one is `LunaSysMgr` with `PrvLogThread` in the stack and a first-use command
line. Anything else is not this issue.

---

## 5. `com.palm.appDataBackup` does not answer `postRestore`

**Severity: medium — recorded honestly, not silently swallowed.**

**Intermittent.** Seen on the 600055 and earlier restores:

```
com.palm.appDataBackup/postRestore did not answer within 60000ms
```

but **not** on the 600056 restore, which finished with `skipped: []` — the
service answered. So this is a timing/load condition, not a permanent
incapacity, which also means a single clean run does not clear it.

The restore records it in the receipt's `skipped` list rather than failing the
run. When it does fire, HTML5 app data and the launcher page layout are not
restored. Not yet investigated.

---

## 6. Preware patch packages restore as inert payload directories

**Severity: low.**

Two Preware-installed *patches* come back from a directory restore as their
payload directories rather than as applied patches — the files land, but nothing re-applies them. Patches are outside what `ipkg` can reinstall from an archive.
Not investigated further; recorded so it is not rediscovered as a restore bug.

---

## 7. First-boot housekeeping window (~90 s) looks like breakage

**Severity: cosmetic, already documented for testers.**

Preware shows no packages and the IM transport is absent for roughly 90 seconds
after setup completes, because the feeds are seeded only after the 31MB cryptofs
copy finishes. Working as designed; called out in RELEASE-NOTES so testers do
not report it.

---

## 8. Power menu "Shut Down" rebooted instead — FIXED, verified on 600059

**Severity: was medium. FIXED — verified on hardware 2026-08-29 (600059).**
Every option in the power menu now does what it says: Shut Down powers the
device off, Device Restart reboots, Luna Restart restarts Luna. On the device,
`/sbin/{reboot,telinit}` are the stock OEM binaries (59939 / 67313 bytes,
Dec 21 2011), `halt` and `poweroff` are symlinks to `reboot`, and no `*.real`
files exist.

`/sbin/halt` and `/sbin/poweroff` are symlinks to `/sbin/reboot`, and that
binary is upstart's `reboot(8)`, which chooses halt vs. power-off vs. reboot
from `basename(argv[0])` alone — an unrecognised name falls through to reboot.
From 600011 to 600058 `bake.py` §19d installed a diagnostic tripwire: a
`#!/bin/sh` shim at `/sbin/reboot` (and `/sbin/telinit`) that logged the caller
and then ran `exec /sbin/reboot.real "$@"`. A shell shim cannot preserve
`argv[0]`, so the real binary saw the name `reboot.real` and rebooted:

```
powerd (machineOff)  ->  /sbin/poweroff  ->  symlink to /sbin/reboot (shim)
                     ->  exec /sbin/reboot.real   ->  name "reboot.real" -> REBOOT
```

`powerd` calls `/sbin/poweroff` for `machineOff` (the literal is in the binary),
so this affected **every** power-off on CE — the power menu's Shut Down and the
critical-battery shutdown alike — not just the button the tester pressed. The
Advanced Reset Options patch itself is innocent: its Shut Down calls
`machineOff` and its Device Restart calls `machineReboot`, exactly as intended.

**Fix.** The tripwire is retired: `bake.py` no longer writes the shims or the
`*.real` copies, so all four names are the stock binaries again. The overlay
copies are deleted too, so this is correct even in a build that has not been
re-baked. `ce-test-full.sh` check 8 now asserts `/sbin/{reboot,poweroff,halt,
telinit}` are ELF binaries and that no `*.real` leftovers exist — the tripwire
was diagnosing spontaneous reboots for a year without anyone noticing it caused
a class of them, so the regression guard is the point.

**What still needs a device.** Press Shut Down **on battery** (a TouchPad on a
charger powers itself back on, which looks identical) and confirm it stays off.

**What is lost.** The "who called reboot" diagnostic. Any future wrapper over
these names must keep `argv[0]` intact — same-named binaries in their own
directory, never one shim serving all three.

---

## 9. Newly installed apps landed on the Games tab — NOT REPRODUCIBLE, closed

**Reported against RC2; did not reproduce on a clean 600059 flash (verified on
hardware 2026-08-29).** New installs from the browser, the App Catalog and
Preware all landed on DOWNLOADS, the second tab, which is where the source says
they should go: LunaCE's `installedAppsPageIndex` is 1, and
`pageIndexForAppByPredefinedDesignators` sends any `userInstalledApp()` there.
Nothing in the image overrides those defaults, and the GAMES tab is the built-in
FAVORITES page renamed via `app-keywords-to-designator-map.txt`, inserted at
index 2 — which is why it sits third.

**The likely explanation for the RC2 sighting is device state, not the image.**
That device had taken a 115-package 3.0.5 restore, and the marshal consults
`PageRestore::itemPositionAsStoredOnDisk(appId)` *before* every other rule — a
restored or previously-saved launcher layout can therefore pin an app to a page
that has nothing to do with the defaults. Left here rather than deleted, so that
a future report of the same symptom starts by asking whether that device had
been restored to, and reads the `APP-MARSHALL` lines in `/var/log/messages`
(they name the chosen page index and the rule that chose it).

Note for the record: the README previously said CE renames the **Downloads** tab
to Games. It does not; it renames **Favorites**. Corrected 2026-08-29.

---

## 10. A dirty VFAT volume makes the Doctor silently skip the app-store wipe

**Severity: high — cost a device a working first boot; reproduced once, cured,
and now guarded. Observed on the 600060 flash, 2026-08-29.**

The device came up to a pulsing logo and stayed there for minutes. LunaSysMgr
was running and had not crashed; what was actually wrong is that
**`/media/cryptofs/apps` did not exist**, so the stock preload pass failed every
single package (photos, calendar, email, maps, enyo-findapps, clock, payment,
flashplugin) and retried on a 3-second sleep indefinitely. Downstream of that,
Preware never installed, so `org.webosinternals.ipkgservice` was an **Unknown
job** to upstart. The UI eventually appeared, which reads as "it recovered" —
it had not: the device was running with no app-store root at all.

**Mechanism.** `/media/internal` is **VFAT, mounted `errors=remount-ro`**:

```
/dev/mapper/store-media on /media/internal type vfat (rw,...,errors=remount-ro)
```

The Doctor's `AppDeletion` stage mounts that volume as `/tmp_mediafs` and `rm`s
the encrypted app store under `/tmp_mediafs/.palm`. On this flash the volume
went read-only, and ~17,700 removals failed:

```
600060:  AppDeletion: attempting to remove appDirectory: /tmp_mediafs/.palm
         rm: can't remove '/tmp_mediafs/.palm/=2VAXISXA=/...': Read-only file system   x ~17,700
         (no "removed the appDirectory" line)
         ...and the Doctor reported  Flash End time (Success)

600061:  AppDeletion: attempting to remove appDirectory: /tmp_mediafs/.palm
         AppDeletion: removed the appDirectory: /tmp_mediafs/.palm
         Read-only file system hits: 0
```

The store was left half-wiped: `.browser`, `.webdiskcache` and `tmp` survived,
`apps` did not, and **nothing in the image recreates it** — the rootfs ships only
the bare `/media/cryptofs` mountpoint; the `apps` tree is created inside the
encrypted store at first boot.

**What dirtied the volume.** Before that flash the device had taken two 103MB ipk
pushes, a failed install and a WOQI retry loop, and was then put into recovery
with Home+Power — a hard power cut for a mounted VFAT volume. Erasing the drive
(Device Info -> Reset Options -> Erase USB Drive) and entering recovery from a
clean power-off cured it: the very next flash wiped the store correctly. So the
trigger is device state, **not** the image — 600060 and 600061 differ only in
build stamps and the seed fix below.

**Why it is still ours to handle.** A user who force-reboots into recovery after
heavy writes will hit exactly this, and the Doctor calls both outcomes success.

**Guards added in 600061.**
- `ce-cryptofs-seed`'s readiness probe used to `mkdir` a scratch directory at the
  store root. That passed in 0 s on the broken boot and the next line was
  `mkdir failed: apps`. It now probes `/media/cryptofs/apps/usr/lib/ipkg` — the
  path everything downstream needs — and creates it if absent, before the preload
  pass runs. `mkdir -p` is idempotent, so on a healthy flash it is a no-op stat
  (verified on 600061: `cryptofs usable after 0s`, zero `REPAIRED:` lines).
- A missing root is now announced: `REPAIRED: /media/cryptofs/apps was MISSING`,
  pointing at the Doctor log. A store so damaged the root cannot be created says
  so explicitly instead of logging a cheerful "writable" and failing silently.
- `ce-test-full.sh` asserts the store root exists and that the seed log carries no
  `REPAIRED:` line — a repair that fires on a supposedly clean flash means the
  wipe failed again and we are only papering over it.

**Not fixed:** the Doctor still reports success after failing every removal.
Making `AppDeletion` fatal means patching OEM Java; the first-boot guard was the
cheaper half. **After any flash, check the Doctor log for
`AppDeletion: removed the appDirectory` and for `Read-only file system`** — its
own success message does not distinguish them.

---

## 11. Scheduled backups grew without bound — FIXED, verified end to end

**Severity: was high — it filled a 27.5GB volume to 100% in four days and then
every backup failed. Found on a 3.0.5 daily driver 2026-08-29, fixed in
woce-backup 3.1.1, verified on hardware 2026-08-30.**

The user's device kept filling up "even when I'm not using it". `webos-backups`
was 9.6GB and the leftover staging directory another 1.85GB — together ~42% of
the volume — with a scheduled backup running daily at ~05:05.

**Cause 1: the content-addressed store never deduped app archives.** The same
archive was stored six times:

```
com.ea.app.nfshp.pad.na-app.tar.gz   309,556,846 bytes   (Need for Speed: Hot Pursuit)
  c66cbfd7… Aug 26 05:05    ef782df1… Aug 28 11:46
  741bd4e9… Aug 27 05:06    61839db2… Aug 29 05:04
  36a733b9… Aug 28 05:04    ee6208f6… Aug 29 15:56
```

Six checksums, one identical byte length. `tar czf` stamps the moment of
creation into the gzip header, so an app that had not changed since yesterday
produced a *different* archive and the store took another full copy. Growth was
therefore per **run**, not per **change** — ~295MB/day from that one app.

Confirmed on the device rather than assumed: two `tar czf` runs of identical
content two seconds apart differ in **bytes 4..7 and nowhere else**. (A host
check misled at first — GNU tar compresses from a stream and gzip writes MTIME=0
for stdin, so the fault does not reproduce with desktop tar.)

**Cause 2: a failed run leaked everything it had already stored.** Files are
stored as the run goes and the manifest is written last, so a run that dies
leaves full-size objects nothing references — and only the success path purged.
Two of the six copies above belonged to failed runs. By the end the device was in
a death spiral: `Backup failed: ENOSPC, No space left on device`, each attempt
leaving more behind.

**Fixed in woce-backup 3.1.1.** `normalizeGzipMtime()` zeroes the four header
bytes after tar succeeds, before anything hashes the file (non-fatal if it
cannot: a stamped archive still restores, it just will not dedup).
`handleError` now sweeps with `purge(target, 100000)` — orphans go, manifests
stay, because a failed backup must not also delete the user's good ones. The
purge machinery itself was never broken: opting out reclaimed all 11.5GB.

**Verified end to end on hardware, 2026-08-30 (600067)** — but only on the
*second* post-fix run, and the first one is worth understanding before anyone
panics at it.

**Run 1 after the upgrade cost 1.57GB, and that is expected, once.** The store
still held objects written by the OLD code, which carry a timestamp in the gzip
header. A normalised archive can never match one of those, so every large app was
stored a second time:

```
309,556,846  Aug 22 20:36  768c725f…     309,556,846  Aug 30 09:06  b5ae8d53…
208,060,017  Aug 22 20:40  58e745ae…     208,060,017  Aug 30 09:10  839309a9…
store: 1.88GB -> 3.45GB, 128 -> 216 objects
```

Those pairs are byte-identical except bytes 4..7 — proven on device:

```
bytes 0..3 (magic)  SAME     bytes 8..15   SAME     bytes 16..1039  SAME
bytes 4..7 (MTIME)  DIFFER
Aug 22 object bytes 4..7 = 0125f911…  (a real timestamp, old code)
Aug 30 object bytes 4..7 = f1d3ff84…  = four zero bytes (fixed code)
```

**Run 2, with both sides written by the fixed code, is the real measurement:**

```
                 before          after          delta
manifests            2              3           +1
objects            216            218           +2
store        3,447,088 KB   3,450,128 KB    +3,040 KB  (3 MB)
```

Two small objects — changed db8/prefs/cookies — for a backup covering
1,606,535,329 bytes of content. No new object over 1MB; the largest objects in
the store are unchanged. Under the old code that run would have added ~1.6GB.

**Method note, because the first attempt at this got it wrong.** An earlier check
sampled the store *mid-run*, before the large archives were processed, and
reported +336KB as if the run had finished — it had actually added 1.57GB. Take
the measurement after the manifest appears (it is written last), and do not trust
`find -newermt` on this busybox: it silently matches nothing, which produced a
second false "0 objects" reading.

---

## 12. `PALMPROFILE SET ERROR` in the log on every account operation — cosmetic

**Severity: none (log noise), but it reads like a failure.** Observed on 600070
after a deliberate account sign-out / sign-in, 2026-08-30: five occurrences
across the operation, then none.

What actually happens, from the log rather than from guessing:

```
{palmprofile/accountservices}: Sending regular request (curl/https) to:
    https://appcatalog.webosarchive.…
{palmprofile/accountservices}: Sending regular request to server with method: getPreferences
{palmprofile/accountservices}: ---------- PALMPROFILE exception log ---------"UNKNOWN_METHOD"
{palmprofile/accountservices}: ---------- PALMPROFILE JSONException (getPreferences) ---------
{palmprofile/accountservices}: ---------- PALMPROFILE SET ERROR ---------
```

The account service asks the community profile server for `getPreferences`; the
server does not implement that method and answers `UNKNOWN_METHOD`, which the
stock client logs as a "SET ERROR". `keymanager: BackupInfoSendHandler received
error: UNKNOWN` in the same instants is the same cause, not a second fault.

**What it costs a user: nothing observable.** The account is created and
persists, `listAccounts` returns it, db8 answers, and sign-out/sign-in both
complete. The messages are logged at `user.info`, not error level.

**Why it is here and not fixed:** the missing method is server-side, on the
webOS Archive side rather than in the image, so no image change can silence it.
A fix would be either implementing `getPreferences` on the server or teaching
the client that the method is optional — the latter means patching stock
`accountservices`, which is not worth the risk for log noise.

**Why it is written down at all:** anyone reading `/var/log/messages` after an
account problem will find five lines shouting ERROR and reasonably conclude
they have found the cause. They have not.

## 13. `phoneNumberQuery: Unknown PalmCall failure` on a Wi-Fi TouchPad — expected

**Severity: none.** `com.palm.deviceprofile` calls
`palm://com.palm.telephony/phoneNumberQuery` while assembling the device
profile. A Wi-Fi-only TouchPad has no telephony stack to answer, so the call
fails and the framework logs a stack trace at `user.warning`.

Stock behaviour on Wi-Fi hardware, not something CE introduced — `listAccounts`
still reports a `com.palm.telephony` template on these devices because the
account type is present even where the radio is not. Same reasoning as #12: it
is documented so a stack trace in the log is not mistaken for a real failure.

---

## Carried over from earlier builds

- **LunaDownloadMgr SIGSEGV** (`curl_multi_remove_handle`). The 1.1.0 patch
  *reduces* but does not eliminate it; recurred on 600033 on the first download
  after boot. webOS 3.x only. Trigger still not understood.
- **"Not Enough Storage" popup** after leaving USB drive mode — an MSM-exit
  remount race, not a real disk condition.
- **No post-setup account manager.** The sign-in app is first-use only in this
  build; managing the account afterwards ships as a separate App Catalog app.
- **No on-device rollback.** Recovery is re-Doctoring, by design.

---

## How these were found

`scripts/ce-test-full.sh` decides ~100 checks a shell can decide; results land in `scripts/results-<BUILDMARK>.txt` and are marked into `Docs/TEST-PLAN.md`. Comparing runs across builds is what surfaced #1 — the check had passed in four prior runs and failed in the fifth, which is the only reason it was recognised as new rather than assumed to be longstanding.

`scripts/ce-reboot-soak.sh` reboots the device N times and re-runs the check set after each boot; results land in `scripts/results-<BUILDMARK>-soak.txt`. It exists because #1 fires roughly one boot in six, so a single clean boot is not evidence. One design note worth keeping: `/var/log/messages` rotates at ~2 MB, which on this device is every ~13 minutes, so any counter read as a since-flash total can be silently reset mid-soak — a rotation would then read as an improvement. Per-boot counters are scoped to the current boot's slice of the log, and reboots are proved with `/proc/uptime`, which cannot rotate.

#12 and #13 came from reading the log around a deliberate account sign-out/sign-in rather than from any check — both are stock components complaining about things that do not exist in CE (a server method, and a cellular radio).
