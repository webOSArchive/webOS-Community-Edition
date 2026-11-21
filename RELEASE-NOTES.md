# webOS CE 3.2.0 — Release Notes (DRAFT, not released)

*Draft for the 3.2.0 release (planned build 600120). The 3.1.0 release notes follow below,
unchanged.*

## Getting 3.2.0, and staying up to date

**From webOS CE 3.1.0, by over-the-air update.** Install **OTA Ready** from App Museum II.
System Updates then offers webOS CE 3.2.0; tap **Install Now**. Keep the TouchPad charged
(at least half) and on Wi-Fi. It restarts twice: the screen stays black for a while, then
shows the updater, then 3.2.0 starts, and for its first minute apps are being swapped in.
System Updates opens by itself when it is done. Your apps, data, mail and settings stay.

**From webOS 3.0.5 or earlier:** updates start at webOS CE 3.1.0. Flash 3.2.0 (or 3.1.0)
with the webOS Doctor; see https://docs.webosarchive.org. OTA Ready says "Not eligible" on
these devices.

**Keep OTA Ready installed to keep getting updates.** It is what lets System Updates find
and install webOS CE updates, on every 3.2.0 TouchPad however it got there:
- updated from 3.1.0 by OTA: OTA Ready is already installed; leave it;
- flashed with the 3.2.0 Doctor: install OTA Ready from App Museum II;
- after a Full Erase: reinstall OTA Ready, even if it is listed as installed;
- uninstalled it: reinstall it. Removing OTA Ready removes the update client and puts the
  stock System Updates back; reinstalling restores everything.

Updates are offered in stages: to testers first, then to everyone. OTA Ready shows your
device's ID (NDUID) under Device Details if you are asked for it.

**Before updating:**
- Remove Harvy Tao's "Chinese Patch & IME" first: the update replaces the system files it
  patched, so Pinyin input would stop working and the pack could no longer be removed or
  reinstalled cleanly.
- The update needs about 76 MB free on the system partition. Devices with many system
  patches or packages (Qt5 and its SDK, for one) have less; System Updates says so if
  there is not enough room, and nothing is changed.
- Only the HP TouchPad (Wi-Fi) is offered this update. The 4G/AT&T TouchPad's update is
  not ready yet.

**Fixed by the update:** 3.1.0's Full Erase left no ringtones or wallpapers (issue #14).

---

# webOS CE 3.1.0 — Release Notes

**Release — BUILDMARK 600070** (2026-09-03)

A Doctor to restore/update the **HP TouchPad** to webOS 3.1.0 Community Edition. This was built by repacking the OEM HP webOS 3.0.5 Doctor with 14 years of community work baked directly into the rootfs. Flashing it wipes the device, exactly like the OEM Doctor.

Two images ship. Flash the one that matches your device — they are *not* interchangeable.

| | TouchPad Wi-Fi (`topaz`) | TouchPad 4G / AT&T (`topaz4g`) |
|---|---|---|
| Asset | `webosdoctorp310hstnh-ce-600070.jar` | `webosdoctorp310hstnhatt-ce-600071.jar` |
| BUILDMARK | 600070 | 600071 |
| Size | 242,920,348 bytes (232 MB) | 304,001,097 bytes (290 MB) |
| md5 | `d804b15312428e29172e27a17a7493f1` | `2685615b097d923d6844dbfd01d58aa4` |

Verify before flashing:

```
sha256sum webosdoctorp310hstnh-ce-600070.jar
392f2122e3bd95f6f6b4f89acff2e8038508746a6fdeac7f4c5716834178e65a

sha256sum webosdoctorp310hstnhatt-ce-600071.jar
12514f5f0569fbc7dec784476709f4036f10dd23dd134b5fb98a338af837f621
```

*Nothing was rebuilt to make this a release.* The Wi-Fi asset is the final release candidate under its final name: byte-identical to both `webosdoctorp310hstnh-ce-600070-frc.jar` and the `...-600070.jar` every test below was run against — same size, same sha256 — so every result carries over unchanged. No new issues were found during the candidate soak.

**The AT&T image is a separate build, not a variant flag.** HP shipped the 4G TouchPad with its own Doctor, so CE's is repacked from `webosdoctorp305hstnhatt.jar` the same way the Wi-Fi image is repacked from `...wifi.jar`. It carries its own BUILDMARK because it is a separate repack of a different input, not because it contains different CE work. Flashed and tested on AT&T hardware on 2026-08-31: **90 PASS / 0 FAIL**, the same suite and the same score as the Wi-Fi run. Full account in **[Docs/ATT-VARIANT.md](Docs/ATT-VARIANT.md)**.

