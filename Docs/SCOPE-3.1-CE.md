> **Status 2026-11-26: this is the historical 3.1.0 design.** Section numbers
> are kept (other docs cite them). Decisions that have changed since:
>
> - **§9 #1 and §3, device scope "`topaz` Wi-Fi only":** an AT&T (`topaz4g`)
>   build ships too: 600071 for 3.1.0 and 600122 for 3.2.0
>   (**[ATT-VARIANT.md](../ATT-VARIANT.md)**).
> - **§9 #2 and the Tier 3 note, bootstrap OTA from stock 3.0.5 and two-form
>   (baked + ipk) components:** dropped. OTAs start at 3.1.0; a 3.0.5 device is
>   flashed with the Doctor. The OTA client is not baked: OTA Ready comes from
>   App Museum II, and 3.1.0 reached 3.2.0 by OTA
>   (**[OTA-HANDOFF.md](OTA-HANDOFF.md)**).
> - **Tier 2 "all userspace on stock kernel" and the "would force replacing
>   the stock kernel" note:** the image bakes UberKernel 3.0.5-93
>   (`AddToImage/PatchOrReplace`, baked by `bake.py`). The hardware features
>   themselves are still userspace.
>
> Current state: **[PLAN.md](PLAN.md)** and **[RELEASE-NOTES.md](../RELEASE-NOTES.md)**.

> **DESIGN DOC — decisions below are as-planned; some changed in the shipped
> build.** As of the **600024** release candidate (see RELEASE-NOTES.md):
>
> - **Version string** is **`webOS CE 3.1.0`**, not "webOS 3.1 Community Edition
>   (3.0.5 base)". Four binaries that prefix-strip the version get a same-length
>   `"HP webOS " → "webOS CE "` byte patch so apps still parse a bare `3.1.0`.
> - **App Catalog** is **6.1.2901**, not 6.0.2900.
> - **Nothing is staged as an ipk.** §1f below plans to swap the staged catalog
>   ipk and edit `manifest.json`; the shipped build instead **bakes** every app at
>   its final rootfs path and **removes** the stock staged ipk. (§1f's own note
>   that the stock catalog sits at the flat path
>   `/usr/palm/ipkgs/com.palm.app.enyo-findapps_5.0.2900_all.ipk` is correct and
>   load-bearing — a later session wrongly concluded that file did not exist and
>   shipped builds where the stock 5.0.2900 shadowed the baked catalog.)
> - **First use** is the community webOS Account flow and account setup is
>   skippable; the sign-in app is OOBE-only.

# webOS 3.1 "Community Edition" Doctor — Scope

**Goal:** produce a new, flashable webOS Doctor JAR that installs a webOS 3.0.5
base **with community improvements baked directly into the rootfs**, presenting
itself as **"webOS 3.1 Community Edition"**, so a single novacom flash yields a
modern-TLS, LunaCE, hardware-enhanced TouchPad with no post-flash package dance.

- **Base:** `webosdoctorp305hstnhwifi.jar` (HP webOS 3.0.5, build 86, `topaz` Wi-Fi). See `TEARDOWN.md`.
- **Method:** repack, not rebuild (MetaDoctor-style). We modify the existing signed JAR's payload; we do not recompile the installer or the OS from source.
- **Primary target:** TouchPad Wi-Fi (`topaz`). TouchPad Go (`opal`) and 4G are secondary (see §9).
- **Source projects:** `LunaCE`, `OpenSSL-legacyWebOS`, `webos-hardware-tests`, `webos-update-exploration`.

---

## 1. Why "repack" is the right approach (feasibility)

Verified against the decompiled installer classes and the extracted rootfs:

