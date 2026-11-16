# Overlays

An **overlay** describes the changes to apply to the OEM rootfs when building a
CE Doctor. Pass one to the build:

```
./build-ce-doctor.sh overlays/sample-rdxd-fix
```

## Format

```
<overlay>/
  changes.json          # optional: config + removals
  rootfs/               # files to add or replace, mirrored at the device root
    etc/rdxd.conf       # -> ./etc/rdxd.conf on the device
    usr/lib/...         # -> ./usr/lib/... etc.
  webos/                # optional: replacements for webOS.tar members
    BootLogo.tga        # -> the BootLogo.tga the Doctor writes to NVRAM
```

- **Add / replace:** any file under `rootfs/` is written to the matching path in
  the rootfs. If the path already exists it is replaced; otherwise it is added.
  All added/replaced files are forced to `root:root`. Mode: a **replaced** file
  keeps the stock member's mode — the overlay file's own mode is ignored, and
  the harness logs a `WARNING` when an executable source lands on a
  non-executable stock path; an **added** file gets `0755` or `0644` by its
  source's exec bit. Tighter stock modes (`0700`) cannot be reproduced for
  added files.
- **Remove:** list device paths in `changes.json` `"remove": [...]`.
- **Replace a `webOS.tar` member:** a file in an optional `webos/` folder beside
  `rootfs/` replaces the member of that name in `webOS.tar` itself. This is for
  what the Doctor flashes from outside the rootfs, such as `BootLogo.tga`, which
  it writes to NVRAM. The name must already be a member, and the rootfs is not
  replaced this way.

### `changes.json`

```json
{
  "description": "Human note about this overlay.",
  "ce_package": "org.webosarchive.ce-files",
  "remove": ["/usr/palm/ipkgs/com.palm.app.enyo-findapps_5.0.2900_all.ipk"]
}
```

- `ce_package` — the synthetic package that brand-new files (those not owned by
  any existing package) are attributed to in the ipkg md5 database. Default
  `org.webosarchive.ce-files`.

## What the harness does automatically (md5 / integrity)

Because the CE Doctor keeps `verifyRom=true`, the on-device `integcheck` will
reject any rootfs whose files don't match the ipkg md5 database, and will reject
any file not listed in it ("ADDED"). The harness keeps the database consistent
for you:

- **Replaced file owned by a package** → that package's `*.md5sums` entry is
  updated with the new hash.
- **Brand-new file** → added to `<ce_package>.md5sums` (+ a `.list`), so it is
  tracked and won't trip the ADDED check.
- **Removed file** → its `*.md5sums` line is dropped.
- **Files under `/var`, `/dev`, `/media/internal`** → not tracked by integcheck,
  so no md5 work is needed (this is where LS2 roles and app installs land).

The build then runs the faithful `integcheck` dry-run and **aborts if it fails**,
so a bad overlay never produces a Doctor that would fail verification on-device.

## Sample

- `sample-rdxd-fix/` — flips `/etc/rdxd.conf` `AutoUpload=true`→`false` (the dead
  crash-report upload server otherwise fills `/var/log`). Demonstrates the
  replace + owner-detection + md5-regen path (CE scope item 1e).

## Not an overlay concern

Components that are naturally ipks (TLS stack, LunaCE, hardware shims, the App
Catalog swap) are better delivered by **installing the ipk into the offline
root** in a later build phase, which brings its own correct `.md5sums`/`.list`/
`status`. The overlay mechanism here is for file-level edits and small additions;
the ipk-install path is Phase 1+ and will reuse the same md5/integcheck engine.
