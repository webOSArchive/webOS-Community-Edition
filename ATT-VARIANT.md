# The AT&T TouchPad, and the CE build for it

`webosdoctorp310hstnhatt-ce-600071.jar` is the CE 3.1.0 Doctor for the AT&T
TouchPad, built from HP's `webosdoctorp305hstnhatt.jar` the same way the Wi-Fi
image is built from `...wifi.jar`. Flashed and tested on hardware 2026-08-31:
**90 PASS / 0 FAIL**, the same score the Wi-Fi 600070 run gets.

**3.2.0:** the AT&T build is `webosdoctorp320hstnhatt-ce-600122.jar` (BUILDMARK
600122); see §10. Sections 1-9 describe the 3.1.0 build, 600071.

Read `Docs/4G-TOUCHPAD.md` first — it records what the Wi-Fi image assumes about a
radio. This doc is what happened when we actually built for one.

## The device

HP marketed it as 4G. The device's own NVRAM tokens disagree:

```
ProductName=TOPAZ_3G      PRODoID=HSTNH-I30C     ProductSKU=FB354UA-EVT4
DMCARRIER=ATT             HWoRev=E4              FlashSize=32G
RadioType=1               MODEM=Y
```

The modem is an Ericsson module (`pmmodeminterfacelayer 6260 UMTS SINGLE`),
which matters in §4.

## 1. The two Doctors are the same build

Measured, not assumed. HP built `Nova-HP-Topaz` (BUILDMARK 528667) and
`Nova-ATT-Topaz` (528668) **one minute apart** from the same source:

| | Wi-Fi JAR | AT&T JAR |
|---|---|---|
| all 254 Java classes | **byte-identical** | **byte-identical** |
| `topaz.xml` (partitions + LVM) | identical | identical |
| `boot-topaz.bin` | identical | identical |
| rootfs members | 19085 | 19085, same names |
| rootfs files differing | — | 172, all rebuild noise |
| `installer.xml` | `RootFilesystem min=466386944` | `499859456` |
| customization | `hp.tar` (21MB) | `att.tar` (52MB) |
| `topazumtsfw.tar` | **0 bytes** (placeholder) | **30,283,141 bytes** |
| `languagePicker.properties` | 10 languages | en_US, es_US only |

Those 172 differing files are rebuilt `.so`s at identical sizes, gzip-stamped
tarballs, repacked preload ipks and the ipkg db. **Nothing CE patches is among
them** — `LunaSysMgr`, `jail_pdk.conf`, every `/etc/event.d` job CE edits,
`BrowserServer`, `LunaDownloadMgr`, `mojomail-imap` and `media-pipeline` are all
byte-identical between the two. The LunaCE binary drops in unchanged.

So an AT&T build is not a fork. It is the same bake against the other JAR.

## 2. How to build it

```sh
CE_VARIANT=att python3 build/full-ce/bake.py
CE_VARIANT=att build/build-ce-doctor.sh "$PWD/build/overlays/full-ce-att"
```

`CE_VARIANT` (default `hp`) selects three things, in `bake.py`'s `VARIANTS`
table: the OEM JAR (project root), the work dir (`build/work-att/`) and the
overlay trees (`overlays/full-ce-att`, `overlays/community-firstuse-att`). Each
variant keeps its own generated output so the two never overwrite each other.
`make-overlay.sh` takes `CE_ROOTFS_TGZ`/`CE_CF_OVERLAY` from bake.

**The att overlays are not tracked in git.** `overlays/full-ce` is committed
generated output; its att counterparts are gitignored instead — ~117MB for a
variant very few people build. So there is no committed tree to go stale, and
no `inputs_sha256` freshness question: run the bake above before every repack.
The build IS reproducible without them — `manifests/600071.json` pins the OEM
JAR hash, every consumed ipk, the LunaCE binary and `SOURCE_DATE_EPOCH`.

BUILDMARK stays a **single monotonic counter** across variants — a mark must
identify one image. The manifest records `"variant"`, and `build-ce-doctor.sh`
refuses to repack an overlay whose manifest names a different one (without that
check, a shared BUILDMARK would let an hp repack validate against an att
manifest and ship silently mismatched).

**Re-bake per variant; do not repack the hp overlay onto the att JAR.** Six CE
outputs derive from stock files that differ between the two (`calinks.tgz`,
`libWebKitLuna.so`, `libgstogg.so`, the Clock and Photos preload ipks,
`palm-build-info`). All six are CE-modified rather than stock copies, so it is
not a correctness bug today — but deriving them from the right stock costs
nothing. `palm-build-info` handles itself: bake rewrites only
PRODUCT_VERSION_STRING/BUILDTIME/BUILDMARK, so **BUILDNAME stays
`Nova-ATT-Topaz`** and the OTA fingerprint's model gate keeps telling the truth.

## 3. The one real variant bug (fixed)

CE's default wallpaper never applied on an AT&T image, because two generated
jobs hardcoded the factory wallpaper's name:

- `ce-firstboot-tweaks` — `grep -q 'wallpapers/01.jpg'` before sed'ing
  `customization.json` to a CE wallpaper. On att.tar the grep fails, so the
  file is never patched.
- `ce-default-wallpaper` — `grep -q '"01.jpg"'` against the live pref to decide
  "still factory". Off-variant it reads "the user chose their own", sets its
  once-per-flash flag and never runs again.

**hp.tar sets 01.jpg. att.tar sets 02.jpg.** Both jobs now derive the name from
`/usr/lib/luna/customization/customization.json` at runtime:

```sh
FACT=$(sed -n 's|.*/media/internal/wallpapers/\([^"]*\)".*|\1|p' "$CUSTO" | head -1)
```

Verified against hp.tar's payload (`01.jpg`), att.tar's (`02.jpg`), and by
running the derivation on the device with its own busybox sed before the flash
(`02.jpg`, while the live pref was `03.jpg` — a user choice the fixed logic
correctly leaves alone). After the flash: pref `22.jpg`, `customization.json`
rewritten to `22.jpg`, and `ce-default-wallpaper.log` reading *"wallpaper is
already 22.jpg -- nothing to do"* — i.e. tweaks won the race and the definitive
job correctly found nothing to do.

This is behaviour-identical on hp (FACT resolves to `01.jpg`), so the change is
safe for both and folds into the next hp bake.

## 4. The modem update is a no-op on this hardware

```
Modem Updater: Modem Update Started
Modem Updater: ERROR: Unable to get firmware for modem type ERICSSON, cannot flash modem.
Finished: Modem Updater
```

`installer.xml` maps firmware per modem type — `umts="topazumtsfw.tar"`,
`world="topazumtsfw-row.tar"`, and `cdma`/`ericsson`/`sierra`/`att` all **empty**.
This unit's modem enumerates as ERICSSON, so the 30MB `topazumtsfw.tar` goes
unused.

That is stock HP behaviour, not a CE regression: we pass `installer.xml` and the
firmware tar through byte-identical, so HP's own AT&T Doctor skips the modem on
this device too. The passthrough is still correct for units that do carry a
Qualcomm UMTS modem. Practical effect: **no modem risk when flashing CE here.**

## 5. What the AT&T customization brings, and how CE copes

`att.tar` installs 13 ipks into the rootfs at flash time, after CE's rootfs
lands: `sweatshop-attwireless-topaz`, `minidm` + `com.palm.app.minidm`,
`attwisprd`, `passthrud`, `smartcom.acmthinclient` (+ its service),
`amazonservice`, `topazumtsfw-att`, `crotest-images`, `audiod-config-non-eu`,
`palmcustomizationinfo-att`.

Three CE jobs touch this territory and all three are payload-agnostic:

- **`ce-remove-preloads`** — att.tar stages the *same three* preloads as hp.tar
  (kindle, enyo-facebook, youtube), so the id list needed no change. Verified
  absent post-flash.
- **`ce-reclaim-customization-media`** — path-based, not keyed on the sweatshop
  package name. Verified `ringtones: staged=40 live=40`, then freed
  62348K → 91444K. Root settles at **84%, 89.3M free**.
- **Wallpaper numbering** — att.tar ships `01-11.jpg`, hp.tar the same range,
  CE's start at `12.jpg`. No collision on either payload, which is why CE's
  files survive sweatshop extracting over the same tree.

**`MiniDM` was the watch item and it behaved.** Its job is
`exec /usr/bin/MiniDM` + `respawn`, aimed at long-dead AT&T device-management
servers — the exact shape that made PmWanDaemon thrash upstart into the
`job_run_process` SIGSEGV. On this flash it is a single stable process. Counters
over the whole first boot: **0** respawn-limit hits, **0** `job_run_process`
SIGSEGVs, **0** segfaults, **0** rdxd reports. (`passthrud` is structurally safe
— conditional exec, no `respawn`.)

Worth re-checking on a device that has ever had AT&T service, where MiniDM may
have state to act on.

## 6. The radio, under CE's gate

`Docs/4G-TOUCHPAD.md` predicted the PmWanDaemon pre-start gate would pass on a radio
device and was explicit that it was untested. It passes:

```
tokens: RadioType=1 MODEM=Y
/usr/bin/pmmodeminterfacelayer 6260 UMTS SINGLE 3.0
/usr/bin/PmWsfDaemon -c /etc/til.d/tilwsf.conf
PmWsfDaemon -c /etc/wan.d/wan.conf      <- the process the gate guards
/usr/bin/PmModemQxdmLogger
```

`connectionmanager` reports a healthy stack: Wi-Fi connected,
`wan: {"state":"disconnected"}` (no SIM service), no errors. The gate needed no
variant-specific change, exactly as written down a release earlier.

## 7. Testing environment: the TouchPad is four USB devices

This cost an hour and a genuine "did we brick it?", so it is written down.

A TouchPad presents **different USB vendor/product IDs in different modes**. A
VM that asks where to attach a *new* device will re-prompt at every transition:

| VID:PID | Product string | Mode |
|---|---|---|
| `0830:8071` | `Palm` | bootie / bootloader (recovery) |
| `0830:8072` | `webOS-device` | novacom — installer ramdisk, and the booted OS |
| `0830:8074` | `webOS-device` | transient, seen briefly during boot |
| `05c6:9008` | `QHSUSB_DLOAD` | Qualcomm ROM download mode |

Observed on the 600071 flash: the device left the bus at **09:19:17 — the same
second as `Flash End time (Success)`** — and returned 9s later as `05c6:9008`,
a different vendor *and* product ID, i.e. a new device to the hypervisor. The
host prompted for where to attach it. The Doctor never logged
`Reset call complete` or `Reboot call complete` (both live in `FlasherThread`
alongside `resetDevice`/`rebootDeviceWithBootie`), so the post-flash restart was
never issued or never completed, and the tablet sat in ROM download mode looking
dead. Holding the hardware reset keys recovered it, and it booted the flashed
image normally.

The absence of the reset marker is meaningful rather than a logging artifact:
the same class of message logs on the way in — `device believed to be in
bootloader, will load ramdisk` is the other branch of that decision, and it is
in the log at line 109.

**Before flashing in a VM, pre-authorize all four IDs.** If a flash ends with a
dark tablet: hold the hardware reset keys, expect a slow first boot (the
encrypted volumes are created and formatted before LunaSysMgr starts, so the
logo does not pulse for several minutes), and check `Flash End time (Success)`
plus the on-device `ROM Verifyer` line before assuming the image is at fault.

Not filed in KNOWN-ISSUES: on this evidence it is an environment artifact, not
an image defect. Closing it for good means one re-flash with the IDs
pre-authorized, confirming `Reset call complete` appears and the device reboots
itself.

## 8. Deliberately not changed

**The Doctor's language picker.** The AT&T JAR offers only en_US and es_US where
the Wi-Fi one offers 10. Since the rootfs is identical, all 10 locales exist on
the device and widening the list is a two-line change — but `att.tar` ships only
`loc_customization_en_US.json` and `loc_customization_es_US.json`, so an
unlisted locale would leave the customization strings (bookmarks, contacts)
falling back. The restriction is not arbitrary. Left alone pending a decision.

## 9. Test evidence

- `scripts/results-600071-att.txt` — `ce-test-full.sh` (90 PASS / 0 FAIL) plus
  an appended ATT-variant section (radio, carrier services, thrash counters,
  wallpaper, wan, space)
- `scripts/results-600071-att-stockbaseline.txt` — the stock AT&T cryptofs
  lineage captured before the flash (enyo-findapps 3.0.3900, no Maps), which the
  flash would have made unrecoverable
- `scripts/doctor-600071-att.log` — the full flash log. `Read-only file system`
  = 0, `AppDeletion: removed the appDirectory` present, and the device's own
  `ROM Verifyer: /usr/sbin/integcheck IPKG VERIFICATION SUCCEEDED`
- `build/full-ce/manifests/600071.json` — `"variant": "att"`, OEM JAR hash,
  output JAR hash

Boot-log noise, all pre-existing and none AT&T-specific: `imtransport` pre-start
declining once before starting (the documented unseeded-interpreter race),
`woce-backupd` exiting once then coming up, and `tempdb` terminating with status
2 (the open `tempdb-*` replay follow-up). All three settle.

## 10. 3.2.0: BUILDMARK 600122

`webosdoctorp320hstnhatt-ce-600122.jar` is the CE 3.2.0 Doctor for the AT&T
TouchPad: `CE_VARIANT=att` of the same tree as the Wi-Fi release, 600121
(commit `5189314`; `build/full-ce/manifests/600122.json`). `att.tar` is
byte-identical to 600071's.

**The Doctor skips the modem.** §4's passthrough is gone: for `att`, `bake.py`
writes an `installer.xml` that maps no modem firmware and makes
`topazumtsfw.tar` a 0-byte placeholder, as in the Wi-Fi JAR. `ModemUpdateStage`
then takes the path HP's own AT&T Doctor already took on this ERICSSON unit:
`Unable to get firmware for modem type ERICSSON`, then `Finished`. The radio
software on the device is unchanged.

**Proven on hardware (2026-11-25):**

- **OTA, 600071 -> 600122**, through production Install Now on the AT&T
  TouchPad: finished and verified on its own (`Docs/OTA-HANDOFF.md`).
- **Fresh flash of 600122**: the Doctor skipped the modem as above, and
  `ce-test-full.sh` scored **174 PASS / 0 FAIL** (`scripts/results-600122.txt`,
  commit `9a7cce9`).

**Headroom on `/`.** The 071 -> 122 update grows `/` by about 58 MB. The tested
device went from 89 MB to **31 MB free (94%)**; Wi-Fi TouchPads end at 89% with
about 62 MB. A later AT&T OTA must fit in what is left (growth + largest file +
8 MB) or free room first, such as the 28 MB of staged customization media
(KNOWN-ISSUES.md, Docs/OTA-HANDOFF.md). A Doctor flash resets `/` to the image's
own size.
