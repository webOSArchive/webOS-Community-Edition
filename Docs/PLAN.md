# webOS Doctor — Community Edition

A community webOS Doctor and update path for the **HP TouchPad**, built from HP's
own **webOS 3.0.5** Doctors with 14 years of community work baked into the
rootfs: modern TLS, the LunaCE launcher, Bluetooth gamepad and USB support, a
working App Catalog, modern mail. Two images, one per device: Wi-Fi (`topaz`)
and 4G/AT&T (`topaz4g`).

**Trying it out:** download a Doctor .jar from the latest
[Release](https://github.com/webOSArchive/webOS-Community-Edition/releases), and
read [how to run a Doctor](https://docs.webosarchive.org/doctor/#running-the-doctor).

## Current status (2026-11-26)

- **webOS CE 3.1.0** is released: BUILDMARK **600070** (Wi-Fi, 2026-09-03) and
  **600071** (4G/AT&T).
- **webOS CE 3.2.0** is released: BUILDMARK **600121** (Wi-Fi) and **600122**
  (4G/AT&T). It is the first CE release delivered **over the air**: a 3.1.0
  TouchPad installs **OTA Ready** from App Museum II and updates in place with
  System Updates. Its main new feature is modern email sign-in (Microsoft 365,
  Outlook.com, Gmail). Both release Doctors were fresh-flashed and tested, and
  both 3.1.0 → 3.2.0 routes (600070 → 600121, 600071 → 600122) ran through
  production.
- **OTAs start at 3.1.0.** A device on stock 3.0.5 or earlier is flashed with the
  Doctor; there is no bootstrap OTA from stock.

The full story: **[RELEASE-NOTES.md](../RELEASE-NOTES.md)** (what ships, how it
was tested), **[OTA-HANDOFF.md](OTA-HANDOFF.md)** (where the OTA work stands),
**[ATT-VARIANT.md](../ATT-VARIANT.md)** (the 4G/AT&T build), and
**[KNOWN-ISSUES.md](../KNOWN-ISSUES.md)** (what is open).

## How the Doctor is built

The OEM Doctor JAR is repacked, not recompiled. Every app, patch and file is
**baked** at its final rootfs path at build time: no staged ipks and no
first-boot installs. `build/full-ce/bake.py` replays each package's postinst
file-effects on the build host into `build/overlays/full-ce/`, then
`build/build-ce-doctor.sh overlays/full-ce` regenerates the ipkg md5 database,
runs `integcheck` and repacks the JAR. `AddToImage/` is the statement of intent
for image contents, and `build/full-ce/manifests/<BUILDMARK>.json` records the
inputs and output of every build. **Setting up and building from scratch, and
shipping an OTA: [BUILDING.md](../BUILDING.md).** Detail: [build/README.md](../build/README.md)
and [build/full-ce/README.md](../build/full-ce/README.md).

## Root documents

| Doc | What it covers |
|-----|----------------|
| **[README.md](../README.md)** | The project front page: what CE is, how to get it, where to get help. |
| **[BUILDING.md](../BUILDING.md)** | Setting up a build machine, baking a Doctor (Wi-Fi and AT&T), testing it, and building, signing and rolling out an OTA update. |
| **[RELEASE-NOTES.md](../RELEASE-NOTES.md)** | What ships in 3.2.0 (and, below it, 3.1.0), how each release was tested, and the known issues a user may meet. |
| **[KNOWN-ISSUES.md](../KNOWN-ISSUES.md)** | Every issue reproduced but not yet fixed: what it costs a user, what is known, and what a fix would have to do. |
| **[ATT-VARIANT.md](../ATT-VARIANT.md)** | The 4G/AT&T (`topaz4g`) build: how it is derived from HP's AT&T Doctor, what differs from Wi-Fi, and its test record (600071, 600122). |
| **[BACKUP-RESTORE.md](../BACKUP-RESTORE.md)** | Moving a woce-backup store between devices, and the stale state that makes a good backup fail with misleading errors. |

## Docs/ index

| Doc | What it covers |
|-----|----------------|
| **[4G-TOUCHPAD.md](4G-TOUCHPAD.md)** | The one place CE behaves differently when a cellular radio is present (the PmWanDaemon gate), and how it held up on the AT&T builds. |
| **[AUTOCORRECT-RANKING-HANDOFF.md](AUTOCORRECT-RANKING-HANDOFF.md)** | Hand-off on candidate ranking in CE's SmartKey auto-correct engine (`packages/smartkey`); overtaken by a later commit. |
| **[EMAIL-MODERNIZATION-PLAN.md](EMAIL-MODERNIZATION-PLAN.md)** | The 3.2.0 mail plan: Microsoft 365 over ActiveSync and Gmail/Outlook.com over IMAP/SMTP with OAuth, on Palm's unchanged mail binaries. |
| **[EMOJI-FONT.md](EMOJI-FONT.md)** | Emoji in 3.2.0: a monochrome fifth WebKit fallback font for the BMP emoji (with the `libWebKitLuna` patch), and colour emoji as images in apps. |
| **[GAMEPAD-INPUT-JAIL.md](GAMEPAD-INPUT-JAIL.md)** | Design doc (not built): exposing `/dev/input` to jailed PDK apps OS-wide instead of per-app postinst edits. |
| **[HOTSPOTS.md](HOTSPOTS.md)** | Spurious "hotspot sign-in needed" prompts: the connectivity probe, its URL table, and the fixes (issue #15 in 3.2.0). |
| **[LOCALIZATION-GUIDE.md](LOCALIZATION-GUIDE.md)** | For translators: making a stock 3.0.5 language pack work on webOS CE 3.1.0 and later. |
| **[LUNACY-EMOJI-AND-AUTOCORRECT.md](LUNACY-EMOJI-AND-AUTOCORRECT.md)** | Notes for Lunacy on CE's emoji and auto-correct work: what it can reuse and what it doesn't need. |
| **[LUNACY-ICAL-IMPORT.md](LUNACY-ICAL-IMPORT.md)** | Notes for Lunacy on porting CE's Import Calendar (`.ics`). |
| **[LUNACY-MAIL-FINDINGS.md](LUNACY-MAIL-FINDINGS.md)** | Findings for Lunacy from porting its mail sign-in work to CE. |
| **[LUNACY-VCARD-IMPORT.md](LUNACY-VCARD-IMPORT.md)** | Notes for Lunacy on porting CE's Import vCards, and the commit to take it from. |
| **[LUNACY-WINDOWS-ZONE-NAMES.md](LUNACY-WINDOWS-ZONE-NAMES.md)** | From Lunacy: Windows zone names (e.g. "Eastern Standard Time") in the calendar framework, and the fix CE applied. |
| **[OTA-HANDOFF.md](OTA-HANDOFF.md)** | Where the 3.1.0 → 3.2.0 OTA stands: the client, the server, the runs, and what to do next. Start here for OTA work. |
| **[OTA-PLAN.md](OTA-PLAN.md)** | The OTA plan and its full record: payloads as rootfs diffs, every run on a device, and `ce-ota-finish`. |
| **[PLAN.md](PLAN.md)** | This page: current status and the index of every doc. |
| **[SCOPE-3.1-CE.md](SCOPE-3.1-CE.md)** | The historical 3.1.0 design: repack feasibility, tiered feature set, branding, decisions. A banner lists what has changed since. |
| **[TEARDOWN.md](TEARDOWN.md)** | Analysis of the OEM 3.0.5 Doctor JAR: structure, signing, the TrenchCoat flash recipe, and the webOS rootfs. The starting point. |
| **[TEST-PLAN.md](TEST-PLAN.md)** | The verification run for the current build: what has been checked, what still needs a human, and how to capture evidence. |
| **[TOUCHPAD-GO-BUILD-GUIDANCE.md](TOUCHPAD-GO-BUILD-GUIDANCE.md)** | Guidance for the separate TouchPad Go (`opal`) meta-doctor project derived from CE 3.2.0. Not a CE image. |
| **[unimplemented-accounts.method.md](unimplemented-accounts.method.md)** | Hand-over to the account-server project: `getPreferences` is unimplemented server-side. Not a system-image issue. |
| **[USB-SETTINGS-HOTFIX.md](USB-SETTINGS-HOTFIX.md)** | Specification for a USB Settings "Helper not running" hotfix (diagnosed on 600070; not built). |
| **[VIDEO-3.2.0-NOTES.md](VIDEO-3.2.0-NOTES.md)** | The Video Player and Media TLS as shipped in 3.2.0: state and learnings. |
| **[VIDEO-PLAYER-REWRITE.md](VIDEO-PLAYER-REWRITE.md)** | The historical plan for the Video Player rewrite; current state is in VIDEO-3.2.0-NOTES.md. |
| **[WEBOS-CHAT-FINDINGS.md](WEBOS-CHAT-FINDINGS.md)** | webOS Chat on CE: findings for the Lunacy project. |
| **[WEBOS-CHAT-HANDOFF.md](WEBOS-CHAT-HANDOFF.md)** | Test status of the webOS Chat Enabler 3.1.1 on topaz, side by side with a stock TouchPad. |
| **[WEBOS-CHAT-PLAN.md](WEBOS-CHAT-PLAN.md)** | webOS Chat for CE: the Preware Chat Enabler, and baking it into the image (deferred past 3.2.0). |

## Source projects (siblings)

| Project | Contributes |
|---------|-------------|
| `OpenSSL-legacyWebOS` | Modern TLS stack (browser, download manager, mail), env wrappers, CA bundle |
| `LunaCE` | LunaSysMgr launcher replacement |
| `webos-hardware-tests` | Bluetooth gamepad shim, USB OTG/power/mass-storage (all userspace) |
| `webos-update-exploration` | The OTA client (OTA Ready), server and signing key |

## History

The 3.1.0 release-candidate status (RC2/RC3), the RC3 work log and the 3.1.0
build-artifact list were removed from this page on 2026-11-26. They are in git
history: see `git show f6102d1:Docs/PLAN.md`.
