# webOS Doctor — Community Edition (3.1 CE)

Building a community webOS Doctor and update path for the **HP TouchPad**
(`topaz`, Wi-Fi), starting from the OEM **HP webOS 3.0.5** Doctor and layering in
14 years of community improvements — modern TLS, the LunaCE launcher, Bluetooth
gamepad and USB support, a working App Catalog, modern mail — delivered both as a
**clean-flash Doctor** and as an **over-the-air upgrade** from stock devices.

**Trying it out:** Download the pre-built Doctor .jar from the latest [Release](https://github.com/webOSArchive/webOS-Community-Edition/releases).
Read how to run a Doctor: [docs.webosarchive.org/doctor/#running-the-doctor](https://docs.webosarchive.org/doctor/#running-the-doctor)

## The plan in one paragraph

Repack the OEM Doctor JAR (no recompile) with a modified rootfs branded **"webOS
3.1 Community Edition"**, neutralizing the dead-server flash gate and keeping the
on-device integrity check honest via regenerated md5sums. Ship every improvement
in two forms — baked into the Doctor rootfs, and as signed ipks — so the same
component set can be flashed or delivered OTA. Because we run the update server,
support a one-time **bootstrap OTA** that carries stock OEM 3.0.5 devices up to CE
3.1, then **ongoing OTAs** for CE 3.1 and beyond.

## Documents

| Doc | What it covers |
|-----|----------------|
| **[TEARDOWN.md](TEARDOWN.md)** | Full analysis of the OEM 3.0.5 Doctor JAR: structure, signing, the "TrenchCoat" flash recipe, and the webOS rootfs (security posture, stack, secrets). The starting point. |
| **[SCOPE-3.1-CE.md](SCOPE-3.1-CE.md)** | The CE Doctor build: feasibility (repack + integrity gates), the tiered feature set, branding/identity, size budget, integration risks, assembly recipe, the **locked decisions**, and a phased effort estimate. |
| **[OTA-STRATEGY.md](OTA-STRATEGY.md)** | How devices reach and stay on CE: the **bootstrap OTA** (OEM 3.0.5 → CE 3.1, incl. the TLS chicken-and-egg and the chained two-session upgrade), **ongoing 3.1+ OTAs**, the server-side design, and payload signing. |
| **[RELEASE-NOTES.md](../RELEASE-NOTES.md)** | What ships in the current release candidate, what changed, and the known issues. Start here if you are testing a build. |
| **[KNOWN-ISSUES.md](../KNOWN-ISSUES.md)** | Every issue reproduced but not yet fixed, ordered by what should be solved first: what it costs a user, what is actually known, and what a fix would have to do. |
| **[OTA-PLAN.md](OTA-PLAN.md)** | The two OTA payload plans: CE 3.1.0 → 3.2.0 (learn the armed flash) and stock 3.0.5 → CE. Payloads generated as rootfs diffs. |
| **[EMOJI-FONT.md](EMOJI-FONT.md)** | CE 3.2.0: the 170 BMP emoji via a fifth WebKit fallback font (Noto Emoji subset + a `libWebKitLuna` code-cave patch). Why colour and astral emoji are impossible on this renderer. |
| **[TEST-PLAN.md](TEST-PLAN.md)** | The verification run for the current build: what has been checked, what still needs a human, and how to capture evidence when something misbehaves. |
| **[build/README.md](../build/README.md)** | The **Phase 0 repack harness** (built): unpack → overlay → md5-regen → `integcheck` dry-run → repack + gate-patch. Run `build/build-ce-doctor.sh`. |
| **[4G-TOUCHPAD.md](4G-TOUCHPAD.md)** | What the Wi-Fi image assumes about a device with no cellular radio, and the one place CE behaves differently when one is present. |
| **[ATT-VARIANT.md](../ATT-VARIANT.md)** | The AT&T (`topaz4g`) CE build: how it is derived from HP's AT&T Doctor, what differs from Wi-Fi, and its hardware test result. |
| **[BACKUP-RESTORE.md](../BACKUP-RESTORE.md)** | Moving a woce-backup store between devices, and the stale state that makes a good backup fail with misleading errors. |
| **[GAMEPAD-INPUT-JAIL.md](GAMEPAD-INPUT-JAIL.md)** | Design doc (not built): exposing `/dev/input` to jailed PDK apps OS-wide instead of per-app postinst edits. |
| **[unimplemented-accounts.method.md](unimplemented-accounts.method.md)** | Handover to the account-server project: `getPreferences` is unimplemented server-side. Not a system-image issue. |

## Source projects (siblings)

The CE image and OTA payload are assembled from work in adjacent repos:

| Project | Contributes |
|---------|-------------|
| `OpenSSL-legacyWebOS` | Modern TLS 1.1.1w stack (browser, download mgr, **mail**), env wrappers, `ntpdate-sync`, CA bundle |
| `LunaCE` | LunaSysMgr launcher replacement (app groups, tabs, wave launcher, stability) |
| `webos-hardware-tests` | Bluetooth gamepad shim, USB OTG/power/mass-storage (all userspace) |
| `webos-update-exploration` | OTA mechanism + server, Updates reroute / OTA Ready, fingerprint/baseline model, rdxd fix |
| `AddToImage/` | Every ipk baked into the image (the statement of intent for image contents) — App Catalog, core apps, Synergy, Preware, Govnah, kernel, TLS tiers |

## Locked decisions (see SCOPE §9)

`topaz` Wi-Fi only · modern TLS incl. mail · LunaCE launcher · BT gamepad + USB ·
App Catalog 6.1.2901 · **no** QupZilla · keep the OTA path (bootstrap + ongoing) ·
version string **`webOS CE 3.1.0`** with `BUILDNAME` unchanged · keep `verifyRom` + regenerate md5sums · no on-device
rollback (recover by re-Doctoring) · BT input-jail shipped as-is.

*Mandatory regardless:* patch `checkToFlash=false` (the OEM Doctor's online build
check targets a dead Palm server).

## Status

**Release candidate 2: BUILDMARK 600056** —
`out/webosdoctorp305hstnh-3.1CE-600056.jar`, sha256 `cea207df…`.
600056 differs from 600055 in the backup package alone: the restore-side `tar`
budgets are now sized by archive rather than fixed, which is what dropped the
two largest apps on the 600055 restore. Everything else is byte-identical —
verified by a full rootfs diff of the two JARs (9 files, all accounted for).

**The release gate is met.** A 115-package 3.0.5 → CE restore ran on 600056
with **102 installed, 0 failed**, counts reconciling 115/115, and both
previously-failing games recovered. Service registration for the 11 restored
cryptofs services is written and pending its reboot.
See **[KNOWN-ISSUES.md](../KNOWN-ISSUES.md)** — the first-boot ipkgservice race is
the one to solve before final.
See **[RELEASE-NOTES.md](../RELEASE-NOTES.md)** for what ships,
**[TEST-PLAN.md](TEST-PLAN.md)** for the current verification run, and
**[KNOWN-ISSUES.md](../KNOWN-ISSUES.md)** for everything reproduced but not yet
solved — the first-boot ipkgservice race is the one to fix before final.

The full CE Doctor is built, flash-tested and working on real `topaz` hardware.
Every flash passes the on-device ROM Verifyer
(`integcheck IPKG VERIFICATION SUCCEEDED`), and the current build boots, runs its
OOBE without a reboot, and comes up with the CE launcher, modern HTTPS, Preware
with feeds, and `webOS CE 3.1.0` in Device Info.

**Everything is BAKED.** Every app, patch and file is placed at its final rootfs
path at build time — no staged ipks, no first-boot installs, no postinsts. Each
package's postinst file-effects are replayed on the build host by
`build/full-ce/bake.py`, then the harness regenerates the ipkg md5 database and
integchecks the result. (An earlier design staged the bundled apps as ipks and
relied on their postinsts running on-device; that broke USB Settings, BT gamepad
and Preware, and is gone.)

### What the image contains

Modern TLS for browser/WebKit/download-manager/mail · LunaCE launcher · community
first-use (skippable) · Preware, Govnah, App Catalog 6.1.2901, Maps 4.0.1, USB
Settings, BT gamepad, Synergy Revival runtime · community core apps (Accounts
3.1.1, Contacts, Messaging, Phone) · UberKernel 3.0.5-93 · full Mozilla trust
store · `webOS CE 3.1.0` identity · HP preloads removed. Full detail in
`build/full-ce/README.md`.

### Build reproducibility

`build/full-ce/manifests/<BUILDMARK>.json` records, for every build: the git
revision, the sha256 of the OEM JAR, the LunaCE binary, every consumed ipk, and
the output JAR. The rootfs is written with fixed mtimes and a normalised gzip
header, ipks are selected by version (not mtime), and the staged ipks the build
repacks are produced deterministically — so two builds of the same inputs differ
only in `BUILDTIME`/`BUILDMARK`.

## RC3 (600067) — candidate complete, in soak

Every release blocker is closed with hardware evidence. Built 2026-08-29, flashed
and verified the same day; ten hours idle overnight with **zero crashes of any
kind** (no rdxd reports, no SEGV, no upstart re-exec, no respawn storms, both
repair paths dormant), and the backup dedup fix proven end to end on 2026-08-30.

Remaining before release is soak time and manual use, not code.

## RC3 work log

RC2 field feedback (since removed from the repo) drove this list; the
reproduced/diagnosed items live in
`KNOWN-ISSUES.md`. State as of 2026-08-29:

1. **Power menu Shut Down rebooted the device** — KNOWN-ISSUES #8. **Fixed,
   flashed and verified on hardware (600059): every power-menu option now
   performs its own action.** The reboot tripwire's `/sbin/reboot` shell shim
   could not preserve `argv[0]`, and `poweroff`/`halt` are symlinks to `reboot`,
   whose action comes from that name alone — so every power-off became a reboot.
   The tripwire is retired: `bake.py` §19d writes no shims, the four overlay
   files are deleted, and `ce-test-full.sh` check 8 now asserts the path stays
   unwrapped. Verify on hardware **on battery**.

2. **Preware seed wording** — RC2-Issues #2. The eight `(baked into webOS CE)`
   suffixes in `PATCH_SEED`/`EXTRA_PATCH_SEED` are now `(Pre-loaded)`, and the
   tracked `preware-seed.sh` carries the same text. Behaviour is untouched: all
   11 stanzas remain, one per package (TEST-PLAN §6). `Backup and Restore
   (woce-backup)` keeps its parenthetical — it names the package, it is not a
   bake note.

3. **The first-boot upstart race** — KNOWN-ISSUES #1. **Repaired in 600062**
   (not prevented). Preware's postinst `cp`s ipkgservice's upstart job file into
   the watched directory in place and `start`s it 25 ms later, so upstart can
   read it partially written; the job then sits `(stop) waiting` and Preware has
   no backend until a reboot. The bad write lives in a signed third-party ipk, so
   `ce-cryptofs-seed` now repairs instead: if the service is not running once
   Preware is installed, rewrite the job file via a temp path OUTSIDE
   `/var/palm/event.d` and `mv` it in (atomic `rename(2)`), then start it. The
   settled-system fast path now also requires ipkgservice to be running, or a
   Luna Restart would skip the repair on exactly the boots that need it.
   Bench-tested under busybox against all three states; logs `REPAIRING
   ipkgservice:` and `ce-test-full.sh` surfaces it as INFO. The race can still
   fire — the cost is now one repaired boot instead of a dead Preware — and
   validation is unchanged: one clean boot proves nothing.
   **Also worth sending upstream:** every Preware install on any device runs that
   same non-atomic `cp`; the two-line patch is in KNOWN-ISSUES #1.

4. **Newly installed apps land on GAMES, not DOWNLOADS** — **closed, not
   reproducible.** On a clean 600059 flash, installs from the browser, the App
   Catalog and Preware all landed on DOWNLOADS. The RC2 device had taken a
   115-package restore, and the launcher marshal consults the saved per-app
   position before every other rule, so the sighting is most likely restored
   device state rather than the image. Kept in KNOWN-ISSUES #9 as a closed entry
   with the diagnosis to run if it is ever seen again. README corrected: CE
   renames **Favorites** to Games, not Downloads.

5. **Atlas grabbed every local media file** — RC2-Issues #4, **fixed in
   `atlas-browser-app`, nothing to change here.** Its `appinfo.json` claimed
   `{"urlPattern": "^file:"}`, which `ApplicationDescription` registers as a
   non-scheme redirect handler — and `ApplicationManagerService` resolves
   redirect handlers *before* mime and extension handlers, so one claim
   outranked Photos, Music and Video for every `file://` open. The claim is
   gone, and its postinst/prerm now drop Atlas's stale entries from
   `/var/usr/palm/command-resource-handlers-active.json` (the persisted table
   that survives upgrades and Luna restarts) so the fix reaches devices that
   already have 0.9.11.

6. **luna-tls13 is at 1.1.4** (dropped in 2026-08-24; 1.1.3 removed) — **done,
   nothing left to do.** `bake.py`'s `ati_ipk()` picks the highest-versioned
   `org.webosinternals.luna-tls13_*.ipk` in `AddToImage/PatchOrReplace` and the
   Preware status stanza takes its `Version:` from that ipk's control, so the
   600058 bake already carried 1.1.4 end to end and 600059 still does.
   `preware-seed.sh` is bake.py output: regenerate it, never hand-edit the
   versions. (One deliberate exception on 2026-08-29: its eight *description*
   strings were re-worded by hand ahead of the bake so an un-baked build would
   not ship the old text. The 600059 bake reproduced them byte for byte.)

   The diff from 1.1.3 was **wording only** — three postinst echo lines, one
   preremove echo line, and the version in `appinfo.json`/control. Identical
   payload file list, no change to the LunaSysMgr launcher patch or the three
   env-scrub wrappers. So it needs no re-verification beyond a normal build;
   sha256 `e8107550e037e5fe7cb502f93601b4f1eb31770e53a4d00f512b59351e1dd9ec`.


7. **The installer wrapper still said HP** — done in 600060. The Doctor's own
   window said `HP(R) webOS(tm) Doctor (Build Hp.88.86 12/21/11 19:58)`, its
   begin/end cards promised that an HP profile would restore the user's apps and
   contacts, and its help links pointed at `go.palm.com` / `hpwebos.com` pages
   that have been dead for over a decade. `harness.py` now brands the wrapper at
   repack time from the overlay's own `etc/palm-build-info`, so the installer and
   the OS it installs cannot disagree:

   - `recoverytool.config`: `VersionStr` -> the CE version string,
     `RomBuildNumber` -> the BUILDMARK, `RecoveryToolBuildTime` -> the bake time.
     Title bar now reads `webOS(tm) Doctor (Build Hp.88.600060 08/29/26 16:58)`.
   - `messages*.properties`, all 9 locales, 7 strings each: the HP/Palm-profile
     promises become the Backup-app truth, and every dead support link becomes
     `docs.webosarchive.org/doctor/`.
   - `CardController.class`: the `HP(R) ` vendor mark dropped from the title
     constant (a `CONSTANT_Utf8` swap; `javap` re-parses the patched class).

   Which keys were safe to touch and which are load-bearing is audited in
   **TEARDOWN §2**. Deliberately untouched: `RecoveryToolBuildNumber` (fed to the
   build-approval check) and `CustomizationBuild` (names `resources/hp.tar` — it
   is why the title still says `Hp.`). Still HP-branded and worth a decision:
   the 9 `EULA_*.html` files, and `BootiefyCard.2/.3`, which tell the user to
   take off the back cover and remove the battery — no TouchPad has either.

8. **The output JAR was named after the OEM product** — **done 2026-08-29.**
   `build-ce-doctor.sh` now writes `out/webosdoctorp310hstnh-ce-<mark>.jar`: CE's
   own version and suffix, instead of HP's `p305` product code with a `3.1CE` tag
   bolted on. Takes effect from **600063**, which was rebuilt under the new name
   (byte-identical, sha256 `67544cb8…` before and after — a rename, not a new
   image); 600062 and earlier keep the names they were built and flashed under,
   and their manifests record those paths. The
   input, `webosdoctorp305hstnhwifi.jar`, keeps its name — that is a fact about
   HP's file. `build/README.md` and the RELEASE-NOTES asset line updated with it.

9. **The app-store root can go missing on a flash** — KNOWN-ISSUES #10, found
   and guarded on 2026-08-29. A dirty VFAT `/media/internal` (mounted
   `errors=remount-ro`) makes the Doctor's `AppDeletion` stage go read-only; it
   then fails every removal, **reports the flash successful anyway**, and the
   device boots with no `/media/cryptofs/apps` — preloads fail forever on the
   pulsing logo. `ce-cryptofs-seed` now probes the real path and rebuilds the root
   before the preload pass, `ce-test-full.sh` asserts both the root and the absence
   of a repair, and TEST-PLAN's flash checklist says to grep the Doctor log for
   `removed the appDirectory` / `Read-only file system`. Still open: the Doctor
   itself treats a wholly failed wipe as success — fixing that means patching OEM
   Java, which is a bigger call than the first-boot guard.

10. **OTA readiness — the trust anchor ships, the client does not.** The OTA
   project's `OTA-IMAGE-INTEGRATION.md` (rev 2) and our `IMAGE-SIDE-DECISIONS.md`
   in that repo settled on **option A**: bake only what cannot be added later.

   That is exactly one thing. A trust root delivered over an untrusted channel is
   not a trust root — if the signing key shipped in a future update, that update
   would itself be unauthenticated. So 600070 bakes
   `/usr/share/ce-ota/keys/ce-ota-signing.pub` (RSA-4096) and `/usr/bin/ce-ota-verify`,
   and nothing else. The daemon, bridge service and patched Updates UI arrive
   later via Preware and are authenticated BY this key.

   `bake.py` asserts the key's DER SubjectPublicKeyInfo fingerprint
   (`3f02d369…f9fa79`) and refuses to build on a mismatch — verified by
   substituting an imposter key and watching the build abort.

   The verifier targets the **stock** `/usr/bin/openssl` (0.9.8k, 2009), which this
   image does not replace: our TLS work adds `/usr/lib/ssl11` and wraps `curl` but
   leaves `openssl` alone (confirmed: 448889 bytes, 2011-12-21, zero references in
   bake.py). So the same script verifies on stock 3.0.5 and on CE 3.1.0 — a device
   does not need the modern crypto it might be installing in order to check the
   signature on it.

   Deliberately NOT baked: the OTA client itself. Its armed-flash path has never
   been verified end to end and no real payload exists, and the rootfs is frozen
   for the life of the release. Four findings were sent back to that project and
   remain open: manifests must bind to their target model/version; payloads must be
   moved to root-only storage before verification (`/media/internal` is
   USB-exported, so verify-then-install is a TOCTOU); rotation keys and the
   downgrade serial are wiped by a re-flash, so the baked root must remain a valid
   signer forever; and their status whitelist inherits from `Object.prototype`.

**Baked as 600059** (2026-08-29), sha256 `230f66ff…`, integcheck clean,
**flashed successfully** the same day, and the first fully clean automated pass
of the cycle: **81 PASS / 0 FAIL / 9 INFO** (`scripts/results-600059.txt`; RC2
had three FAILs, all the ipkgservice race). 600060 re-bakes it with the wrapper
branding above. The
built rootfs was checked on both fixes: `/sbin/reboot` and `/sbin/telinit` are
the stock OEM binaries again with no `*.real` leftovers and `halt`/`poweroff`
still symlinked to `reboot`; `preware-seed.sh` carries 11 stanzas with the eight
`(Pre-loaded)` descriptions, and luna-tls13's stanza now reads 1.1.4 by itself.
Nothing has been flashed.

**A caution for the next change to `bake.py`:** the stale-overlay guard does
**not** cover it. `inputs_sha256` is computed over `AddToImage/` and the LunaCE
binary only, so a `bake.py` edit never trips the guard — the tracked overlay
will simply build with the old behaviour. Re-bake after touching it.

## Working artifacts

- `webosdoctorp305hstnhwifi.jar` — the OEM 3.0.5 Doctor (the repack base; not in git).
- `out/webosdoctorp310hstnh-ce-600070.jar` — **the release** (2026-09-03),
  sha256 `392f2122…`. 600067 plus two additions: the Device Info account label
  ("HP webOS Account" -> "webOS Account", 13 view files) and the **CE OTA trust
  anchor** (signing public key + `ce-ota-verify`). Promoted from the `-frc`
  candidate file with no rebuild — the two are byte-identical, and a week of
  community use surfaced no show-stopper.
  **Tested on two devices: 90 PASS / 0 FAIL each**, a 7-cycle reboot soak at
  112/0, a clean restore, a German factory reset and a French (Canada) fresh
  flash. See `TEST-PLAN.md`.
- `out/webosdoctorp310hstnh-ce-600067.jar` — the RC3 candidate as tested,
  sha256 `eadd365f…`. Everything below, plus **Preware 1.9.19 rebuilt from source**
  carrying both ipkgservice fixes (atomic job-file write, and registration failure
  no longer reported to upstart as success — KNOWN-ISSUES #1 and #1b), and
  woce-backup 3.1.1 with the manifest, dedup and orphan-purge fixes. Built and
  integchecked; not yet flashed.
- `out/webosdoctorp310hstnh-ce-600066.jar` — the polling ipkgservice repair only;
  the Preware source fix is NOT in this one.
- `out/webosdoctorp310hstnh-ce-600064.jar` — flashed; the boot that exposed the
  respawn storm (KNOWN-ISSUES #1b). 82 PASS / 2 FAIL.
- `out/webosdoctorp305hstnh-3.1CE-600062.jar` — an earlier candidate,
  sha256 `89d32952…`. 600061 plus the ipkgservice job repair (KNOWN-ISSUES #1).
  Built and integchecked; **not yet flashed**.
- `out/webosdoctorp305hstnh-3.1CE-600061.jar` — the previous candidate,
  sha256 `5cdd09ef…`. 600060 plus the `ce-cryptofs-seed` app-store-root probe and
  repair (KNOWN-ISSUES #10). Flashed and verified on hardware 2026-08-29:
  **83 PASS / 0 FAIL / 9 INFO** (`scripts/results-600061.txt`), clean OOBE with
  account sign-in, quick Luna restart, `AppDeletion: removed the appDirectory`
  present with zero read-only errors, and the repair path correctly dormant
  (`cryptofs usable after 0s`, no `REPAIRED:` lines).
- `out/webosdoctorp305hstnh-3.1CE-600060.jar` — the branded wrapper (config
  strings, 9 message bundles, the title constant) on 600059's rootfs. Flashed;
  its first boot hit the dirty-VFAT store wipe failure of KNOWN-ISSUES #10 —
  a device-state fault, not an image one, confirmed by reflashing on an erased
  volume. Superseded by 600061.
- `out/webosdoctorp305hstnh-3.1CE-600059.jar` — **flashed and verified booting
  on hardware 2026-08-29**, sha256 `230f66ff…`. First build with the retired
  tripwire and the `(Pre-loaded)` seed wording. Trenchcoat ran to 100% and the
  Doctor reported `Flash End time (Success)`.
- `out/webosdoctorp305hstnh-3.1CE-600058.jar` — LunaCE with the PDK
  `LD_PRELOAD` / app-remove fixes. **Never flashed**; the baseline 600059 sits on.
- `out/webosdoctorp305hstnh-3.1CE-600056.jar` — **release candidate 2**, the last
  build validated on hardware.
- `out/webosdoctorp305hstnh-3.1CE-600055.jar` — identical bar the restore
  timeout fix; the build the 100/2 restore was measured on.
- `out/webosdoctorp305hstnh-3.1CE-600052.jar` — the previously built candidate,
  identical bar the de-shadow list and seed-log text; kept as a fallback.
- `out/webosdoctorp305hstnh-3.1CE-600024-rc.jar` — RC1, kept as a fallback.

600053, 600054 and 600057 are intermediate bakes, not candidates.

`out/` is gitignored; rebuild with `build/full-ce/bake.py` then
`build/build-ce-doctor.sh overlays/full-ce`.