- **No JAR self-signature check at runtime.** Nothing in `RecoveryTool`/`FlasherThread` calls `getCodeSource`/`getSigners`. We can freely modify `resources/webOS.tar` (the rootfs) and repack. The JAR's VeriSign signature is already expired (2012) and irrelevant to flashing.
- **The rootfs is a plain ext3 image delivered as `nova-cust-image-topaz.rootfs.tar.gz` inside `resources/webOS.tar`.** We unpack it, modify files, re-tar, re-gzip, and re-nest — standard tooling, no proprietary format. (`unzip -p` chokes on the large deflate members; use Python `zipfile`/`jar`.)
- This is the same technique the community's **MetaDoctor** used for ~14 years; it is well-trodden, not novel.

### Two flash-time gates to neutralize

| Gate | What it does | Toggle | Plan |
|------|--------------|--------|------|
| **CS online verify** | `FlasherThread.run()` builds `https://…/palmcsext/verifyWOD?nduId=…` and throws **"UNAUTHORIZED BUILD"** if it can't authenticate with Palm's (now-dead) CS server. | Gated by field `checkToFlash`; set via `FlasherThread.setCheckFlash(boolean)`. When false, `run()` jumps past the whole block. | Force `checkToFlash=false` (patch the caller in `RecoveryTool`/`CardController`, or the config that drives it). **Mandatory** — the server is dead, so if reached it always throws. |
| **On-device ROM verify** | `VerifyRomStage` runs `/usr/sbin/integcheck -r /tmp_rootfs ipkg`, which md5-checks every file listed in `/usr/lib/ipkg/info/*.md5sums` (666 packages) against the flashed rootfs; throws "Base ROM Failed Verification" on mismatch. | Field `verifyRom`; set via `FlasherThread.doVerifyRom(boolean)`. | **DECIDED: keep `verifyRom=true`.** The build must therefore keep the ipkg md5sum DB consistent — regenerate the owning package's `.md5sums` entry for every stock file we edit in place, and ship every *added* component as a proper ipk (its own `.md5sums` + `status` entry) installed into the offline root. The on-device integrity net stays meaningful. |

> `checkToFlash=false` is **mandatory** (the CS server is dead) — a required
> boolean patch, not a choice. The exact wiring that sets it from the GUI flow
> needs a 30-minute confirmation during Phase 0 (likely `CardController` or a
> `FlashOptions` field). `verifyRom` stays true per decision; the cost moves into
> the build's md5sum-regeneration step (§6).

---

## 2. Size budget (two-tier — this shapes what "fits")

The rootfs unpacks into a **568 MB read-only root LVM volume**; current stock content is **~393 MB → ~175 MB headroom**. But third-party *apps* don't touch it:

- **Root-volume cost** (counts against the 175 MB): system libraries and binaries — LunaCE `LunaSysMgr`, the `/usr/lib/ssl11*` TLS stack (~4 MB), shims, `/usr/bin` daemons, and edits to `com.palm.*` system apps under `/usr/palm/applications`.
- **Media-volume cost** (effectively unlimited): everything installed to `/media/cryptofs/apps/...` — QupZilla, OTA Ready, USB Settings UI, BT-gamepad UI. This is a dm-crypt volume on the "rest of disk" `media` LVM volume.

Tier-1 + Tier-2 system additions are on the order of ~15–25 MB against the root volume — comfortable. QupZilla's Qt5 stack is the only heavy item and it lands on media.

---

## 3. Payload — the CE feature set (locked)

> **Decisions applied:** target = `topaz` Wi-Fi only · mail TLS **included** ·
> hardware BT gamepad + USB **both included** · QupZilla **excluded** ·
> OTA/updates path **included** · identity = version-string rename, `BUILDNAME` kept.

### Tier 1 — Core modernization (include; high value, isolation-safe)

