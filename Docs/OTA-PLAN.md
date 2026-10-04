# OTA plan — CE 3.1.0 → 3.2.0, then stock 3.0.5 → CE

**Status: plan, 2026-10-04. Nothing here is built.** The OTA reference stays
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

### 2.1 The delta (600070 → 600073, from the tracked overlays)

| Change | Paths | Notes |
|---|---|---|
| Videos app (new) | `/usr/palm/applications/com.palm.app.videos/`, `/usr/palm/packages/com.palm.app.videos/` | rootfs app |
| Player hosted under the stock id | `/usr/palm/applications/com.palm.app.videoplayer/{index.html,appinfo.json,depends.js,source/,css/,images/}` | overwrites stock files |
| Video handler job (new) | `/etc/event.d/ce-register-video-handler` + `/usr/palm/ce-seed/jobs/…sh` | see trap below |
| Media TLS | **add** `/usr/lib/gstreamer-0.10/libgstcurlhttpsrc.so`, **remove** `libgstsouphttpsrc.so` | |
| Calculator 3.2.0 | `/usr/palm/applications/com.palm.app.calculator/`, `/usr/palm/packages/com.palm.calculator/`; **remove** `/usr/palm/ipkgs/com.palm.app.calculator/` | |
| Emoji fallback font (planned, `EMOJI-FONT.md`) | **add** `/usr/share/fonts/CE-Emoji.ttf` (+ OFL text), **patched** `/usr/lib/libWebKitLuna.so` (fifth fallback slot) | lib is held open by BrowserServer/WebAppMgr — fine in the ramdisk, a reason not to hotpatch |
| Photos hand-off | the staged `/usr/palm/ipkgs/com.palm.app.photos/…ipk` is repacked | **no effect on an installed device**: Photos already lives in cryptofs |
| Tweaks definition | under `/usr/palm/ce-seed/cryptofs/…` | the seed only runs once per flash |
| Version | `/etc/palm-build-info`, `/etc/prefs/properties/{buildMark,buildDate}` | |
| First-boot jobs | `ce-firstboot-tweaks`, `ce-default-wallpaper`, `ce-remove-preloads` (AT&T wallpaper fix, de-shadow list) | already flag-done on a 3.1.0 device, so this is just file content |
| ipkg db | the `.list`/`.md5sums` rewrites | |

**About 93 files and 4 removals**, plus the emoji font and the patched
`libWebKitLuna.so` once `EMOJI-FONT.md` lands. Before the emoji work, nothing
replaced was held open by a long-lived process. The patched `libWebKitLuna.so`
is held open by BrowserServer and WebAppMgr: one more reason Path A takes the
armed flash.

### 2.2 What `ce-ota-finish` must do for 3.2.0

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
   app code reloads.

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