**The asset name changed** during the candidate series. Earlier candidates were `webosdoctorp305hstnh-3.1CE-<mark>.jar`, carrying HP's `p305` product code for the 3.0.5 Doctor this is repacked from. This is 3.1.0, so it is named for what it is. The input JARs keep their own names — those are HP's files.

*(RC3 was 600067, 2026-08-29, sha256 `eadd365f…`; RC2 was 600056, 2026-08-23, sha256 `cea207df…`; RC1 was 600024.)*

---

## What's in it

**Modern TLS everywhere.** OpenSSL 1.1.1w stacks for the browser, app WebKit, download manager and mail, so HTTPS sites and mail servers work again. Current Mozilla root certificates (190), with expired ones dropped.

**LunaCE launcher** — app groups, tabs, wave launcher, gestures, and a small default keyboard. LunaCE's Tweaks definitions ship pre-seeded (inert until you install Tweaks from Preware).

**Community sign-in.** First-use runs the webOS Archive account flow instead of HP's dead activation servers, and **account setup is skippable**.

**Pre-installed, baked into the image** — no first-boot installs, no postinsts: Preware 1.9.19, Govnah 1.3.9, App Catalog 6.1.2923, Maps 4.0.1, USB Settings, BT Gamepad support, and the Synergy Revival shared runtime. Preware knows they are installed and offers Preware feeds out of the box.

**Community core apps** — Accounts 3.1.1 (with a Synergy Accounts grouping and a Delete Account Data page), Contacts, Messaging, Phone, and the supporting frameworks.

**Synergy Revival** — the modernised libpurple 2.14 IM runtime, with the dead Skype / Yahoo / legacy-Google stacks retired.

**Hardware and platform fixes** — UberKernel 3.0.5-93, Bluetooth gamepads and mice, USB OTG/power/mass-storage, Bluetooth hands-free, extra media codecs (opus/ogg/vpx/matroska/speex), a slim Thai font, and working connectivity detection (the old check pointed at dead HP servers and demanded a hotspot login on ordinary Wi-Fi).

**Identity** — Device Info reports **webOS CE 3.1.0**, and apps see a clean `3.1.0` platform version. Developer mode is on out of the box and stays on.

**Removed** — Kindle, Facebook and YouTube preloads.

---

## New in 600070

Two additions on top of RC3, both small in surface and deliberately so — the rootfs is frozen for the life of this release, so late changes were limited to what could be fully verified.

**Device Info no longer says "HP webOS Account".** There is no HP account in CE — first use creates a webOS Archive community account — so the heading over the account row, and the same phrase in the full-erase confirmation, named something that does not exist. Now both read "webOS Account", in all five shipped languages (`webOS-Konto`, `Compte webOS`, `Cuenta de webOS`, `Account webOS`). The app's separate "HP webOS demo" strings are a different, retail feature and are untouched.

**A signing key for future updates is now in the image.** This is the only over-the-air component here, and it is worth being precise about what it is and is not.

*What shipped:* a public key at `/usr/share/ce-ota/keys/ce-ota-signing.pub` and a small verifier, `/usr/bin/ce-ota-verify`. That is all.

*What did not ship:* any update client. Nothing checks for updates, nothing contacts a server, and nothing on the device will install anything on its own. There is no update to fetch yet.

*Why it is here at all,* given the client is not: a trust root cannot be delivered over the channel it exists to protect. If the key arrived in a future update, that update would itself be unauthenticated — which is the exact problem the key is meant to solve. So the key has to be in the image a device is *flashed* with, or it is worth nothing. Everything else can come later, over Preware, and be authenticated by this key.

The verifier deliberately uses the device's original 2009 OpenSSL rather than the modern TLS stack CE adds, so it works identically on stock webOS 3.0.5 and on CE — a device does not need the modern crypto it might be installing in order to check the signature on it.

Verified on the flashed image with the real offline key: a signed manifest verifies, and a single flipped byte, a truncated signature, or the wrong key are all refused. Design notes are in `Docs/OTA-STRATEGY.md` §5.

---

## New in RC3 (600067)

Everything in RC2, plus:

**The power menu's Shut Down actually shuts down.** It rebooted instead, on every CE build since 600011. `/sbin/halt` and `/sbin/poweroff` are symlinks to `/sbin/reboot`, which picks its action from `basename(argv[0])`; a diagnostic shim we had wrapped around that name could not preserve argv[0], so every power-off — the menu, and critical-battery shutdown — came back as a reboot. The shim is gone and the test suite now asserts those four names stay unwrapped.

**Preware's package service no longer loses its upstart job.** Two separate faults, both fixed in Preware itself and rebuilt from source for this image:

* Its postinst copied the upstart job *into* the watched directory, so upstart could read it half-written and end up with no valid job — Preware then had no backend until you rebooted. It now writes to a temp path and renames it in.
* Its service returned success when it could **not** take the D-Bus name, which upstart read as a clean exit and respawned instantly — eleven times in a second, tripping the respawn limit and parking the job. Preware kept answering, so this hid for years, but a Luna Restart in that state can freeze the device. It now pauses and exits non-zero, so a name conflict is a paced retry.

Verified across five consecutive reboots with a five-minute soak each: the job stayed resident every time and the fault never fired.

**A half-wiped app store is now repaired instead of hanging the boot.** If the Doctor's app-deletion stage hits a read-only `/media/internal` — a dirty VFAT volume, typically after a force-reboot into recovery — it fails every removal, **reports the flash successful anyway**, and the device boots with no `/media/cryptofs/apps`. Every preload then fails and retries forever on the pulsing logo. First boot now rebuilds that directory and says so in the log. *After any flash, check the Doctor's log for `AppDeletion: removed the appDirectory` and for `Read-only file system` — its success message does not distinguish them.*

**Backup and Restore 3.1.1.** Three fixes:

* Restores no longer read the wrong manifest. The on-device cache was reconciled by *name*, and names are not unique — a stale manifest from an earlier restore could shadow the real one, which once turned a 115-package restore into six files and reported success. The target is now the source of truth for content.
* Scheduled backups no longer grow without bound. Each run re-archived every app and `tar czf` stamps the creation time into the gzip header, so byte-identical content hashed differently every time and the content-addressed store kept a full copy per run. Measured on a real device: six copies of one 295 MB game across four days, `/media/internal` at 100%, backups then failing with ENOSPC. Verified fixed on hardware: a repeat backup covering 1.6 GB of content added **3 MB** and not one object over 1 MB. **Upgrading costs one large backup:** the copies already in your store were written by the old code and cannot be matched, so the first backup after updating stores everything once more (1.57 GB on the test device). Every run after that is small.
* A failed backup no longer leaks. Files are stored as the run goes and the manifest is written last, so a run that died left full-size files nothing referenced — and only the success path purged.

**Local media opens in the media apps again** — with Atlas 0.9.12, released alongside. Atlas claimed every `file://` URL, which outranks mime and extension handlers, so photos, videos and music opened in the browser.

**Cosmetic.** Preware's baked-in package descriptions read `(Pre-loaded)` instead of `(baked into webOS CE)`, and the Doctor window no longer says `HP(R)`.

---

## New in RC2 (600056)

**Backup and Restore actually works.** The stock Backup app was a UI over Palm's retired servers; it is replaced by an on-device backup writing content-addressed backups to `/media/internal/webos-backups`, and it is the supported way to carry data from webOS 3.0.5 onto CE. Verified end to end: a 115-package backup from a 3.0.5 device restored onto CE with **102 apps reinstalled and none failed**, all 11 of their services registered and reachable on the bus after the reboot, and a receipt naming everything it could not put back and why. The largest app in that set was a 296MB archive.

Backup is still a **best-effort** feature — it restores applications and their data, not Preware patches, and one package in that run was never captured at backup time. See `BACKUP-RESTORE.md` before moving a backup between devices: the manifest has to travel with it, and a stale one will shadow the real backup.

**Accounts** — the Settings → Accounts list shows a single SYNERGY ACCOUNTS group again, rather than groups nested inside a group.

**A boot-time crash is gone.** On a Wi-Fi TouchPad the stock WAN daemon respawn-thrashed until upstart stopped it, and jobs starting in that same moment died with SIGSEGV. Harmless in effect — the affected jobs had already done their work — but it produced a crash report on every boot and every Luna Restart. See `Docs/4G-TOUCHPAD.md`.

**Preware reports CE's baked packages honestly**, including the TLS and root-certificate updates, so it no longer offers them as fresh installs and a 3.0.5 restore no longer copies their leftovers onto the device.

## Fixed since the 600023 candidate

- **Luna Restart no longer freezes the device.** Restoring `respawn` on Preware's ipkgservice keeps it resident, so the power-menu restart doesn't have to launch it on demand from inside the UI process — the launch that used to block.

## Fixed since 600020

- **App Catalog is now the community build** (6.1.2901 at the time; 6.1.2923 ships in 600070). A stock staged catalog ipk was being installed over it at first boot, so earlier builds silently ran the old 5.0.2900.
- **Synergy runtime seeds reliably.** A blocking `initctl` call could stall the seeding job indefinitely, leaving the IM transport unable to start.
- **Preware has its feeds immediately after setup**, seeded from Preware's own postinst rather than a hand-maintained copy — so the version-specific feeds that have no 3.1 content ship correctly disabled instead of failing on every update.

---

## How this release was tested

