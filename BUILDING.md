# Building webOS CE: Doctors and OTA packages

This guide is for a developer or an AI agent setting up from scratch. It covers how to turn
HP's TouchPad Doctor into a CE Doctor, test it, and ship it to existing devices as an OTA
update. Each command here was checked against the scripts as of 2026-11-26 (3.2.0,
600121/600122). The scripts are the authority: when this page and a script disagree, trust
the script and fix this page.

Background reading, when you need it:

- [build/README.md](build/README.md): the repack harness and the two patches it makes to
  HP's Doctor.
- [build/full-ce/README.md](build/full-ce/README.md): what the bake puts into the image.
- [Docs/OTA-HANDOFF.md](Docs/OTA-HANDOFF.md): the OTA source of truth, including the
  armed-flash recipe and recovery.

---

## 1. The machine

The project is built on Linux. These tools must be on `PATH`:

| Tool | Used for |
|---|---|
| `python3` (3.9 or later) with **Pillow** | the bake, the harness, the payload generator, the boot-logo tool |
| `openssl` | the bake rebuilds the trust store; the manifest records the version |
| `ar`, `tar`, `gzip`, `patch`, `git`, `sha256sum` | unpacking ipks and applying patches; git also feeds the build manifest |
| `node` | syntax-checks the JavaScript the bake writes. Without it the bake stops, unless you set `CE_SKIP_JS_CHECK=1`, which isn't meant for releases |
| `busybox` | optional. With it, the bake parses its shell jobs as the device's `ash` would. Without it, the bake falls back to `sh -n` |
| Java (any JRE) | **only to run** a Doctor and flash a TouchPad. The build itself doesn't need Java |
| `novacom` | talking to a TouchPad: flashing, `novacom run`, `put` and `get` |

## 2. What lives outside this repo

The bake reads the sibling folders by relative path, so clone them next to this one:

```
~/Projects/
├── webos-doctor-ce/          this repo
├── LunaCE/                   LunaSysMgr; the bake takes bin/LunaSysMgr-LunaCE-topaz
├── webos-update-exploration/ the OTA server, the OTA Ready client, the public signing key
└── (OpenSSL-legacyWebOS/)    fallback only: the curl and TLS ipks normally come from
                              AddToImage/PatchOrReplace/ in this repo
```

### LunaCE

The bake refuses a LunaSysMgr binary unless it is a recorded clean build. Rebuild it with
LunaCE's `cross-build/ship.sh`, which needs that repo's own cross toolchain; see its docs.
That script is the only thing allowed to write `bin/` or the `bin/LunaSysMgr-LunaCE.clean`
record.

### HP's Doctors

These are git-ignored. Put them in the repo root:

| File | sha256 | Builds |
|---|---|---|
| `webosdoctorp305hstnhwifi.jar` | `735f93f8dc7ea9d3ce0d04dba6a8a0d5a2551d790e704376bda49ee1fe55d9ca` | the Wi-Fi TouchPad (`CE_VARIANT=hp`, the default) |
| `webosdoctorp305hstnhatt.jar` | `00f03a348345eb1c665d3e5a19699cdd0bcd62f2ae3f6eeaf059896f1974b1fc` | the 4G/AT&T TouchPad (`CE_VARIANT=att`) |

These are HP's original 3.0.5 Doctors. The webOS Archive has copies. Check the sha256 before
you use one: each build manifest records it under `oem_jar`.

### The released CE Doctors

These are git-ignored, in `out/`, and needed for OTA payloads. A payload is built *from* the
image devices currently run. Keep the JARs of every build that is an OTA origin:

- today, `webosdoctorp310hstnh-ce-600070.jar` (Wi-Fi 3.1.0);
- `webosdoctorp310hstnhatt-ce-600071.jar` (AT&T 3.1.0);
- the 3.2.0 JARs, as the origins of the next update.

Released Doctors are on the project's GitHub Releases page. Check each one against
`build/full-ce/manifests/<mark>.json`, under `output_jar.sha256`.

### The OTA signing key

The key is git-ignored: `../webos-update-exploration/keys/ce-ota-signing.key`. Its backup is
in the **App Catalog Admin Vault**. Never commit it or copy it anywhere else. The public half,
`keys/ce-ota-signing.pub`, is in git and baked into every CE image, and devices trust nothing
else. Losing the private key means no device can ever be updated by OTA again.

## 3. Build a Doctor

The rules that apply to every bake:

- **A bake contains everything finished.** Before baking, list anything merged but not yet
  wired into the bake, and settle it first.
- **Every bake takes a new BUILDMARK.** `build/full-ce/BUILDMARK` holds the counter, and it
  is tracked in git. The bake raises it by one and writes it only when the bake succeeds.
  The OTA server and client choose updates by BUILDMARK, so a mark must never be reused.
  Each release has a floor, set in bake.py's `MARK_FLOOR`; 3.2.0 starts at 600100.
- **Inputs go in `AddToImage/`** (see build/full-ce/README.md). The overlay under
  `build/overlays/` is generated, so never edit it by hand.

