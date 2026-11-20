# OTA plan — CE 3.1.0 → 3.2.0, then stock 3.0.5 → CE

**Status, 2026-11-20:** the payload generator, the device check and `ce-ota-finish`
exist. An unsigned 600070 → 600109 payload was applied by hand to a running 3.1.0
TouchPad five times; the last two, the same 600070 → 600112 payload on two
devices, were clean end to end (§2.0a to §2.0e). The update ramdisk has not been tried and nothing is signed. The rest of
this document is the plan of 2026-10-04. The OTA reference stays
`../webos-update-exploration/OTA-3.1.0.md` (trust model, client, server; read-only
from this repo). This document is the image side's plan for the two payloads, and
for what the image build has to produce for them. `OTA-STRATEGY.md` is the older
design; its §2 bootstrap plan is superseded by Path B below.

Two paths, in this order:

- **Path A — CE 3.1.0 → CE 3.2.0.** Small, known delta, one known starting state.
  Its job is to **learn and prove the delivery mechanism** — above all the armed
  flash, which has never run end to end (OTA-3.1.0 open item #4).
- **Path B — stock HP webOS 3.0.5 → CE.** Same mechanism, carrying ~118 MB of
  change onto devices we did not build, without wiping them. Only starts once A has
  proven the mechanism on hardware.

---

## 1. Foundation shared by both paths

### 1.1 The payload is a rootfs diff, generated, never hand-written

Both paths answer the same question: *what turns rootfs X into rootfs Y?* The bake
already produces Y exactly, and the harness already produces the full image
rootfs (`build/work/webos/rootfs.ce.tar.gz`). So the payload should be **generated
by diffing two complete rootfs tarballs**, not assembled from a list of ipks and
postinst replays (the approach in `OTA-STRATEGY.md` §2.4, written before the bake
became the single source of truth):

| From | To | Old rootfs source |
|---|---|---|
| CE 3.1.0 (600070) | CE 3.2.0 | rebuild from tag `3.1.0-CE-Release` (confirmed reproducible; the tracked overlay's input hash still matches) |
| stock 3.0.5 | CE target | `build/work/webos/nova-cust-image-topaz.rootfs.tar.gz` (the OEM rootfs the bake starts from) |

New tool, `build/ota/make-payload.py old.tar.gz new.tar.gz` → for every member:
added, changed (content, mode, owner), removed, symlink retargeted. Output:

- **One data ipk** with every added/changed file at its final path, under a
  package id that exists in neither ipkg database (e.g.
  `org.webosarchive.ce-ota-3.2.0`). Never reuse an existing id: `mmipkg` upgrades
  remove-then-install, so a partial ipk under a stock id deletes the rest of that
  package.
- **A postinst** for what tar can't express: removals, symlinks, and the
  `/usr/lib/ipkg/info` edits that keep the rootfs package database identical to a
  flashed image's. It must `exit 0` on every path, because `mmipkg` aborts the whole
  update on nonzero.
- **Signed-manifest inputs**: sha256 of each file and the target binding
  (`from` version and buildmark range → `to`).

A rootfs diff includes the harness's ipkg database rewrites (stock `.md5sums`
re-attributed, `org.webosarchive.ce-files.list/.md5sums`). That makes an OTA'd
device pass `integcheck` like a flashed one.

Today `ce-files` has a `.list` and `.md5sums` but **no `.control`**, so `mmipkg`
does not treat it as installed. Keep it that way, or an OTA that touched it would
remove all 3,457 CE files first.

### 1.2 Split the work by where it can run

The armed flash runs the payload in the update ramdisk (`ota.sh` → `PmUpdater` →
`mmipkg`, postinst chrooted into `/rootfs`). There is no Luna, no D-Bus and no
working upstart there, and as far as the docs show, `/media/cryptofs` is not
mounted. So:

| Where | Does | Mechanism |
|---|---|---|
| Ramdisk | everything under `/` (files, removals, symlinks, ipkg db, `/boot`) | the data ipk + postinst |
| First boot after the OTA | cryptofs edits, bus registrations, db8, reconciling anything Preware installed | one shipped upstart job, `ce-ota-finish`, verify-then-flag like the existing CE first-boot jobs |

`ce-ota-finish` is the only part that needs per-release logic. Everything in the
ramdisk half is mechanical output of the diff.

### 1.3 Acceptance test: convergence

**An OTA'd device must end up identical to a flashed one.** That one rule turns
"did it work" into a measurable check:

1. Flash device X with the old image and lightly use it; take a second device Y
   and flash it with the new image.
2. OTA device X.
3. Compare `/` on X and Y: path, mode, symlink target and md5 of every file
   (excluding `/var`, `/media`, `/tmp`, `/proc`). Every difference must be listed
   and explained in the payload's notes. Expected exceptions: `BUILDTIME`,
   `buildDate`.
4. Run `scripts/ce-test-full.sh` on X. It must pass the same checks as on Y.

### 1.4 Prerequisites owned by the OTA repo (not built here)

These live in `webos-update-exploration` and block **any** real OTA, A included.
Listed so the plan is honest about the critical path:

- **OTA Ready v2**:
  - signed-manifest verification (M10) before anything installs. Today's
    `direct-update.sh` only *warns* on an MD5 mismatch.
  - `serial` downgrade protection and target binding (§12.1).
  - The M6 version fix: send `PRODUCT_VERSION_STRING`, not `BUILDNAME`, or every
    device parses as version 0.
  - The read-only-root restore. The checked-in 1.2.0 ipk predates that fix; the
    source has it, and the version needs a bump.
- **Manifest tier field.** The daemon must refuse to armed-flash a manifest that
  didn't ask for it.
- **Staging.** `/var/lib/update` is 16 MB and `/var` has ~55 MB free on CE. The
  payload must stage on `/media/internal`. That volume is exported over USB, so
  verify-then-install there is a TOCTOU (§12.2). Mitigation: re-verify the sha256
  after the copy into the ramdisk session, where USB mass storage is not active.
- **Server.** Stop auto-offering every `.ipk` dropped into `packages/` (the empty
  `target_build` means it goes to every device), and gate on `target_build`.

---

## 2. Path A — CE 3.1.0 → CE 3.2.0

### 2.0 Measured against a candidate: 600070 → 600107 (2026-11-20)

600107 is the target while 3.2.0 is not final. Every number here comes from the
tool, so a later candidate is one command:

```sh
build/ota/make-payload.py build out/webosdoctorp310hstnh-ce-600070.jar \
    out/webosdoctorp320hstnh-ce-600107.jar --out out/ota/600070-600107
```

It reads both rootfs images straight from the Doctor JARs. The old image is the
released 600070 JAR itself, which is what devices carry, so no rebuild from the
tag is needed. It writes `delta.json`/`delta.txt` (every difference), the payload
`org.webosarchive.ce-ota-3.2.0_600107_all.ipk` with its generated `preinst` and
`postinst`, and `manifest-inputs.json` for the signer (from/to marks, payload
sha256, and the sha256 of 600070's `org.webosarchive.ce-files.md5sums` for the
pre-flight of §2.4). It refuses to write a payload unless applying it to the old
image's member table gives the new image's exactly. For 600107 that check passes
for all 21,989 members.

The payload was also unpacked on the build machine: 600070's rootfs extracted
with GNU `tar` under `fakeroot`, then `preinst`, the data tar and `postinst` with
their paths pointed at that tree. Every file's content, every symlink and every
path then matched 600107. That run found one thing the member tables could not:
an empty `com.palm.app.contacts/tests`, a directory no tar names, which
`postinst` now removes. Not checked there: owners, and 59 read-only files'
modes, which `fakeroot` does not keep on disk. **The device's `tar` is not GNU
`tar`, and the payload has not run on a device.**

| | |
|---|---|
| Paths that differ | 1,313: 437 added, 707 changed, 104 hard link → file (zoneinfo), 10 removed, 52 ipkg db files, 3 version files |
| File bytes delivered | 53.3 MB |
| Payload ipk | 20.1 MB (gzip). More than `/var/lib/update`'s 16 MB, so staging on `/media/internal` (§1.4) is required |
| `preinst` | unlinks the 104 zoneinfo paths, so `tar` cannot write a new file through an old hard link into its sibling |
| `postinst` | 9 file removals, 2 `rmdir`, then removes the package's own `.control`/`.list`/`.preinst`/`.postinst` |

**What the measurement changes in this plan:**

1. **The delta is fourteen times §2.1's "about 93 files".** Half the bytes are the
   SmartKey engine and its dictionaries (about 28 MB). Also absent from §2.1's
   table: `LunaSysMgr` itself, the colour emoji set, the mail work, the CA bundle
   (and the GoDaddy Class 2 certificate's removal), the launcher layout files,
   `luna.conf`, `preware-seed.sh`, and a changed staged Clock ipk.
2. **The armed flash is required, not just chosen (§2.3).** The payload replaces
   `/usr/bin/LunaSysMgr`, `/usr/bin/SmartKeyService` and `/usr/lib/libWebKitLuna.so`.
3. **The cryptofs work list is generated too.** Five staged ipks changed, and an
   installed device never reinstalls them. The tool compares each from the inside
   (`staged_ipks` in `delta.json`, with the old and new md5 of every file). That
   list can replace the hand-written file lists of §2.2 steps 1, 8, 9, 11 and 12:

   | App (under `/media/cryptofs/apps`) | Added | Changed | Removed |
   |---|---|---|---|
   | Calendar | 11 | 23 (and 164 files' modes) | 29 (test and build files) |
   | Photos, with `org.webosarchive.photos.service` | 16 | 12 | 36 (test and build files) |
   | Email | 0 | 20 | 0 |
   | Music | 0 | 21 | 0 |
   | Clock | 0 | 9 (`appinfo.json` only: the vendor name) | 0 |

   Clock is not in §2.2 at all. Its vendor name decides whether LunaCE treats it
   as a platform app, so check what an installed Clock with the old name does on
   the new LunaSysMgr before deciding it can be skipped.
4. **How `mmipkg` installs** (read in 600070's rootfs): control files are
   unpacked to `/usr/lib/ipkg/info/<pkg>.*`, then `preinst`, then
   `tar -C /rootfs -xvzf` whose output becomes `<pkg>.list`, then `postinst`, and
   last `generate_status` rewrites `/usr/lib/ipkg/status` from every `*.control`.
   The image's own `status` has that same form (666 stanzas for 666 control
   files), so once `postinst` has removed the package's records the regenerated
   file should equal a flashed image's. To be seen on the bench.
5. **The §2.2 (3) trap is in 600107.** `ce-register-video-handler` and
   `ce-register-ipk-handler` start only on `first-use-finished`. Both scripts log
   "will retry next boot" on failure and never do. Decided 2026-11-20 (decision 4,
   §4): both also start on `stopped finish`, from the next bake (2fd151f).
6. **Not yet decided for a device that arrives by OTA:** the new default launcher
   layout (a device keeps its saved layout, so new apps land where LunaSysMgr
   puts them), SmartKey's learned words from XT9, and the 28.jpg wallpaper
   (§2.1).
7. **The target is not 600107 itself.** `ce-ota-finish` has to be in the image the
   payload delivers, so the first real target is the bake that contains it.
8. **AT&T:** no 3.2.0 AT&T image exists yet. Its payload needs one, diffed
   against 600071.

**A flashed device is not the rootfs tar** (read-only check of the test TouchPad,
600105, against its own image with `build/ota/device-check.py`, two minutes over
novacom, nothing written):

- The check found the two files that TouchPad carries by hand (`LunaSysMgr`,
  `luna.conf`) and no other changed file except `/usr/lib/ipkg/status`. So it
  can tell a drifted device from a clean one.
- The Doctor installs `hp.tar`'s four customization ipks on top of the rootfs
  (`audiod-config-eu`, `crotest-images`, `palmcustomizationinfo-hp`,
  `sweatshop-hp-topaz`): 670 control files against the tar's 666, about 105
  files the tar does not have, and a `status` regenerated to match. `hp.tar` is
  byte-identical in 600070, 600105 and 600107, so the rootfs diff is still the
  right payload. `mmipkg` will regenerate `status` with those four in it, which
  is what a flashed device has.
- `ce-reclaim-customization-media` has removed the staged wallpapers and
  ringtones (18 files). The payload adds `28.jpg` beside them, where the reclaim
  job, already flagged done, will leave it: 148 KB that a flashed device does
  not keep. `ce-ota-finish` should copy it to `/media/internal/wallpapers` and
  remove it, or the job's flag should be cleared.
- About 290 directories exist that no tar names. Expected: `tar` makes them.
- **The payload has two paths under `/var`**, which is its own volume:
  `/var/imwrap.sh` (changed) and `/var/luna/preferences/used-first-card`
  (added). Whether the update ramdisk has the var volume mounted under
  `/rootfs/var` is not known. If not, they land on the root volume, hidden
  under the mount, and `ce-ota-finish` has to place them. A0 must look.
- So the convergence test (§1.3) compares an OTA'd device with a **flashed
  device's listing**, not with the tar alone. `device-check.py` saves the
  listing (`device.json`); comparing two listings is the piece still to write.

**Checked and cleared:** 600107's rootfs tar names 104 zoneinfo paths twice,
first as the stock hard link and then as the new file. On the flashed TouchPad
the Doctor's `tar` replaced each link instead of writing through it
(`America/Los_Angeles` has the 2026f bytes and one link; `US/Pacific-New` kept
its own). `US/Pacific-New` and `Canada/East-Saskatchewan` are 2011 files that
2026f no longer has, and they stay in the image.

**The trail from here**, in order:

1. ~~Generator, with the convergence check on paper.~~ Done.
2. ~~Unpack the payload over an extracted 600070 rootfs with a real `tar` and
   compare with 600107.~~ Done, with the limits above.
3. ~~A read-only device check.~~ `build/ota/device-check.py IMAGE` is written
   and was run once (above). Still to do: compare two device listings, for the
   convergence test; and run it on a 3.1.0 device against 600070, which is the
   pre-flight of §2.4 and shows what a device in the field differs in.
4. ~~`ce-ota-finish`.~~ Written (§2.2), not baked. Next: a bake that contains
   it (with App Catalog 6.3.3000 and Preware 1.9.22), which becomes the target;
   then the payload for that mark, applied to a clean 3.1.0 device.
5. A0, the bench rehearsal of the armed flash with a trivial payload (§2.3).
6. A1 to A3 as in §2.3. Signing and the manifest belong to the OTA repo.

### 2.0a First run on a device: 600070 → 600109, by hand (2026-11-20)

A freshly flashed 600070 TouchPad. Pre-flight with `device-check.py`: no file
differed from the 600070 image except `status`, and the md5 of
`org.webosarchive.ce-files.md5sums` matched the payload's manifest inputs. The
payload was copied to `/media/internal`, and applied on the running system: `/`
remounted read-write, `preinst`, `tar -C / -xvzf` of the data, `postinst`,
reboot. This tests the payload and `ce-ota-finish`. **It does not test the
update ramdisk, `mmipkg` or `PmUpdater`.** 600108 was baked first and never
left the build machine; 600109 is 600108 with the first two fixes below.

**Worked:**

- After the payload the device differed from the 600109 image only as a flashed
  device does: the customization layer, `status`, and directories no tar names.
  No missing, changed or wrong-type file.
- First boot: no crash report. `ce-register-video-handler` ran at boot and
  registered (the new trigger). The stock preload pass installed Preware 1.9.22
  from the renamed staged ipk by itself.
- `ce-ota-finish` reinstalled Clock, Email, Calendar, Music and Photos through
  `app-install` and verified each against its ipk; removed the stock Calculator
  1.0.0 from cryptofs and set its status entry to 3.2.0; added the Videos
  status entry; copied `28.jpg`; flagged itself. About two minutes of work.
- The boot logo is in NVRAM (found at offset 24576) and all 28 tokens are
  unchanged.
- Second boot: `/` read-only, the job exits at its flag, the reclaim job
  removed the staged wallpaper, no crash report.

**Found, and fixed in the tree (after 600109, not baked):**

- Read from the device before anything was written, and fixed in 600109: the
  battery gauge is `/sys/devices/i2c-3/3-0031/getpercent`; the device's
  `ipkg compare_versions` exits 1 for true.
- `tokens --list` gives the same tokens in the opposite order after
  `trenchcoat`, so the job's byte comparison called a good write unverified and
  kept its NVRAM backup. It now compares them sorted.
- Looking for the logo byte by byte in node took three and a half minutes. It
  now tries only 4 KB boundaries, with `dd` and `cmp`.
- The device's `tar` warns about a zero time stamp on the control files (exit
  status 0). They now carry a fixed date.

**Open:**

1. **`/boot` is its own partition, mounted read-only.** `tar` could not replace
   `/boot/boot-images.tar.gz` and exited 2. Under `mmipkg` a failing data tar
   aborts the whole update. The file was placed by hand with `/boot` remounted.
   What the ramdisk does with `/boot` (`ota.sh`, `post-update`) decides this,
   and must be seen in A0. If `/boot` is not writable there, the payload must
   leave `/boot` out and `ce-ota-finish` must place the file.
2. **Photos' new service is not on the bus.** The files are installed, but
   `org.webosarchive.photos.service` has no registration in `/var/palm/ls2`:
   "Service does not exist", also after a reboot, `forceSingleAppScan` and
   `rescan`. `app-install` installs with plain `ipkg`; the registration is
   written only when LunaSysMgr's own installer (`com.palm.appinstaller`) does
   the install. **Fixed in the tree, tried on the device:** installing the
   staged Photos ipk through `com.palm.appinstaller/installNoVerify` put the
   service on the bus at once. `ce-ota-finish` now installs that way (the
   installer deletes the file it is given, so it gets a copy), and the changed
   script repaired a deliberately altered Clock on the device in 12 seconds.
   Not baked. **Still to check on a flashed 3.2.0 device:** whether its
   first-boot install registers the service, since the stock preload pass is
   the same `app-install`.
3. `/` was mounted read-write for the whole first boot and read-only on the
   second. Not this job (its lock was never taken). The Preware 1.9.22 install
   ran in that boot and its scripts remount `/`; not confirmed as the cause.
4. `/` is at 84% after the update. Compare with a flashed 600109.
5. Not looked at on the screen yet: the launcher, the keyboard, Email, the
   boot logo itself.
6. **LunaSysMgr crashed once on the updated device** (08:01, second boot, about
   13 minutes up, when the user minimized the first card: Device Info). The
   stack is `MinimizeState::onEntry` → `CardWindowManager::markFirstCardDone`
   → `fclose(NULL)`: LunaCE opens `/var/luna/preferences/used-first-card` for
   writing and closes it without checking the result. The first-card alert had
   fired, so at its start LunaSysMgr had not seen the marker either, although
   the payload had put it there at 07:38, root-owned and writable, and the same
   open works from a root shell. Why LunaSysMgr could neither see nor open it
   is **not known**. Two minutes earlier the changed `ce-ota-finish` had
   reinstalled Clock through the installer in that LunaSysMgr; no link is
   shown. The missing check is a LunaCE bug whatever the cause
   (`Src/lunaui/cards/CardWindowManager.cpp:1306`). The report is kept in
   `out/ota/device-600109-applied/lunasysmgr-minicore.txt`. Watch for it on
   the 600110 run: minimize a card on the first boot after the update.

### 2.0b Second run: 600070 → 600110 on a second TouchPad (2026-11-20)

Same procedure, with `/boot` remounted read-write beside `/`. A clean run end to
end:

- Pre-flight as on the first device. Every step of the apply exited 0, with no
  `tar` warning. After it, the device differed from the 600110 image only as a
  flashed device does (110 more directories no tar names, nothing else).
- First boot: `ce-ota-finish` wrote the boot logo to NVRAM and **verified it**
  ("tokens unchanged", battery 93%) within the first minute, then placed one
  seed file, reinstalled Clock, Email, Music, Calendar and Photos through the
  installer ("SUCCESS", each verified), removed the stock Calculator, copied
  the wallpaper and flagged itself: 70 seconds from its first line to its last.
  No NVRAM backup left behind.
- `org.webosarchive.photos.service` answers on the public bus.
- The video handler registered at boot. Preware is 1.9.22. No new crash report
  (the one on the device is 3.1.0's first-use LunaSysMgr at exit, from before
  the update).

**`/` read-write on the first boot (§2.0a open item 3) is Preware's own
install script:** `control/postinst` line 9 runs `mount -o remount,rw /` and
never remounts it. The stock preload pass installed Preware 1.9.22 at 35
seconds into the boot. A flash installs Preware the same way, so this is not
the update's doing, and the next boot is read-only again. Whether CE should
remount after that install is a separate question.

**`/boot` and `/var` in the ramdisk: answered by reading `ota.sh`** (stock,
`/usr/share/ota-scripts/ota.sh` lines 238 to 252, the same file in 600070).
Before it calls `PmUpdater` it mounts, all read-write: `store-root` on
`/rootfs`, the boot partition on `/rootfs/boot`, `store-var` on `/rootfs/var`,
`store-log`, `store-update` on `/rootfs/var/lib/update` and `store-media` on
`/rootfs/media/internal`; `/dev`, `/proc`, `/sys` and `/tmp` are bound in.
So the payload's `/boot/boot-images.tar.gz` and its two `/var` paths land where
they belong, and the `tar` failure of the first run belongs to the by-hand
procedure only (a running device has `/boot` read-only). No change to the
payload. `/media/cryptofs` is not mounted there, as §1.2 assumed. The branch of
`post-update` that re-makes `/var` runs only when `/dev/store/filecache` does
not exist, which is never on a TouchPad. A0 still has to see all of this
happen.

Still open from §2.0a: the first-card crash (6), which this run has not yet been asked to repeat: nobody has minimized
a card on this device. LunaCE `045427d` checks the failed open and logs its
errno; it is in 600111, with SmartKey's new ranking. 600111's payload is built
(`out/ota/600070-600111/`) and has not run.

### 2.0c Third run: 600070 → 600111, and two races in the app step (2026-11-20)

The first TouchPad again, re-flashed to 600070. Pre-flight, apply and the
comparison with the 600111 image were clean, and the logo was written and
verified. `ce-ota-finish` then reinstalled Clock, Music and Calendar, and **got
nothing from the installer for Email and Photos**. It did what it is meant to:
no flag, "will try next boot". Both failures were the job's own, and the same
code had passed all five on the second run by luck of timing:

1. **One file name for every install.** LunaSysMgr deletes the ipk it was given
   about a second after it reports SUCCESS (three seconds for Photos, after its
   size scan). The job had copied the next app's ipk to that same name by then,
   and the installer deleted it. Each install now has a file of its own, and
   the job waits until the installer has removed it.
2. **One reply file for every install.** The wait loop looked at the reply file
   before the new `luna-send` had emptied it, saw the previous install's
   SUCCESS, and killed the request before it was sent. Each install now has a
   reply file of its own, removed first, and the loop sleeps before it looks.

With both fixed, the script was run on the device against all five apps made
to differ again: five installs back to back, each "SUCCESS" and verified,
Photos' service on the bus, flagged. **Fixed in the tree after 600111, not
baked.**

Also on that device: one crash report, `org.webosinternals.ipkgservice`
SIGABRT at the reboot that ended the apply (Preware's service, killed at
shutdown). No LunaSysMgr crash; nobody has minimized a card there yet.

### 2.0d Fourth run: 600070 → 600112, clean (2026-11-20)

The second TouchPad, re-flashed to 600070. 600112 is 600111 with the two races
of §2.0c fixed. Pre-flight clean; every step of the apply exited 0; afterwards
only directories no tar names were new against the image. First boot: logo
written and verified; one seed file placed; Music, Photos, Email, Clock and
Calendar each "SUCCESS" and verified, back to back; Calculator's stock copy
removed; flagged, 70 seconds from first line to last. Photos' service answers
on the bus, the video handler registered, Preware is 1.9.22, and there is no
crash report at all on the device.

On the 600111 device (§2.0c) the user opened a card and swiped it away: no
crash. The first-card crash of §2.0a has not been seen again; its cause is
still not known, and 600111 onward logs the errno if that open fails.

### 2.0e Fifth run: the same 600112 payload on the other TouchPad, clean (2026-11-20)

The identical ipk (sha256 `3ef1f512…`) on the first TouchPad, re-flashed to
600070. Same result as §2.0d in every line: pre-flight clean, every step exit
0, only unnamed directories new against the image, logo written and verified
(battery 83%), Clock, Music, Calendar, Photos and Email each "SUCCESS" and
verified in a different order from §2.0d, flagged after 79 seconds, Photos'
service on the bus, no crash report. Two clean runs of one payload on two
devices.

This device carried one file no image has, `/etc/udev/rules.d/99-cmdrkeen-pad.rules`
(an app the owner installed on 3.1.0 wrote it). The pre-flight lists it as
extra, the payload leaves it alone, and it is still there afterwards: the
first sight of an owner's own change to `/` passing through an update.

### 2.1 The delta as planned (600070 → 600075, from the tracked overlays; superseded by §2.0's measurement)

| Change | Paths | Notes |
|---|---|---|
| Videos app (new) | `/usr/palm/applications/com.palm.app.videos/`, `/usr/palm/packages/com.palm.app.videos/` | rootfs app |
| Player hosted under the stock id | `/usr/palm/applications/com.palm.app.videoplayer/{index.html,appinfo.json,depends.js,source/,css/,images/}` | overwrites stock files |
| Video handler job (new) | `/etc/event.d/ce-register-video-handler` + `/usr/palm/ce-seed/jobs/…sh` | see trap below |
| Media TLS | **add** `/usr/lib/gstreamer-0.10/libgstcurlhttpsrc.so`, **remove** `libgstsouphttpsrc.so` | |
| Calculator 3.2.0 | `/usr/palm/applications/com.palm.app.calculator/`, `/usr/palm/packages/com.palm.calculator/`; **remove** `/usr/palm/ipkgs/com.palm.app.calculator/` | |
| Contacts 3.2.0 (600074, Import vCards added after) | `/usr/palm/applications/com.palm.app.contacts/{app/FirstUse.js,app/ContactsApp.js,app/utils/VCardParser.js,app/utils/VCardBatchImport.js,depends.js,appinfo.json}`; **remove** `tests/`, `jasminerunner.html`, `jrgenerator.sh` (3.1.0 shipped the community test files; 3.2.0 ships no test code) | already a rootfs app on 3.1.0 (the community build), and rootfs wins over a cryptofs install, so a feed ipk has no effect; source `apps/com.palm.app.contacts`. Import vCards writes photos through `org.webosarchive.photos.service`, so it needs that service's `remove` command and Contacts caller: **the service lives in cryptofs**, so an OTA must update it in `ce-ota-finish`, or imported contacts arrive without photos (the import says so and carries on) |
| Calendar 3.2.0 (600074) | the staged `/usr/palm/ipkgs/com.palm.app.calendar/…3.0.11007_all.ipk` is repacked | **no effect on an installed device**: Calendar lives in cryptofs, and the staged ipk keeps its 3.0.11007 filename. See §2.2 |
| Account templates (600074) | `/usr/palm/public/accounts/com.palm.{palmprofile,facebook,linkedin}/**/*.json` (24 files) | "webOS Account"; Facebook without CALENDAR/CONTACTS; LinkedIn hidden. The accounts service caches templates until it restarts |
| Accounts library strings (600074) | `/usr/palm/frameworks/enyo/0.10/framework/lib/accounts/resources/{de,en,en_ca,es,fr,it}.json` | "Get started with your webOS account:" |
| Contacts framework AppPrefs (600075) | `/usr/palm/frameworks/contacts/submission/{114contacts.js,114/concatenated.js,114/javascript/AppPrefs.js}`, `/usr/palm/frameworks/mojo/builtins/palmcontactsVersion1_0.js` | one prefs record instead of two; existing duplicates heal on the next Contacts launch, so the OTA needs no data step |
| Calendar framework (after 600077) | `/usr/palm/frameworks/calendar/submission/{42calendar.js,42/concatenated.js,42/javascript/{event-manager,rrule-manager,timezone-manager}.js}` | repeat expansion rewrite and southern daylight time; every repeat depends on it, so it travels with the Calendar 3.2.0 tree |
| Time zone data (after 600077) | `/usr/share/zoneinfo/**` from `zoneinfo-2026f.tgz`, `/etc/palm/timezone.txt`, `/usr/palm/ext-timezones.json` | tzdata 2026f, compiled with `zic -b fat`. Refresh before each release with `tools/tzdata/build-zoneinfo.sh`. A Luna restart picks it up |
| USB connection (after 600077) | `/usr/lib/luna/system/luna-systemui/data/StoragedService.js` | banner and dashboard replace the popup |
| Boot logo (d6c4c78, not yet baked) | `/usr/palm/sysmgr/images/{hp-logo,hp-logo-bright}.png`, `/boot/boot-images.tar.gz` | the moon replaces the HP badge. The two PNGs are the pulsing logo and need nothing more. The still logo bootie draws first is in NVRAM, which a rootfs diff cannot reach: see §2.2 (10) |
| HP wording (`hp_wording.py`, not yet baked) | `/etc/prefs/properties/{deviceName,deviceNameBranded}`; string tables and a few `.js` files in Accounts, Software Manager, the system UI, `accounts.ui` and the accounts library; Messaging's `FirstLaunchConstants.js`; Contacts' `ContactCountDialog.js`; the staged Email and Music ipks | "HP TouchPad" becomes "webOS TouchPad", "HP" dropped elsewhere; also "webOS Archive" as the vendor in about 170 `appinfo.json`/`packageinfo.json`/manifest files, www.webosarchive.org for the dead hpwebos.com/support, and Help's Care Pack check removed (`HelpApp.js`). The rootfs files need nothing more. **Email and Music live in cryptofs**, so an installed device keeps the old text: see §2.2 (11). A device's own name is stored when it is set up, so the new default only shows on a fresh flash |
| Default wallpaper (not yet baked) | **add** `/usr/lib/luna/customization/copy_binaries/media/internal/wallpapers/28.jpg`; `ce-firstboot-tweaks` and `ce-default-wallpaper` name `28.jpg` | the moon replaces `22.jpg` as the default. Both jobs are flag-done on a 3.1.0 device and the customization copy runs once per flash, so an OTA neither delivers the file to `/media/internal` nor changes anyone's wallpaper. If 3.2.0 should offer it, `ce-ota-finish` copies the file into `/media/internal/wallpapers/`; it should not switch a wallpaper the owner is already using |
| Emoji fallback font (planned, `EMOJI-FONT.md`) | **add** `/usr/share/fonts/CE-Emoji.ttf` (+ OFL text), **patched** `/usr/lib/libWebKitLuna.so` (fifth fallback slot) | lib is held open by BrowserServer/WebAppMgr — fine in the ramdisk, a reason not to hotpatch |
| Colour emoji images (planned, `EMOJI-FONT.md` §7) | **add** `/usr/palm/frameworks/ce-emoji/` (shared `emoji.js` + EmojiOne PNGs, ~10.5 MB); **changed** Messaging (images move out of its app dir), Email, Contacts | Email is a cryptofs app: its patch goes in `ce-ota-finish`, not the rootfs diff |
| Photos hand-off | the staged `/usr/palm/ipkgs/com.palm.app.photos/…ipk` is repacked | **no effect on an installed device**: Photos already lives in cryptofs |
| Tweaks definition | under `/usr/palm/ce-seed/cryptofs/…` | the seed only runs once per flash |
| Version | `/etc/palm-build-info`, `/etc/prefs/properties/{buildMark,buildDate}` | |
| First-boot jobs | `ce-firstboot-tweaks`, `ce-default-wallpaper`, `ce-remove-preloads` (AT&T wallpaper fix, de-shadow list) | already flag-done on a 3.1.0 device, so this is just file content |
| ipkg db | the `.list`/`.md5sums` rewrites | |

**About 93 files and 4 removals** as of 600073; 600074–600075 add about 37
more files (Contacts, the account templates and strings, the contacts
framework), plus the emoji font and the patched
`libWebKitLuna.so` once `EMOJI-FONT.md` lands. Before the emoji work, nothing
replaced was held open by a long-lived process. The patched `libWebKitLuna.so`
is held open by BrowserServer and WebAppMgr: one more reason Path A takes the
armed flash.

### 2.2 What `ce-ota-finish` must do for 3.2.0

**Written 2026-11-20, not baked, never run on a device:**
`build/full-ce/ce-ota/ce-ota-finish.sh`, installed by `bake.py` as
`/usr/share/ce-ota/ce-ota-finish.sh` with the job `/etc/event.d/ce-ota-finish`
(`start on stopped finish`). It was run on the build machine against a fake
device tree with stand-ins for `app-install`, `luna-send`, `ipkg` and `mount`
(update, repeat run, flashed device). How it differs from the list below:

- **It knows no version.** It compares the image it runs in with
  `/usr/share/ce-ota/finish/from-*.list`: the md5 of every staged ipk and every
  cryptofs seed file of each image a device can come from (600070 and 600071,
  made by `make-payload.py finish-list`). So the same script serves later
  releases; a new origin is a new list.
- **A flashed device does nothing.** With no `ran-first-use` at boot, the job
  writes both flags and exits.
- **Steps 1, 8, 9, 11 and 12, and Clock:** a staged ipk whose bytes changed
  under the same file name is reinstalled through
  `com.palm.appinstaller/installNoVerify` (at first with the stock
  `app-install`, which registers no services: §2.0a), and then checked file by
  file against the ipk. It
  is left alone when the app is not installed or is at another version (the
  feed's Calendar 3.2.0, for one). This replaces laying files over the app, so
  removed files go too. **To see on a device:** that the reinstall registers
  Photos' new service on the bus, and what it does to an Email that is
  running. An app already running keeps its old code until Luna restarts; the
  job says so in its log and does not restart Luna.
- **Step 2 and the rest of the seed** (48 files: the Synergy runtime, the
  Tweaks files): placed when new, replaced when the device still has what an
  older image seeded, left when the owner changed or removed them.
- **Step 3:** not in this job. Both handler jobs now start at boot (2fd151f).
- **Steps 4 and 5:** done for Videos, Calculator and Media TLS, only for a feed
  copy at this image's version or older. Needs a device that installed the
  feed versions to test.
- **Step 6:** done. **Step 7:** not done (see the running-app note above).
- **Step 10:** done as specified, with one addition: before writing, it looks
  for this image's `BootLogo.tga` in NVRAM and flags without writing when it
  is there. The battery level is read from sysfs by guessed paths; if none
  reads, the logo is not written and the log says so.
- **The wallpaper (§2.0):** staged media missing from `/media/internal` is
  copied, and the reclaim job's flag is cleared so it removes the staged copy
  on the next boot.
- **Not handled:** the two payload paths under `/var` (§2.0), until the bench
  shows where the ramdisk puts them. A staged ipk with a new file name (Preware
  1.9.22) is left to the stock preload pass; whether that pass runs on an
  ordinary boot is to be seen on the device.

The steps as planned on 2026-10-04:

The rootfs diff can't express these:

1. **Photos hand-off.** Apply `AlbumGridView-videos-handoff.js.patch` to the
   *installed* Photos in `/media/cryptofs/apps/…/com.palm.app.photos/`, md5-guarded,
   using the logic of the Videos feed postinst's stage that already does this.
2. **Tweaks JSON.** Copy it into the cryptofs tweaks prefs dir, as the feed
   postinst does.
3. **Video handlers. Trap found while planning:** `ce-register-video-handler`
   starts only on `first-use-finished`, which is emitted once, when OOBE completes.
   A device that arrives at 3.2.0 by OTA never emits it, so the job would never
   run. Either `ce-ota-finish` starts it explicitly, or the job gains a
   `start on stopped finish` trigger like `ce-default-wallpaper`. The second also
   heals any device where the first try failed. **Audit every first-boot job for
   this**, not just this one.
4. **Reconcile Preware installs.** Some 3.1.0 devices already run the feed
   versions of Videos 3.2.0, Media TLS 1.0.0 or Calculator 3.2.0 from cryptofs.
   - Videos/Media TLS postinsts have already changed the rootfs. The OTA
     overwrites those paths with the same content. Their `.webosce-orig` backups
     then hold the *stock* files, and a later Preware removal would "restore"
     stock over the baked CE files. Remove those backups.
   - The cryptofs app dirs: Calculator and Videos at the same version as the baked
     copy is a tie for the launcher. Remove them, which is what the de-shadow pass
     does on a flash.
   - The cryptofs ipkg status: replace the stanzas with the seeded "baked"
     stanzas that `preware-seed.sh` writes on a flash.
5. **Calculator 1.0.0 leftover.** The stock copy in cryptofs is outranked by the
   baked 3.2.0, but it is dead weight. Remove it in the same de-shadow pass.
6. **GStreamer registry.** Drop `/var/home/*/.gstreamer-0.10/registry.*.bin`. On a
   lived-in device it caches the old souphttpsrc. The Media TLS postinst documents
   that leaving it makes *no* souphttpsrc load.
7. A Luna restart, or the reboot the armed flash already does, so cached Enyo
   app code reloads. The contacts framework's Mojo builtin and the account
   templates (cached by `com.palm.service.accounts`) need the same.
8. **Calendar 3.2.0.** Calendar is a cryptofs preload, and the image changes
   only the staged ipk, keeping its 3.0.11007 filename so `app-install` does
   not reinstall it every boot. So an installed device keeps the stock
   Calendar. `ce-ota-finish` must lay the 3.2.0 app tree over
   `/media/cryptofs/apps/usr/palm/applications/com.palm.app.calendar/` (the
   tree in `apps/com.palm.app.calendar`, as in its feed ipk). Same shape as the
   Photos hand-off (1). A healthy **reflash** is not affected: the Doctor wipes
   cryptofs, so first boot installs the staged ipk, which carries 3.2.0. Only a
   failed wipe (KNOWN-ISSUES #10) would leave the stock copy in place.
9. **Photos service for Import vCards.** Contacts writes imported photos through
   `org.webosarchive.photos.service`, which lives in cryptofs. Lay
   `apps/org.webosarchive.photos.service/{service.js,services.json}` over
   `/media/cryptofs/apps/usr/palm/services/org.webosarchive.photos.service/` and
   stop the running service. Without this, an installed device imports contacts
   without their photos, and the import's summary counts them.
10. **Boot logo in NVRAM.** bootie draws its still logo from the NVRAM section
    `logo-boot`, which only the Doctor writes. The rootfs diff delivers the new
    `/boot/boot-images.tar.gz`; `ce-ota-finish` writes it to NVRAM the way the
    stock `bootie-images` postinst does:

    ```sh
    mkdir -p /tmp/boot-images && cd /tmp/boot-images
    tar zxf /boot/boot-images.tar.gz
    /sbin/trenchcoat --config=/boot/image-update.xml
    ```

    `image-update.xml` reuses the partitions and rewrites only the NVRAM entry,
    with `env` and `tokens` marked `recover="true"`. Done by hand on a 3.2.0
    TouchPad on 2026-11-16: the token and env strings were unchanged afterwards
    and bootie drew the new logo.

    - **Why here and not the ramdisk postinst** (where HP ran it): this is the
      path tried on hardware, a failure cannot abort the update, and it keeps
      the NVRAM write apart from the armed flash. The cost is one boot. The
      reboot that ends the OTA still shows the HP badge as the still frame, and
      the moon takes over from the boot after.
    - **Save NVRAM first.** trenchcoat rewrites the whole 4 MB partition,
      device tokens included, so a power cut mid-write is the hazard. Copy
      `/dev/mmcblk0p12` to `/var` before the write and keep it until the job's
      flag is set. Skip the write on low battery.
    - **Its own flag, tried every boot.** This step has a flag of its own,
      set only after the verify below. A skip or a failure leaves it unset,
      and the job starts on every boot (`start on stopped finish`, like
      `ce-default-wallpaper`), so it tries again on the next boot with
      enough charge. A low battery must not hold back the other steps, nor
      make them run twice.
    - **Verify, then flag.** trenchcoat must exit 0 and `tokens --list` must
      still list the tokens. To know the logo landed, look for the new
      `BootLogo.tga`'s bytes in the partition: trenchcoat stores it whole, and
      its offset moves with the layout (24576 after this path, 32768 after a
      Doctor flash), so search for it and do not read a fixed offset.
    - Only `BootLogo.tga` differs from stock. The other nine images are
      rewritten with the same content.
    - A reflash needs none of this: the Doctor writes the image's
      `BootLogo.tga` to NVRAM itself.
11. **HP wording in Email and Music.** Both are cryptofs preloads, changed in
    the image only inside their staged ipks (which keep their stock
    filenames, so `app-install` does not reinstall them). `ce-ota-finish`
    lays the changed files over the installed apps, md5-guarded like the
    Photos hand-off (1): Email's `data/AccountPreferences.js` and
    `resources/{de,es,fr,it}.json`; Music's four `source/listView*.js` and
    `resources/{de,es,fr,it}.json`. Email stores each account's signature
    when the account is created, so existing accounts keep "HP TouchPad";
    only new accounts get the new default. Leave stored signatures alone.
    (With step 12's Email, a stored signature that is the one Email shipped
    with is no longer used: such an account shows and sends the current
    default. The stored record is still not touched.)
12. **Email's phase 4 changes and the mail pieces around it.** Email is a
    cryptofs preload, so the same rule as (11): `ce-ota-finish` lays
    `mail/source/settings/MasterSettings.js`,
    `mail/source/settings/AccountSettings.js`, `data/AccountPreferences.js`,
    `compose/source/Compose.js` and `css/compose.css` from the image's staged
    Email ipk over the installed app, md5-guarded. Everything else the mail
    work adds is rootfs and comes with the diff: `libce-mailshim.so` and the
    three changed `.service` lines, `com.palm.service.oauth` with its roles
    and launchers, `com.palm.app.signin`, the `com.palm.oauth.*` account
    types, and the accounts and addressing library files. Two cautions: the
    shim must be replaced by rename, never copied over (a running mail
    service that has it mapped crashes at exit), and the mail services and
    LunaSysMgr have to be restarted to pick the new files up, which the
    flash's reboot does.

### 2.3 Delivery tier: armed flash, on purpose

Path A *could* go as a hotpatch: everything above can be replaced on a running
system. **Recommendation: ship it through the armed flash anyway**, because the
point of Path A is to learn the mechanism Path B can't avoid (LunaSysMgr and the
kernel are held open, so B needs the ramdisk).

A benign payload does **not** make the flash safe. It bounds the damage of a
failed *apply*, not of a broken *flash*. So:

- **A0 — bench rehearsal.** Armed flash on a bench device with a trivial payload
  (one file into `/usr/share/`).
  - Learn and record: `updatefsinfo` values, ordering, what `pre-update` and
    `post-update` touch, what `/media/cryptofs` looks like in the ramdisk, timing,
    and the recovery recipe (`OTA-UPDATE-GUIDE.md:529-543`).
  - **This closes open item #4.**
- **A1 — generator + finish job.** `make-payload.py` and `ce-ota-finish`; on the
  bench, apply the payload by hand (novacom, ramdisk path).
  - Run the convergence test (§1.3) against a 600073 flash.
- **A2 — signed end to end.** Real manifest, signed offline, served with
  `target_build` binding, installed through OTA Ready v2 on a bench device.
- **A3 — dev devices, then opt-in users.** The offer goes to `webOS CE 3.1.0`
  (600070 Wi-Fi, 600071 AT&T) only.

**Per variant.** The AT&T and Wi-Fi overlays differ (customization payload). Build
one payload per variant from its own old/new rootfs pair, and bind each manifest
to its BUILDMARK.

### 2.4 Risks specific to A

- `post-update` restores `/boot/uImage → uImage-2.6.35-palm-tenderloin`. On CE that
  filename **is** UberKernel (md5 `f120c02c…`, not stock), so the restore is
  harmless. That is inferred, not seen, and A0 must confirm it.
- A device that has since installed a *different* kernel through Preware is
  reported as `HAZARD` and must stay refused (M3).
- The md5sum rewrite in the diff is only correct if the device's rootfs really is
  600070/600071. **Pre-flight:** check the device's `org.webosarchive.ce-files.md5sums`
  matches the expected old image, and refuse on drift.

---

## 3. Path B — stock 3.0.5 → CE

### 3.1 What changes compared with A

| | A | B |
|---|---|---|
| Starting state | one image we built | stock plus whatever the owner added (fingerprint baselines A–H) |
| Size | ~93 files | ~4,900 files, 960 removals, ~118 MB |
| Held-open files | none | LunaSysMgr, libraries, the kernel → **ramdisk required** |
| Trust anchor on device | baked | arrives with OTA Ready (Preware: unauthenticated first step) |
| Transport | modern HTTPS | stock OpenSSL 0.9.8k, but signed payloads are fine over plain HTTP |
| Read-only root | yes | no (3.0.5 is rw). The ramdisk doesn't care |

**Simplification of the old plan:** `OTA-STRATEGY.md` §2 chained two sessions
(TLS upgrade over legacy transport, then the CE payload over HTTPS). With
signature-based integrity (OTA-3.1.0 Part II), the manifest and payload can travel
over **plain HTTP**. That leaves **one session**. Only the small offer request
needs TLS, and that can fall back to plain HTTP with minimal fields.

### 3.2 The hard problems, each with a proposed answer

1. **Drift from stock.** The diff assumes a pristine 3.0.5 rootfs. Real devices
   carry Preware packages that wrote to `/`: the TLS suite replaces `/usr/bin/curl`,
   plus webos-patches, other launchers and UberKernel.
   **Proposal:** the device already holds stock md5sums for every stock file in
   `/usr/lib/ipkg/info/*.md5sums`. Pre-flight hashes the rootfs against them:
   - Drift in a file the payload overwrites anyway is fine.
   - Drift elsewhere is listed, and the device is refused or offered a
     reconciliation step.
   - Files that no stock package owns are left alone, and logged.
2. **A lived-in cryptofs.** CE's first-boot jobs (`ce-cryptofs-seed`, de-shadow,
   `ce-remove-preloads`, the handler jobs) assume a cryptofs re-initialised by
   OOBE minutes earlier. On an OTA'd device they meet years of user data and the
   owner's own Preware installs of the same apps CE bakes: Preware, Govnah, the
   TLS packages, possibly Videos.
   **Proposal:** audit each job against a lived-in device and make it safe there:
   - De-shadow must not delete user data.
   - Status seeding must merge with real stanzas, not duplicate them.
   - Every job needs a trigger that fires without OOBE (the §2.2 trap, at scale).

   This audit is the largest single piece of Path B.
3. **db8.** CE replaces kinds and permissions in `/etc/palm/db`. On a flashed
   device the configurator loads them on first boot. **Open question:** does it
   re-run after an OTA reboot, or must `ce-ota-finish` re-put the kinds? Test this
   on the bench before anything else in B.
4. **Kernel.** The payload replaces `/boot` kernel files and `/lib/modules` with
   UberKernel under the stock filenames. Owners who installed
   `org.webosinternals.kernels.uber-kernel-touchpad` through Preware are refused
   as `HAZARD` today. For B the fingerprint should accept that exact kernel, and
   the payload should drop the Preware package's ipkg record.
5. **First use already happened.** CE's OOBE swap (the community webOS Account app)
   still installs, but the device skips OOBE. Check that anything CE does only
   during OOBE (account, firstuse flags) has a post-OOBE path.
6. **Space.**
   - Root: CE uses ~440 MB of 559 MB, stock ~393 MB. In-place replacement fits;
     confirm the peak during `mmipkg`.
   - Staging: on `/media/internal`. The OTA must refuse to start if that volume
     lacks ~2× the payload size free.
7. **No undo except a wipe.** The only recovery from a stranded flash is a Doctor
   reflash, which destroys exactly the data B exists to keep.
   **Proposal:** the offer screen requires a confirmed backup first, or at least
   says plainly that a failure means a reflash. Stock 3.0.5 has no working
   backup; woce-backup on 3.0.5 is a possible prerequisite install.
8. **Target version.** Generating from a rootfs diff makes the target a parameter.
   By the time B ships, the current release is 3.2.0. **Recommend 3.0.5 → current
   CE**, not 3.1.0 then a second OTA to 3.2.0.

### 3.3 Milestones

- **B0 — bench drift survey.** Run the pre-flight hash on every device we can
  reach (the eight baselines) and record the drift.
- **B1 — payload + audit.** Generate the 3.0.5→CE diff, write `ce-ota-finish` for
  the lived-in case, and decide items 2–5 above.
- **B2 — bench conversion of a stock-clean device.** Run the convergence test
  against a flash, with user data checked before and after (accounts, contacts,
  messages, apps, media, Preware state).
- **B3 — bench conversion of each drifted baseline.**
- **B4 — opt-in users with a confirmed backup.**

---

## 4. Decisions needed

1. Should Path A use the armed flash (recommended, to learn it) or a hotpatch (no
   reboot, but proves less for B)?
2. Path B target: current CE (3.2.0) or 3.1.0 as originally stated?
3. Where should the payload generator live? Proposed: here (`build/ota/`), since it
   consumes the bake and harness output, while the OTA repo owns the client,
   server and signing.
4. Should `ce-register-video-handler` (and any other `first-use-finished`-only job)
   gain a boot trigger in the image itself? That would fix the OTA case and
   failed-first-try devices without per-release finish logic.

## 5. Found while researching (worth acting on regardless)

- `otaready-app/org.webosarchive.otaready_1.2.0_all.ipk` predates the
  read-only-root restore fix in its own source, and its version wasn't bumped. Its
  `prerm` still remounts rw without restoring ro.
- **The docs contradict each other on the kernel.** `OTA-3.1.0.md:68` and
  `OTA-STRATEGY.md` say CE is stock-kernel / userspace-only, but CE bakes UberKernel
  under the stock filename (`bake.py` tier 12; device `/boot/uImage-…` md5
  `f120c02c…` vs stock 3,341,940 bytes). The fingerprint still reads it as stock
  because the name is unchanged.