**1a. Modern TLS stack (`OpenSSL-legacyWebOS`).** OpenSSL 1.1.1w + curl 7.88.1/7.61.1 installed in **parallel** private dirs; stock 0.9.8 left untouched (Wi-Fi/EAP/keymanager/OTA still depend on it — a global swap bricks boot). Bake:
- Lib dirs **with their symlinks**: `/usr/lib/ssl11/` (`libcrypto.so.1.1`, `libssl.so.1.1`, `libssl_compat.so`, `libcurl.so.4.8.0`, + `libssl.so.0.9.8→libssl.so.1.1` / `libcrypto.so.0.9.8→…1.1` redirect links), `/usr/lib/curl11/`, `/usr/lib/ssl11mail/`, `/usr/lib/ssl11dl/`. (Offline-root ipkg couldn't create symlinks so postinsts did it at runtime; an ext3 image bakes them directly.)
- Patched consumers: `/usr/bin/BrowserServer` (RPATH+add-needed), `/usr/bin/LunaDownloadMgr` (RPATH), optional `/usr/bin/mojomail-imap` (1-byte tag fix). **These come straight from `ipks/tablet/` and match stock 3.0.5 binaries as-is** — no re-patching needed unless we alter those components.
- `/etc/event.d/LunaSysMgr` launcher env: `LD_PRELOAD += ssl11/libssl_compat.so`, `LD_LIBRARY_PATH=/usr/lib/ssl11`, `LD_BIND_NOW=1`.
- **The three env-leak wrappers + their `.real` + media LS2 roles** (mandatory companions of the launcher env edit): `/usr/bin/media-pipeline`, `/usr/sbin/setcpushares-pdk`, `/usr/sbin/setcpushares-task`. Build these on this box with the PalmPDK toolchain (a build without `/opt/PalmPDK` silently substitutes a smaller, wrong prebuilt).
- **Mail TLS (included):** the mail libcurl stack in `/usr/lib/ssl11mail/` (its own `libssl_compat.so` superset — do not symlink to ssl11's), env prefix on the four `com.palm.{eas,imap,pop,smtp}.service` launchers, `OPENSSL_CONF=/usr/lib/ssl11mail/mailssl.cnf` on imap/pop/smtp (forces TLS 1.2 + RSA to dodge Gmail's ECDSA-leaf mis-verify), and the 1-byte `mojomail-imap` tag fix. Restores native Gmail/EAS/IMAP/POP/SMTP.

**1b. Fresh CA bundle** at `/etc/ssl/certs/ca-certificates.crt` — the whole TLS stack validates against it; the 2011 bundle is useless. **Required, not optional.**

**1c. NTP clock sync** — `/etc/event.d/ntpdate-sync` upstart job (`org.webosinternals.ntpdate-sync`). **Effectively required**: a freshly-doctored device boots with a past-dated clock → modern certs read "not yet valid" → TLS *looks* broken. webOS's built-in sync targets dead `palm.com`.

**1d. LunaCE launcher (`LunaCE`).** Drop-in `/usr/bin/LunaSysMgr` (device-matched `LunaSysMgr-LunaCE-topaz`) + the two new launcher icons `tab-add-icon.png`/`tab-delete-icon.png` at `/usr/palm/sysmgr/images/launcher3/`. Adds app folders/groups, renameable/add/remove tabs, wave launcher, card enhancements, stability fixes. On-disk launcher state stays format-compatible with stock.

**1e. rdxd crash-report fix.** Flip `/etc/rdxd.conf` `AutoUpload=true` → `false` (dead upload server otherwise fills the 23 MB `/var/log` with capped, never-sent `.tgz`). One-line, safe, pure win.

**1f. App Catalog replacement (`com.palm.app.enyo-findapps` 6.0.2900).** The stock App Catalog ships as a *staged preinstalled ipk* at `/usr/palm/ipkgs/com.palm.app.enyo-findapps_5.0.2900_all.ipk` (installed to `/media` at first boot via `/usr/palm/ipkgs/manifest.json`) and points at the dead `ps.palmws.com`. Replace it with the community `..._6.0.2900_all.ipk` (`~/Downloads/`, arch `all`, packager `3.0.5b38` — compatible). The swap:
  1. Remove the `_5.0.2900_` ipk from `/usr/palm/ipkgs/`, add the `_6.0.2900_` ipk.
  2. In `manifest.json`: set the `com.palm.app.enyo-findapps` entry's `ipkgUrl` to the new filename and `version` to `6.0.2900`.
  3. **Regenerate md5sums** — the staged ipks are tracked by `/usr/lib/ipkg/info/app-ipkgs.md5sums` (+ `app-ipkgs.list`); update the findapps line and the `manifest.json` line so `verifyRom` passes.
  Root-volume cost is a wash (~+5 KB); the installed app lands on `/media` at first boot. The stock `com.palm.service.appcatalog` service stays in place.

### Tier 2 — Hardware support (include; all userspace on stock kernel)

**2a. Bluetooth gamepad shim (`webos-hardware-tests`).** `LD_PRELOAD` interposer — no kernel change. Bake `/usr/lib/libpmbtgamepad.so`, `/etc/udev/rules.d/99-bt-gamepad.rules`, the LD_PRELOAD variant of `/etc/event.d/bluetooth`, the `/dev/input` bind in `/etc/jail_pdk.conf`, and the `isGamepad`/`isMouse` edits to `com.palm.app.bluetoothtab`'s JS. DS4 confirmed on hardware; other BR/EDR pads likely. (No BLE, no XInput — hardware limits.)

**2b. USB accessories (`webos-hardware-tests`).** OTG host mode, high-power bypass, USB mass storage. Bake `/usr/bin/{usbctl-watchd,usbctl-jsservice,usbdevmon}`, `/etc/event.d/usbctl-watchd`, the app/service trees, and LS2 roles. All poke existing `/sys` interfaces the stock kernel provides.

### Tier 3 — Update path (included)

**3a. Native Updates reroute + OTA Ready (`webos-update-exploration`).** CE keeps a live update path so flashed devices receive future community updates from our server. Bake the patched `com.palm.app.updates` (reads a local `offer.json` and renders the community offer natively), the OTA Ready app + `otaready-daemon`, `/usr/bin/ota-fingerprint`, the **pinned CE signing public key**, and — critically — **pre-place the LS2 role/service files** in the image (`/var/palm/ls2/{roles,services}/{prv,pub}/…`) rather than relying on a postinst (a baked image has no install-time hook, and ls-hubd caches the role map at first boot). Because we keep `BUILDNAME=Nova-HP-Topaz` (§4), the server's existing fingerprint/eligibility logic keeps matching CE devices with no change; the server keys ongoing updates on `/etc/webos-ce-release`.

> **The OTA story is bigger than this bake.** We control the server, so CE also
> supports a **bootstrap OTA that upgrades stock OEM 3.0.5 devices to CE 3.1
> without re-Doctoring** (a one-time Preware/WOSQI bootstrap ipk, then a chained
> legacy→modern-TLS two-session upgrade), plus **ongoing 3.1+ OTAs**. Every CE
> component therefore ships in **two forms** — baked into this rootfs (files +
> regenerated md5sums) *and* as a signed ipk with a postinst (for OTA) — driven by
> one shared component manifest. See **`OTA-STRATEGY.md`** (since deleted; see `Docs/OTA-HANDOFF.md`) for the full design,
> the transport/size/security analysis, and the incremental effort (~2–3 weeks of
> mostly server work).

### Explicitly NOT included

- **QupZilla modern browser** — excluded by decision. CE ships the TLS-modernized *stock* browser only. Trade-off accepted: modern, JS-heavy sites still render poorly on WebKit 534.6, but TLS-only sites become reachable and the image stays lighter.
- **System-wide OpenSSL swap** (0.9.8 → 1.0.2u) — the source projects mark it `"never": true`; 15+ boot-critical components link 0.9.8. The parallel `ssl11` stack supersedes it.
- **Custom kernel / kernel-module Bluetooth** (`BLUETOOTH-KERNEL.md`) — non-functional (TX-drain blocker) and would force replacing the stock kernel. All working HW features are userspace.
- **Video-player SIGSEGV fix** — no fix exists yet (only a diagnostic kit). Known-unresolved; document it in release notes.
- **Rollback stash** — by decision, no stock-binary stash is baked; recovery from a bad boot is via re-Doctoring (stock or CE). Keeps the image simpler; raises the stakes on Phase-1 boot validation.

---

## 4. Branding & version identity (locked)

Existing tools key on the stock identity strings, so the rename is deliberately *partial* to avoid breaking them:
- LunaCE `install.sh` requires the substring `"3.0.5"` in `PRODUCT_VERSION_STRING`.
- The OTA fingerprint gates on `BUILDNAME=Nova-HP-Topaz`.
- TLS diag scripts key on component md5s.

**Locked identity scheme:**
- **`PRODUCT_VERSION_STRING = "webOS 3.1 Community Edition (3.0.5 base)"`** in `/etc/palm-build-info` — the visible CE rename, while the `"3.0.5"` substring keeps LunaCE `install.sh` (and any other substring-based tool) working post-flash.
- **`BUILDNAME` stays `Nova-HP-Topaz`** — the OTA fingerprint keeps matching CE devices with no server change. Bump `BUILDNUMBER`/`BUILDMARK` to a CE-distinct value so images are tellable apart.
- **Add `/etc/webos-ce-release`** — CE version (`3.1-CE`), edition, build date, and a manifest of included components/versions. The single source of truth for "what's in this image"; the OTA server can also read it to avoid re-offering baked-in components.
- **Editing `/etc/palm-build-info` invalidates its ipkg md5sum** (it's a tracked file) — the build must regenerate the owning package's `.md5sums` entry, or `verifyRom` fails (§1).
- **Surface "3.1 CE" in the UI:** LunaCE status-bar version string (compile-time flag — enable it), the Device Info app, and Doctor cosmetics: `recoverytool.config` (`VersionStr`, build numbers), `messages*.properties`, EULA (CE/community disclaimer), and the `.tga` boot logos in `webOS.tar`.

---

## 5. Cross-cutting integration risks (the parts that bite)

1. **LunaCE ↔ TLS launcher interaction — already reconciled, must re-verify.** An older `webos-update-exploration` note warns of a *brick* when the LunaCE launcher edit and the ssl11 launcher edit are stacked. The TLS project's `setcpushares-pdk`/`setcpushares-task` wrappers were built **specifically to make ssl11 coexist with LunaCE** (LunaCE's PDK children preload `libpvrtc.so`; the leaked `LD_BIND_NOW=1` kills them without the wrappers). So the combination is *designed* to work — but the two have not been validated *together in a single baked image*. **This is the #1 hardware-test item.** Note LunaCE ships the `LunaSysMgr` *binary* while TLS edits the `LunaSysMgr` *launcher* (`/etc/event.d`), so there's no file collision — only runtime-env interaction.
2. **Never leave a backup file in `/etc/event.d/`** — upstart runs *every* file there as a job; a stray `LunaSysMgr.*-orig` becomes a second crash-looping launcher. Put any backups under `/var/luna/`.
3. **`verifyRom=false` means no automatic integrity net** — validate the assembled rootfs boots before shipping. Conversely, if we keep `verifyRom=true`, every in-place stock edit (LunaSysMgr, event.d files, bluetooth JS, updates JS) needs its package `.md5sums` regenerated.
4. **No rollback baked in (by decision).** Recovery from a bad boot is a re-Doctor, not an on-device restore. This raises the stakes on Phase-1 boot validation: a crash-looping `LunaSysMgr`/`BrowserServer` means the only way out is re-flashing. Validate thoroughly before distributing.
5. **First-boot must not block on the dead Palm profile/activation server.** The Doctor has a `BypassFirstUseStage`; ensure the flashed image completes first-use offline (the `firstuse` app is present). Verify on a wiped device.
6. **Per-device binaries.** `topaz` and `opal` need different `LunaSysMgr`; the TLS patched binaries and the whole image are device-specific. One Doctor per device variant.
7. **Runtime-only state can't be pre-baked:** BT pairing keys (`/var/hid.j`), the NTP-corrected clock, and cert freshness are first-boot concerns handled by the baked jobs, not the static image.
8. **Input-jail exposure accepted (by decision).** The BT gamepad shim's `jail_pdk.conf` edit exposes all of `/dev/input` (touchscreen, any BT keyboard) to every PDK app, and the udev rule makes the pad node world-readable. Shipped as-is (hardware-validated). Document this in the release notes as a known privacy/security trade-off; the per-app scoping remains a future hardening item.

---

## 6. Assembly recipe (what lands where)

A build script (`build-ce-doctor.sh`) that:
1. Extracts `resources/webOS.tar` from the JAR (Python `zipfile`), then `nova-cust-image-topaz.rootfs.tar.gz`, into a work rootfs.
2. Lays down the payload by tier (see §3) at the exact paths above. **Prefer installing each added component as an ipk into the offline root** (so it carries a correct `.md5sums` + `status` entry and keeps `verifyRom` happy); lay files down directly only for in-place edits of stock files.
3. Writes `/etc/webos-ce-release` and applies branding (§4): edits `palm-build-info` (version-string rename, keep `BUILDNAME`), enables the LunaCE status-bar version string, updates Doctor cosmetics/logos.
4. **Regenerates ipkg md5sums** (`verifyRom` is on): for every edited stock file — `palm-build-info`, `/etc/event.d/{LunaSysMgr,bluetooth,rdxd}`, `/etc/rdxd.conf`, `/etc/jail_pdk.conf`, the `com.palm.app.bluetoothtab` and `com.palm.app.updates` JS, patched `BrowserServer`/`LunaDownloadMgr`/`mojomail-imap` — rewrite the owning package's entry under `/usr/lib/ipkg/info/*.md5sums`. Then dry-run `integcheck ... ipkg` against the assembled tree to confirm zero mismatches before packing.
5. Re-tars → re-gzips → replaces the entry in `webOS.tar` → replaces `resources/webOS.tar` in the JAR.
6. Patches the installer classes to force **`checkToFlash=false`** (mandatory — dead CS server) while leaving `verifyRom=true`; updates `recoverytool.config`.
7. Re-signs the JAR (self-signed cert is fine; nothing verifies it) or leaves it unsigned.
8. Emits `webosdoctorp305hstnh-3.1CE.jar`.

---

## 7. Build tooling required (all present on this box per source-project docs)

- **PalmPDK ARM cross toolchain** `/opt/PalmPDK/arm-gcc` (gcc 4.3.3, EABI soft-float) — for the TLS libs/shims and the static wrappers. i386 host libs (Linux only).
- **Qt 4.8 host tools + staging tree** — only if LunaCE must be *rebuilt*; otherwise use the prebuilt `bin/LunaSysMgr-LunaCE-topaz`.
- `patchelf`, **GNU `ar`** (not BSD ar), `openssl`/`keytool` (JDK 17 present) for repack/sign, standard tar/gzip, Python 3.
- The prebuilt artifacts already in the source repos (TLS ipks under `ipks/tablet/`, LunaCE binaries under `bin/`, HW ipks under `webos-hardware-tests/ipks/`).

---

## 8. Phased plan & rough effort

| Phase | Work | Effort |
|-------|------|--------|
| **0. Repack harness** ✅ **BUILT** | Unpack→modify→repack pipeline; `checkToFlash=false` patch (constant-pool-located, 1-byte swap); **md5-regeneration + faithful `integcheck` dry-run** tooling; unsigned repack. Self-tests pass (pristine integcheck SUCCEEDS; identity build faithful — 19085 members, root:root, device nodes/setuid preserved; overlay build regens md5; negative tests fail as expected). See `build/`. Remaining: on-hardware flash-test on a real `topaz`. | 2–3 days |
| **1. Tier-1 bake** | TLS stack + env wrappers + mail TLS + CA bundle + ntpdate + LunaCE + rdxd fix + **App Catalog 6.0.2900 swap**. Resolve the LunaCE↔TLS launcher interaction. Boot + TLS + mail + launcher + catalog smoke test. | 3–4 days |
| **2. Tier-2 bake** | BT gamepad + USB accessories; pair a DS4, mount a USB stick. | 1–2 days |
| **3. OTA + branding** | Updates reroute + OTA Ready (pre-placed LS2 roles), `/etc/webos-ce-release`, `palm-build-info` rename, UI/boot version strings, EULA. Verify OTA offer against the server. | 1–2 days |
| **4. QA matrix** | Full-flash on wiped hardware: first-use offline, every feature, confirm re-Doctor recovery (no on-device rollback). | 2–3 days |

**Total: ~2–3 weeks** of focused work for a `topaz` Wi-Fi CE Doctor, assuming the source-project artifacts build cleanly on this box (they reportedly do). The added mail, OTA, catalog swap, and the "keep verifyRom + regenerate md5sums" path push it slightly above the original estimate.

---

## 9. Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Device scope | **`topaz` Wi-Fi only** |
| 2 | Update path | **Keep OTA / Updates reroute** (OTA Ready + patched Updates app, pre-placed LS2 roles). Server backend is ours — support a **bootstrap OTA from OEM 3.0.5 → CE 3.1** and **ongoing 3.1+ OTAs**. Full design in **`OTA-STRATEGY.md`** (since deleted) |
| 3 | QupZilla browser | **Excluded** — TLS-modernized stock browser only |
| 4 | Version identity | **Rename `PRODUCT_VERSION_STRING` → "webOS 3.1 Community Edition (3.0.5 base)"; keep `BUILDNAME=Nova-HP-Topaz`** (+ `/etc/webos-ce-release`) |
| 5 | Mail TLS | **Included** (EAS/IMAP/POP/SMTP on modern TLS + IMAP tag fix) |
| 6 | Integrity net | **Keep `verifyRom=true`; regenerate ipkg md5sums** for all edits/additions |
| 7 | Rollback | **No on-device stash** — recover by re-Doctoring |
| 8 | Hardware | **Both** BT gamepad + USB accessories |
| 9 | BT input jail | **Ship as-is** (broad `/dev/input` exposure; documented trade-off) |
| 10 | App Catalog | **Replace staged findapps 5.0.2900 → 6.0.2900** |

*Mandatory regardless of choices:* patch `checkToFlash=false` (dead CS server) — see §1.

### Remaining confirmations (small)

- Exact `BUILDNUMBER`/`BUILDMARK` values for CE (propose `BUILDNUMBER=31000`, keep `BUILDMARK` or bump — cosmetic).
- Whether the OTA server's `eligibility.json` should gain a CE baseline now or as a follow-up (no *fingerprint* change needed since `BUILDNAME` is unchanged).
- Boot-logo artwork for CE (reuse stock vs. new `.tga`).

---

## Appendix — source-project → CE mapping (quick reference)

| Source project | Contributes | Tier | Root vs media |
|----------------|-------------|------|----------------|
| `OpenSSL-legacyWebOS` | TLS 1.3 stack, patched browser/downloadmgr/mail, env wrappers, ntpdate, CA bundle | 1 | root |
| `LunaCE` | `LunaSysMgr` launcher replacement + icons | 1 | root |
| `webos-hardware-tests` | BT gamepad shim, USB OTG/power/storage | 2 | root (+ app UI on media) |
| `webos-update-exploration` | Updates reroute + OTA Ready, rdxd fix, fingerprint/baseline knowledge, partition/OTA facts (QupZilla **not** used) | 1/3 | media (apps) |
| `~/Downloads/…enyo-findapps_6.0.2900` | App Catalog replacement (staged ipk swap) | 1 | root (staged) → media (installed) |
| *(this repo)* Doctor JAR | repack target, integrity-gate patches, branding | — | — |