Numbers, so you can judge the coverage rather than take "tested" on faith. Everything below was measured on the exact bytes being released — the promotion from candidate to release changed the filename and nothing else.

**Automated: 90 checks, 0 failures — on two different TouchPads.** The first fully clean runs of the 3.1 series, with nothing downgraded by judgement. They cover identity, first-boot seeding, the core apps, the Synergy runtime, Preware's package state, the un-baking of App Catalog and Maps, Exhibition, search, storage, and both additions above. Kept in `scripts/results-600070.txt` and `scripts/results-600070-device2.txt`; the suite itself is `scripts/ce-test-full.sh`, so you can re-run it on your own device.

**The AT&T image ran the same suite on AT&T hardware: 90 checks, 0 failures** (2026-08-31, `scripts/results-600071-att.txt`), against a stock AT&T baseline captured first so the comparison is with that device's own OEM state rather than the Wi-Fi one. The flash log is kept as `scripts/doctor-600071-att.log`.

**Two independent flashes, two OOBE languages.** The second device was flashed from scratch and set up in French (Canada), which exercises the nested locale-override path rather than the plain one. Device Info reads "Compte webOS" there and "webOS-Konto" after a German factory reset on the first device — the account-label change verified in both languages on real hardware, not just in the image.

**A full factory reset returns the device to webOS CE 3.1.0**, with setup in another language, and the app store intact.

**Reboot soak: 7 consecutive reboots, 112 checks, 0 failures.** Five minutes of running time after each boot, then the full check set — ipkgservice resident with its job file intact, no respawn thrash, no crash reports, and the IM transport, Synergy mount and download manager all back up. This exists because the fault that dogged RC2 fired roughly one boot in six, so a single clean boot proves very little; the gate is repeated boots rather than one lucky one. *(`scripts/ce-reboot-soak.sh`, results in `scripts/results-600070-soak.txt`.)*

**A week of community use before promotion.** The final candidate was in the hands of testers on their own devices for a week. No show-stopper was reported, and no new issue was found — which is why it ships unchanged rather than respun.

**The flash itself is checked, not assumed.** The Doctor reports success whether or not its app-deletion stage worked, so both markers are read from its log afterwards, and the device is separately asked whether its app store had to be repaired on first boot. Both were clean here.

**Restore onto the flashed image:** a 43-package backup restored with zero errors and nothing skipped, and after the reboot all 11 restored services were reachable on the bus — including apps whose own services came back with them, which is the case that used to restore as a tile that launches and does nothing.

What is *not* covered: the remaining hands-on items — Bluetooth pairing, an IM account actually connecting, and the Exhibition faces — are tracked in `Docs/TEST-PLAN.md` rather than claimed here. Bus-reachable proves a service launched, not that its UI works.

---

## Known issues

Full detail, with evidence and what a fix would have to do, is in **[KNOWN-ISSUES.md](KNOWN-ISSUES.md)**. The ones a tester will actually meet:

- ~~**Preware may not work until you reboot once after setup.**~~ **Fixed in RC3** — both causes fixed in Preware itself and verified across five reboots. No post-setup reboot is needed any more.
- **Restoring a backup taken on another device?** The cause is fixed in RC3 (the cache is now reconciled on content, not on name), but a genuine cross-device collision has not yet been restored through on hardware, so the workaround in `BACKUP-RESTORE.md` stands until it has.
- **No post-setup account manager yet.** The sign-in app is first-use only in this build; managing your account afterwards will come as a separate App Catalog app.
- **No on-device rollback.** Recovery is re-Doctoring — by design. This is also why the update key above matters: the rootfs cannot be repaired in place, so anything frozen into it has to be right the first time.
- **A crash report may appear after first-time setup.** Roughly one setup in three, the first-use process faults as it hands off to the launcher. It is already on its way out when it happens: setup completes, the launcher comes up, and the device is fine. Nothing is lost and no action is needed. A factory reset can produce one too, so a report on a previously clean device is not evidence of a bad flash. Detail in KNOWN-ISSUES.md #4.
- **No over-the-air updates yet.** The image carries the key that will authenticate them, and nothing else — see "New in 600070". Updates will arrive through Preware when the client is ready.

## Notes for flashing

- The Doctor is **unsigned** and the OEM flash gate is patched off, so your Java runtime may warn about the missing signature.
- The first boot does housekeeping for about 90 seconds after setup completes (seeding the IM runtime and Preware's feeds). If the IM transport or Preware feeds look absent immediately after setup, give it a minute.
- Logs worth capturing for any report: `/var/log/messages` and `/var/log/ce-*.log`. (`/var/log/reboot-tripwire.log` is gone: the tripwire that wrote it was retired after it was found to turn every power-off into a reboot — see KNOWN-ISSUES #8.)
