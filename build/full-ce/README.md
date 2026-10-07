# Full CE overlay

> The current release and what ships in it:
> **[../../RELEASE-NOTES.md](../../RELEASE-NOTES.md)** ·
> verification status: **[../../Docs/TEST-PLAN.md](../../Docs/TEST-PLAN.md)**

The complete CE Doctor: the community first-use swap **plus** every CE
component, all **baked into the rootfs at final paths at build time**. Nothing
is staged for first-boot installation — the device is fully installed the
moment the flash lays down. `bake.py` generates `../overlays/full-ce/`; then
`../build-ce-doctor.sh overlays/full-ce` produces the Doctor JAR.

```
python3 bake.py
../build-ce-doctor.sh overlays/full-ce      # -> out/webosdoctorp305hstnh-3.1CE-<BUILDMARK>.jar
```

## Inputs: `AddToImage/` (project root)

The single statement of intent for image contents. `bake.py` resolves every
ipk by package-name prefix, highest version (natural sort of the filename —
mtime was used before, but git doesn't preserve mtimes, so a fresh clone made
the pick arbitrary). A corrected rebuild reusing a version string still wins:
it has the same filename, so dropping it in replaces the old file outright.

- **`PatchOrReplace/`** — ipks that fix or replace an existing system
  component: the TLS tiers (browser/downloadmgr/luna/mail), uber-kernel,
  App Catalog, Maps, help-redirect, rootcertsupdate, **woce-backup** (takes over
  the stock `com.palm.app.backup` id — see the Backup note under "How it bakes"),
  curl/ntpdate (consumed by
  the community-firstuse layer), the language-variant patches (`…---xx_`
  suffix = language, no suffix = english), and the community **core-apps
  suite** of `*-overwrite` ipks (accounts, contacts, messaging, phone,
  chatthreader, service.accounts, contacts.linker, contacts.plugin.messaging,
  enyo-accounts, enyo-contactsui, messaging.library, luna-systemui). Those are
  replayed generically from their staged metadata: `dest.txt` names the
  replaced dir, `payload.tar.gz` (whole-dir) or `files.txt`+`files.tar.gz`
  (surgical) carries the files, `preserve.txt` paths keep stock content,
  `symlinks.txt` links are recreated, and `db8-kinds/`/`db8-permissions/`
  files replace their stock `/etc/palm/db` counterparts wherever those
  actually live (several sit in per-owner subdirs). A dest under
  `/media/cryptofs/apps/` (messaging) is baked as a **rootfs** app
  instead and the stock staged ipk subdir under `/usr/palm/ipkgs/` is removed.
  Contacts used to come this way too; since 600074 it is CE's own 3.2.0 from
  `apps/com.palm.app.contacts` (tier 15g), and the account templates, accounts
  library strings and contacts framework come from `system/` (tier 11d).
  `org.webosarchive.tls-updates` is a meta-package and is ignored.
  Also here: **`com.palm.synergy.generic`** (Synergy Revival shared runtime).
  Its rootfs-overwrite tree bakes at real paths (imlibpurpletransport, the
  `/var` launch scripts, libpurple 2.14 + plugins, db8 kinds/permissions/
  activities, ls2 roles, `_cloudcore`); cloud-auth/docviewer bake as rootfs
  apps; the **cryptofs-only** pieces (synergy-glibc — the transport's
  hardcoded ELF interpreter —, synergy-runtime and the purple plugins that
  `imwrap.sh` bind-mounts over `/usr/lib` — a contract Preware-installed
  connectors rely on) ship under `/usr/palm/ce-seed/cryptofs/` and
  `ce-cryptofs-seed` copies them into `/media/cryptofs` once per flash. Its
  device-setup fixes are replayed at build time (PmBtEngine BT-HFG and
  libWebKitLuna webm-MIME byte patches, mediastream webm reroute, Thai font,
  gst codec plugins, bt-a2dp-fix job, db8-clean tool), the defunct
  skype/legacy-IM/google-legacy stacks become image removals, and the stock
  staged QuickOffice/Photos ipks are repacked with the integration patches
  applied (webOS ipkg doesn't verify ipk signatures). The baked `imtransport`
  job gains a pre-start gate that waits for the seeded glibc (cryptofs mounts
  late in boot; without it the respawn limit burns on doomed launches).
- **`NewApps/`** — brand-new apps to pre-install: Preware, Govnah,
  USB Settings, BT gamepad. Preware and Govnah also get an ipkg **status
  stanza seeded** by the ipkgservice job's pre-start (idempotent, every boot)
  so Preware shows them as installed at the baked version; USB Settings and
  BT gamepad deliberately stay unlisted.
- **`LunaCE-Tweaks/`** — Tweaks-framework preference definitions for LunaCE's
  extra features (mini cards, gestures, wave launcher, …). Seeded into the
  cryptofs `org.webosinternals.tweaks.prefs` preferences dir by
  `ce-cryptofs-seed`; inert until the user installs Tweaks via Preware.
- **`OOBE/`** — the firstuse replacement: the community webosaccount ipk (full
  app + service source). `community-firstuse/make-overlay.sh` lays it over
  `com.palm.app.firstuse` / `com.palm.service.palmprofile` (every
  `appinfo.json` excluded — the stock firstuse identity must survive) and
  applies the `oobe/` deltas on top (the ipk is the standalone build; the
  deltas restore the Wi-Fi join, OOBE card list, and
  markFirstUseDone+reboot completion).
- **`Media-Internal/`** — static content for `/media/internal` (wallpapers,
  ringtones). Delivered via the stock customization `copy_binaries` mechanism
  (the media partition survives flashes, so first-boot copy is the only
  route — the same one HP used). The default wallpaper is `22.png` (falling back
  to a `default-wallpaper.*` file, then the alphabetically-first image); a
  boot job sets it via systemservice and verifies it stuck.

## How it bakes

Each ipk's postinst file-effects are **replayed on the build host**: payloads
extracted to their final paths, sed/awk edits applied to pristine stock files,
binaries relocated from `/var/usr/sbin` to `/usr/sbin`, services registered
statically. The harness regenerates the affected packages' md5sums and
integchecks the result (0 missing / 0 failed / 0 added, verified by the
on-device ROM Verifyer at flash time).

Tier order matters only for the ssl11 stack (browser first). Highlights:

- **TLS tiers + LunaCE + kernel + version string** — unchanged design, see
  bake.py comments. LunaCE binary comes from the sibling `LunaCE` repo
  (`bin/LunaSysMgr-LunaCE-topaz`) and includes the minimal-mode gesture guard
  (edge taps during firstuse crashed stock LunaCE).
- **rootcertsupdate** — full trust-store replay with host openssl: expired
  stock certs dropped, modern Mozilla roots added, hash links regenerated with
  `-subject_hash_old` (the device's OpenSSL 0.9.8 `-hash`), bundle rebuilt,
  `calinks.tgz` regenerated (certstoreinit rebuilds `/var/ssl` from it).
- **Services (ipkgservice, govnah, usbsettings.service)** — dbus service files
  go in **BOTH** hub dirs: `/usr/share/dbus-1/system-services` (private hub)
  AND `/usr/share/dbus-1/services` (public hub — apps call over the public
  bus; missing there = "Service does not exist"). ls2 roles in
  `/usr/share/ls2/roles/{prv,pub}`, jobs in `/etc/event.d`.
- **Language-aligned patches** — every variant is applied to pristine stock at
  build time (build fails if one doesn't apply); english is the rootfs
  default; all variants ship under `/usr/palm/ce-patches/lang/<lang>/` and a
  boot job aligns the live file to the selected locale.
- **Device Info** — the "Build" row (tap *Version* to toggle it) shows the CE
  **BUILDMARK** instead of `BUILDNUMBER`, which CE leaves at the stock 86 for the
  OTA fingerprint. The mark reaches the app as `com.palm.properties.buildMark`:
  libluna-prefs serves `com.palm.properties.<name>` for every file in
  `/etc/prefs/properties`, so the tier just drops the number there (alongside
  `buildDate`, sliced out of `BUILDTIME`). The app menu also gains **About**, a
  scene dedicating the release to the community and crediting it by name
  (bold = code contributor), subtitled `webOS CE 3.1.0 · Built yyyy-mm-dd`.
  Names and dedication text live
  in `deviceinfo/about/about-assistant.js`; the build refuses to bake while the
  credits still hold the placeholder.
- **Cryptofs app versions** — Photos & Videos and Clock are preload ipks, so
  Device Info shows their own `appinfo.json` version rather than the platform's
  `3.1.0` (LunaSysMgr only substitutes that for trusted Palm apps under `/usr`).
  Both are repacked declaring 3.1 (`3.1.8001` / `3.1.1904`). The ipk filename,
  its control `Version` and the preload manifest stay stock — `app-install`
  decides whether to install by comparing the staged ipk's *filename* version
  against the installed ipkg version, and moving one without the others gives
  you a package that reinstalls every boot.
- **Backup (woce-backup)** — the stock `com.palm.app.backup` is a dead UI over
  `com.palm.service.backup`, which uploaded to Palm's servers and has failed on
  its first real call since they went dark. It is replaced wholesale (same app
  id, so the icon and launcher slot don't move) by woce-backup, which writes
  content-addressed backups to `/media/internal/webos-backups`. Baked at rootfs
  paths rather than staged, because the postinst writes two things that are read
  **once, at boot**, by daemons that start long before it — which is why
  upstream tells you to reboot after the first install, and why CE (no second
  boot) bakes them instead: the `com.palm.backup.privileged` role for the
  helper's private `luna-send` copy (`/usr/bin/woce-lunacall`) into
  `/usr/share/ls2/roles/prv`, and the matching db8 admin grants into
  `/etc/palm/mojodb.conf`. **Two** callers are granted there: that privileged
  identity *and* `com.palm.app.backup.service` itself — as a ROM service it has
  a real private-bus role, so its `com.palm.db/internal/preBackup` call reaches
  db8 directly and comes back `access denied` rather than the `Unknown method`
  that triggers the helper fallback. Its ls2 roles carry `outbound: ["*"]` on
  **both** hubs (the `Triton.prv` template's `outbound: []` blocks
  `com.palm.activitymanager` and hangs the service outright), and it launches
  through `run-js-service-nofork` alongside accountservices. `bake.py` patches
  the helper's `LUNACALL_ROLE` to prefer the baked role: upstream uses that one
  constant both to decide where to write the role and to test whether the
  privileged identity is live, so an unpatched helper would quietly fall back to
  the anonymous stock `luna-send` and every db8 call would fail.
- **PmWanDaemon radio gate** — stock's WAN job starts on `stopped configurator`,
  finds no radio token on a Wi-Fi TouchPad, never reaches its `exec`, exits 0,
  and `respawn` loops it until upstart gives up with *respawning too fast*. That
  limit-stop happens **inside upstart's event handling**, and the jobs spawned
  next in the same tick die with `SIGSEGV` in `job_run_process` — which is why
  `ce-firstboot-tweaks` and `ce-remove-preloads` appeared to be crashing on
  600042/600049/600050. They were not: they were the other jobs on that event.
  A `pre-start` gate applies the job's own radio test as a start condition, so
  with no modem it never reaches `running` and there is nothing to respawn; with
  a modem it behaves exactly as stock. See `../../Docs/4G-TOUCHPAD.md`.
- **Job scripts live outside the job** — every `ce-*` body is written to
  `/usr/palm/ce-seed/jobs/<name>.sh` and the job becomes one `exec sh -e` line.
  This was added chasing the crash above and did **not** fix it (the cause was
  PmWanDaemon), but it is kept: it puts our script sizes back in line with
  stock's, whose largest inline block is 2549 bytes against our former 9255.
  Bodies still run under `sh -e`, so the guard rules are unchanged.
- **De-shadow list is DERIVED** — `baked_ids - staged_preload_ids`, both read
  from the overlay just written, never transcribed. A hand-maintained list had
  left Preware in it after Preware became a preload, which tells the job to
  `rm -rf` the copy the preload just installed; only first-boot ordering had
  been preventing it.
- **ipkg status stanzas — 11, not 3** — Preware shows a package as installed by
  name-matching the cryptofs status file, so CE seeds a stanza for everything it
  bakes: govnah, the Synergy runtime, the Backup app, and the seven patch
  packages whose *effects* are baked (browser/downloadmgr/luna/mail/curl-tls13,
  rootcertsupdate, ntpdate-sync, notifications-advanced-reset-options). Without
  those seven, restoring a webOS 3.0.5 backup puts their cryptofs staging
  directories back — dead payload, and `browser-tls13` carries an `appinfo.json`
  so it can surface as a junk launcher icon.
- **Launcher placement** — `PreferAppKeywordsForAppPlacement` + the
  `wosa-settings` keyword put USB Settings and Govnah on the Settings tab.
- **OOBE completion** — `closeApp` calls `markFirstUseDone()` and LunaSysMgr
  respawns into the normal UI. There is **no reboot**: the first boot is the
  only boot, so anything that used to be repaired by a second boot has to work
  the first time (this is why the CE jobs verify their work before flagging it
  done). The firstuse app is `visible:false` — OOBE only.
- **CE platform tweaks** — `BUILDTIME`/`BUILDMARK` refreshed per build
  (`BUILDMARK` counter file here, CE marks start at 600000);
  PmNetConfigManager's connectivity-probe URL list byte-patched from dead HP
  hosts to live community ones (the spurious hotspot-login fix) plus the enyo
  captiveportal login page repointed; Preware pre-registered as the `.ipk`
  resource handler in `/usr/palm/command-resource-handlers.json`;
  `sysservice.conf [Debug] turnOnNovacomAtStart=true` re-enables developer
  mode every boot (a manual off lasts until reboot); default keyboard size
  seeded to small via `defaultPreferences.txt`
  (`x_palm_virtualkeyboard_settings`).

## First-boot jobs (`/etc/event.d/ce-*`)

Small, idempotent, and only for things that *cannot* be baked (they touch
volumes the Doctor doesn't flash, or depend on the user's OOBE choices):

- `ce-remove-preloads` — deletes the hp.tar-staged Kindle/Facebook/YouTube
  ipks before the customization service can install them.
- `ce-firstboot-tweaks` — seds the default-wallpaper entries in hp.tar's
  `customization.json`, and once per flash removes stale `/media/cryptofs`
  copies of apps this image bakes (cryptofs **survives** Doctor flashes and a
  stale copy shadows the baked app) — the app dir, and also the matching
  `services/<id>.service` and `packages/<id>` dirs, since a leftover cryptofs
  JS service claims the same bus name the baked image now claims statically.
- `ce-default-wallpaper` — the race-proof half of the wallpaper default: on
  the first boot after first use, if the pref is still factory `01.jpg`, set
  ours. User-chosen wallpapers are never touched.
- `ce-language-patches` — aligns the language-variant patched files with the
  selected locale each boot (no-op when they already match).
- `ce-cryptofs-seed` — once per flash, merges `/usr/palm/ce-seed/cryptofs/*`
  into `/media/cryptofs` (Synergy glibc/runtime/plugins + cryptofs app-store additions like the LunaCE tweak definitions);
  every boot, kicks `imtransport` in case it exhausted its respawn limit
  before cryptofs mounted.

Upstart runs these with `sh -e`: a failing command that stands alone (or ends
an AND/OR list) aborts the script, so anything that may legitimately fail wants
`|| true`. Guard forms like `[ -f x ] && exit 0` and `[ ! -d x ] || cmd` are
both safe — `-e` is ignored for non-final commands in a list (verified under
dash and busybox ash; an earlier note here claimed otherwise).

**Overlay freshness.** `build-ce-doctor.sh overlays/full-ce` refuses to repack
when `AddToImage/` (or the LunaCE binary) no longer matches the
`inputs_sha256` recorded in `manifests/<BUILDMARK>.json` — the generated
overlay is tracked in git, so a stale one looks exactly like a fresh one.
Rebake, or set `ALLOW_STALE_OVERLAY=1` to override deliberately.

## Status

Flash-tested end to end on hardware (2026-08-16, four flashes): OOBE in
English and German completes and reboots itself; every baked app and service
works on first boot; trust store, media, launcher placement, wallpaper and
language alignment all verified. Shipping artifact:
`out/webosdoctorp305hstnh-3.1CE-<BUILDMARK>.jar`.

Operational notes: `sync` before `tellbootie recover` (cryptofs lives on the
FAT media partition and a dirty hard reboot can wipe its contents); launch the
Doctor only after the device is already in recovery (a running instance holds
a stale novacomd session across re-enumeration and hangs at the battery
stage — kill and relaunch).