```sh
cd build

# Wi-Fi TouchPad
python3 full-ce/bake.py                       # -> overlays/full-ce/, manifests/<mark>.json
./build-ce-doctor.sh overlays/full-ce         # -> ../out/webosdoctorp320hstnh-ce-<mark>.jar

# 4G/AT&T TouchPad: the same bake against HP's AT&T Doctor
CE_VARIANT=att python3 full-ce/bake.py        # -> overlays/full-ce-att/
CE_VARIANT=att ./build-ce-doctor.sh overlays/full-ce-att
                                              # -> ../out/webosdoctorp320hstnhatt-ce-<mark>.jar
```

What each step does:

- **`bake.py`** starts from HP's pristine root filesystem. It regenerates the first-use
  layer from `build/community-firstuse/`, adds every CE component in its final place, and
  checks the result. It then writes `build/full-ce/manifests/<mark>.json`, which records
  the inputs hash, the git revision, the OEM JAR, the LunaSysMgr binary and the ipks.
  Setting `SOURCE_DATE_EPOCH` reproduces an earlier bake exactly.
- **`build-ce-doctor.sh`** repacks the Doctor. It refuses to start if:
  - the overlay is older than its inputs (`inputs_sha256`);
  - the overlay was baked for the other variant;
  - a Doctor is already running from the output JAR.
  
  The output JAR's sha256 goes into the manifest.

**Commit the bake.** That means the BUILDMARK file, the manifest and the regenerated
overlays, with a message that names the mark. The JAR itself stays in `out/`.

## 4. Test it

1. **Flash a test TouchPad.** Put it in recovery mode and run
   `java -jar out/<the jar>`. Use one test device at a time, and never your daily driver.
2. **Run the automated suite** after first use is done, from
   [Docs/TEST-PLAN.md](Docs/TEST-PLAN.md):
   ```sh
   novacom put file:///tmp/full.sh < scripts/ce-test-full.sh
   novacom run file://bin/sh -- /tmp/full.sh <mark> </dev/null > scripts/results-<mark>.txt
   ```
   Wait about two minutes after first use before running it: the encrypted app store
   becomes writable well after it mounts, and a run inside that window fails on the
   seeding checks. Commit the results file. 600121 scored 172/2 and 600122 scored 174/0,
   and every fail needs an explanation.
3. **The checks that need eyes and hands** are the `[Human]` items in TEST-PLAN.md.

## 5. Build and ship an OTA update

An OTA payload is an ipk that turns one image (*from*) into another (*to*). The generator
refuses to write a payload unless *from* + payload = *to*. The client refuses any device
that isn't on the *from* BUILDMARK, isn't TouchPad hardware, or is running a non-stock
kernel.

```sh
# 1. Generate: one payload per origin image. Use the AT&T origin for the AT&T build.
build/ota/make-payload.py build out/webosdoctorp310hstnh-ce-600070.jar \
    out/webosdoctorp320hstnh-ce-<mark>.jar --out out/ota/600070-<mark>

# 2. Optional: pre-flight a real device against the payload. Read-only.
build/ota/device-check.py out/webosdoctorp310hstnh-ce-600070.jar \
    --delta out/ota/600070-<mark>/delta.json --out out/ota/<run>/preflight

# 3. Sign the manifest. This needs the private key (section 2).
../webos-update-exploration/webos-update-server/tools/sign-manifest.py \
    out/ota/600070-<mark>/manifest-inputs.json --copy-payload
```

4. **Commit the signed manifest and its `.sig`** in `webos-update-exploration`
   (`webos-update-server/ce-ota/manifests/`). **Pushing that repo deploys production**
   (`swupdate.webosarchive.org`), so push only what is meant to go live.
5. **Copy the payload by hand** to the server's `ce-ota/payloads/`.
6. **Roll out by editing `ce-ota/releases.json`:**
   - list tester NDUIDs first, then `"*"` for everyone;
   - retire the old route when a newer one replaces it;
   - devices on an older beta need their own *from* payload, or a reflash.
   
   Server setup is in `webos-update-server/DEPLOY.md`.

**Check headroom before you sign.** The manifest's `space` block, rootfs growth plus the
largest file, must fit with margin on a real device of that model. The AT&T TouchPad had
31 MB free on `/` after the 3.2.0 OTA, so the next AT&T update must free space or stay small.

**Hard-won rules:**
- Payloads are lists of ipks, with no deltas and no image.
- A payload's postinst must exit 0.
- Rehearse new kinds of change as a hotpatch before an armed flash.

The details, the armed-flash recipe and how to get a device out of the OTA ramdisk are in
[Docs/OTA-HANDOFF.md](Docs/OTA-HANDOFF.md) and the OTA project's `OTA-3.1.0.md`.

## 6. After a release

- Tag the release, as with the existing `3.1.0-CE-Release` and `3.2.0-CE-Release` tags.
- Update RELEASE-NOTES.md, KNOWN-ISSUES.md and the status lines in `Docs/`
  (indexed by [Docs/PLAN.md](Docs/PLAN.md)).
- Keep the released JARs. They are the origins of the next OTA.
- Refresh the time-zone data before the next release (`tools/tzdata/`).
