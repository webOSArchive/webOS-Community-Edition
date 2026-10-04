> **SUPERSEDED IN PART — read this with `OTA-3.1.0.md` beside it.**
>
> **Its §2 bootstrap plan is superseded by `OTA-PLAN.md` (2026-10-04)**: payloads
> generated as rootfs diffs, one plain-HTTP signed session instead of two.
>
> This is the original CE-side design doc. It is still the best statement of the
> *shape* of the problem — the on-device machinery inventory (§0), the dual
> delivery rule (§1), the bootstrap transport analysis (§2), and the constraints
> in §6 all hold. But it was written before 600070 shipped and its status claims
> are stale.
>
> **The authoritative document is `OTA-3.1.0.md` in the `webos-update-exploration`
> repo** (see `PLAN.md` §"Related projects"). Anything about what exists today,
> what is blocked, or what ships next belongs there, not here.
>
> Corrections to this document's premises, as of build 600070:
>
> - **"the OTA path is not built yet" is wrong.** `org.webosarchive.otaready`
>   1.2.0 is deployed to users today — the readiness app, its root daemon, and a
>   `com.palm.app.updates` reroute that renders our offer in the native updater,
>   working end to end on hardware. It restores onto CE 3.1.0 with its service on
>   the bus (`TEST-PLAN.md:461`). The planned **OTA Ready v2** is the
>   bootstrapper, and it reaches those users as an ordinary app update — the one
>   manual install §2.2 treats as unavoidable has **already been spent**.
> - **The shipping build is 600070, not 600024.** The image reports
>   `webOS CE 3.1.0` and carries App Catalog 6.1.2901.
> - **What 600070 actually bakes for OTA is the trust anchor and nothing else** —
>   `/usr/share/ce-ota/keys/ce-ota-signing.pub` and `/usr/bin/ce-ota-verify`
>   (option A in `OTA-3.1.0.md`). §5's pinned-key model is therefore live; the
>   client half of §4 is not in the image.
> - **Two open items gate the first real OTA**, both tracked in `OTA-3.1.0.md`
>   §"Open items": #5, no real payload exists (the server hosts only a
>   placeholder offer), and #4, the armed flash — `arm-install` ->
>   `make-update-uimage` -> ramdisk -> reboot — is unverified on hardware.
>   `Docs/USB-SETTINGS-HOTFIX.md` proposes the USB Settings fix as a candidate
>   for #5.

# webOS CE — OTA Strategy

How devices get to **CE 3.1** and stay current afterward. Two flows:

1. **Bootstrap OTA:** an existing **OEM stock 3.0.5** device → **CE 3.1**, without re-Doctoring.
2. **Ongoing OTA:** a **CE 3.1+** device → future CE releases.

We control the update server backend, so the design assumes we can build any
endpoint, protocol, listener, or manifest scheme we need on the server side.
This document is grounded in the on-device OTA machinery verified present in the
3.0.5 rootfs (see also `TEARDOWN.md`, `SCOPE-3.1-CE.md`).

---

## 0. On-device OTA machinery (what we have to work with)

Confirmed present in the stock 3.0.5 rootfs:

| Component | Path | Role |
|-----------|------|------|
| OMA-DM client | `/usr/bin/OmaDm` | Native SyncML/WBXML update client |
| DmTree | `/usr/share/omadm/DmTree.xml` (+ runtime `/var/lib/software/DmTree.xml`) | Points the client at a server |
| Package installer | `/usr/bin/mmipkg`, `/usr/bin/PmUpdater` | Installs ipks against the mounted rootfs |
| Ramdisk builder | `/usr/share/ota-scripts/make-update-uimage` | Builds the temporary update ramdisk |
| Native UI | `/usr/palm/applications/com.palm.app.updates` | The "System Updates" app |
| Upstart jobs | `start_update`, `UpdateDaemon` | Boot-time update orchestration |
| Staging | `/var/lib/update` (**16 MB**), flags in `/var/lib/software/` | Where ipks are staged; `updating` flag |
| Crypto floor | `/usr/lib/libssl.so.0.9.8` = **OpenSSL 0.9.8k**, **TLS 1.0 max** | The transport ceiling on stock devices |

**The OTA install mechanism** (how any update lands): stage ipks → write
`/var/lib/software/SessionFiles/` → set the `updating` flag → `make-update-uimage`
builds `/boot/update-uimage` → reboot into it → `PmUpdater`/`mmipkg` installs the
packages against the mounted `/rootfs` → restore the stock kernel symlink →
reboot. **`updatefsinfo` must be the first package in the list** or
`make-update-uimage` fails.

Two consequences that shape everything below:

- **`mmipkg`/`ipkg` do NOT verify package signatures.** Transport is the only
  integrity control unless we add our own (see §5).
- **CE is 100% userspace** (no kernel/module changes), so an OTA **never rewrites
  `/boot/uImage`** — it only builds a throwaway update ramdisk. This sidesteps the
  custom-kernel hazard that normally makes big webOS OTAs dangerous.

---

## 1. Dual delivery form (the key architectural rule)

Every CE component is authored **once** and delivered **two ways**:

| Form | Consumer | Integrity |
|------|----------|-----------|
| **Baked into the Doctor rootfs** (files + regenerated ipkg `md5sums`) | Clean-flash CE Doctor (`SCOPE-3.1-CE.md`) | `verifyRom`/`integcheck` at flash time |
| **`.ipk` with a `pmPostInstall` script** (does in-place edits at install) | OTA (bootstrap + ongoing) | `mmipkg` — no signature check; we add our own (§5) |

The source projects already ship most components as ipks; the Doctor bake simply
unpacks them into the rootfs and regenerates md5sums. **Maintain a single
component manifest** (component → version → ipk artifact → baked form) as the
source of truth for both the Doctor build and the OTA server. This guarantees a
Doctor-flashed CE device and an OTA-upgraded CE device are byte-equivalent.

---

## 2. Bootstrap OTA: OEM 3.0.5 → CE 3.1

Three problems, each solvable because we own the server.

### 2.1 Problem — transport (the TLS chicken-and-egg)

Stock OpenSSL is **0.9.8k (TLS 1.0 max)**; modern HTTPS servers require TLS 1.2+.
A stock device therefore cannot reach a normal modern endpoint — but it *can*
reach one we deliberately keep legacy-friendly.

**Solution:** stand up a **legacy bootstrap listener** on the server:
- **Plain HTTP**, or **TLS 1.0 with legacy ciphers**, on a dedicated host/port
  reserved for bootstrap-phase devices.
- **Cert validation caveat:** the stock 2011 CA bundle is stale and the OmaDm/
  download client's validation strictness is unverified. Safest bootstrap
  transport is **plain HTTP with an application-layer signature** on the payload
  (§5), which removes the cert problem entirely. (A TLS-1.0 cert chaining to a
  root still present in the 2011 bundle is a fallback if we want channel
  encryption during bootstrap.)

### 2.2 Problem — client entry point (how a stock device starts talking to us)

A 100%-stock device's OmaDm targets dead `ps.palmws.com` / `omadm.swupdate.palm.com`.
We cannot remotely reach such a device without a client-side repoint, and we don't
own those DNS names. So the bootstrap needs **exactly one manual step**:

**Install a small "webOS CE Bootstrap" ipk** (a few hundred KB) via **Preware** or
**WebOS Quick Install (WOSQI, over USB/novacom)** — the standard homebrew entry
point. That ipk (root postinst):
1. Repoints the update client to our server — edit **all three** DmTree copies
   (`/usr/share/omadm/DmTree.xml`, `/var/lib/software/DmTree.xml`, and
   `/var/lib/software/DmTree.backup.xml`, which the client regenerates from).
2. Installs the **OTA Ready daemon** + patched `com.palm.app.updates` (native
   reroute) so the upgrade is offered in the stock Updates UI.
3. Pins our signing public key (§5).

There is no way to avoid this single manual action on a truly stock device short of
re-Doctoring (which is the very thing bootstrap OTA exists to avoid). It is
minimal, one-time, and familiar to the webOS homebrew audience.

### 2.3 Problem — payload size vs. the 16 MB `/var/lib/update`

The full CE transformation is far larger than 16 MB (App Catalog alone is ~15 MB;
plus LunaCE ~5 MB, TLS stack ~4 MB, mail, hardware, branding). Two levers, used
together:

- **Stage the bulk on `/media/internal`** (the multi-GB FAT32 volume), not
  `/var/lib/update`. Because we author the SessionFiles/`install_list.txt`, we set
  staging paths to `/media/internal`; `PmUpdater` installs against `/rootfs` from
  wherever the ipks live.
- **Chain the upgrade into two sessions**, which also solves the transport problem
  elegantly:

**Recommended bootstrap sequence (chained):**

| Step | Transport | Payload | Result |
|------|-----------|---------|--------|
| 0. Install CE Bootstrap ipk (manual, Preware/WOSQI) | USB | few hundred KB | Update client repointed; OTA Ready + signing key installed |
| 1. **Session 1 — transport upgrade** | **legacy (HTTP/TLS1.0)** | TLS stack + `ntpdate-sync` + fresh CA bundle (small; fits 16 MB or staged on /media) | Device now has **modern TLS + correct clock + current CAs** |
| 2. **Session 2 — the CE payload** | **modern HTTPS (TLS 1.2/1.3)** | LunaCE, mail TLS, BT gamepad, USB, App Catalog 6.0.2900, branding, `palm-build-info` + `/etc/webos-ce-release` | Device is **CE 3.1** |
| 3. Reboot / first CE boot | — | — | Reports as CE 3.1; enters the ongoing-OTA path (§3) |

Session 1 deliberately mirrors the eligibility model's `INSTALL_TLS` gate: once
`T=1`, the device is a first-class modern-HTTPS client and the heavy lifting in
session 2 rides a secure, current channel. Session 2's clock is correct (session 1
ran `ntpdate-sync`), so modern certs validate.

### 2.4 What the CE payload does at install (OTA form)

Delivered as ipks whose `pmPostInstall` scripts perform the in-place edits the
Doctor bake does at build time — the launcher env edit, the bluetooth/updates JS
patches, the DmTree finalization, the `/usr/palm/ipkgs` App Catalog swap +
first-boot reinstall, and writing `/etc/palm-build-info` (version-string rename,
`BUILDNAME` kept) and `/etc/webos-ce-release`. Because the OTA path uses `mmipkg`
(no `integcheck`), **md5sum regeneration is NOT required for OTA** — that is a
Doctor-only concern. Order the payload with `updatefsinfo` first; put the App
Catalog and LunaCE late.

---

## 3. Ongoing OTA: CE 3.1 → future CE releases

Straightforward, because CE devices already have modern TLS.

- **Discovery:** CE devices reach the **modern HTTPS listener** directly. No
  bootstrap, no legacy listener.
- **Identity/fingerprint:** the server keys on **`/etc/webos-ce-release`** (CE
  version + component manifest) plus `PRODUCT_VERSION_STRING`. `BUILDNAME` stays
  `Nova-HP-Topaz`, so the existing fingerprint logic keeps matching without change.
- **Delta computation:** the device reports its installed component manifest; the
  server diffs it against the target release's manifest and returns the **ordered
  list of component ipks the device actually needs** (`updatefsinfo` first). Full
  images are never needed after bootstrap.
- **Delivery:** the standard direct-update REST path
  (`GET /api/updates/check?ce_version=…&manifest=…` → ipk list → stage on
  `/media` → `make-update-uimage` → reboot → install), or the native OMA-DM path
  if we implement it server-side (§4).
- **Versioning:** CE releases as `3.1.0`, `3.1.1`, … each defined by a
  server-side manifest (component → version → ipk). One source of truth shared
  with the Doctor build (§1).

---

## 4. Server-side design (we control the backend)

| Piece | Purpose | Notes |
|-------|---------|-------|
| **Legacy listener** | Bootstrap-phase transport | HTTP and/or TLS 1.0 + legacy ciphers; isolated from the modern endpoint; only serves session-1 (TLS-stack) payload + signed manifests |
| **Modern listener** | CE-device transport | TLS 1.2/1.3; serves session-2 and all ongoing OTAs |
| **Update/manifest API** | Decide what a device needs | `check` keyed on fingerprint + `ce_version` + reported component manifest → ordered ipk list; `offer` for the native reroute's `offer.json` |
| **Package host** | Serve component ipks | Large ones flagged for `/media` staging in the session files |
| **Eligibility policy** | Gate offers | Extend `eligibility.json`: stock `Nova-HP-Topaz` 3.0.5 → "bootstrap to CE" offer; CE devices → incremental. Since `BUILDNAME` is unchanged, no fingerprint rewrite needed |
| **OMA-DM/SyncML server** (optional) | Make the *native* Updates app work end-to-end | The `webos-update-exploration` project already prototypes a WBXML/SyncML server. Optional — the OTA Ready direct-update REST path is simpler and is the recommended primary |
| **Signing service** | Payload integrity (§5) | Signs each ipk/manifest with the private half of the pinned key |

**Recommendation:** make the **OTA Ready direct-update REST API the primary
mechanism** (simple, already built, transport-agnostic), and treat the native
OMA-DM reroute as UX polish so the upgrade also appears in the stock Updates app.

---

## 5. Security — closing the unsigned-package gap

`mmipkg`/`ipkg` verify nothing, and the bootstrap channel may be plain HTTP. That
is a remote-root vector via MITM. Because we control both ends:

- **Pin a CE signing public key** in the bootstrap ipk (and bake it into the CE
  rootfs).
- The **OTA Ready daemon verifies a detached signature** over every downloaded
  manifest and every ipk against the pinned key **before** handing anything to
  `mmipkg`. Reject on mismatch.
- This makes the plain-HTTP bootstrap channel safe (integrity + authenticity even
  without transport encryption) and remains defense-in-depth on the modern TLS
  channel.
- Rotate by shipping a new pinned key in a CE release (signed by the old key).

---

## 6. Constraints & gotchas (OTA-specific)

1. **16 MB `/var/lib/update`** — never stage the full CE payload there; use
   `/media/internal` and/or the chained sessions (§2.3).
2. **`updatefsinfo` first**, always, or `make-update-uimage` fails (E0060011).
   Filenames in `install_list.txt` (`/rootfs/var/lib/update/…`) must match the
   staged files exactly (E0060004).
3. **First OTA needs a reboot for LS2 role registration** (ls-hubd caches the role
   map) — the bootstrap ipk's services register on the reboot into/after session 1.
4. **App JS cache-bust:** any change to `com.palm.app.updates`/other app JS needs
   an `appinfo.json` version bump or webOS serves stale bytecode.
5. **Clock before certs:** session 1 must run `ntpdate-sync` before session 2
   validates any modern cert (a freshly stock device boots with a past-dated RTC).
6. **DmTree has three copies** — edit all three or the client regenerates the old
   target.
7. **Kernel untouched** — CE adds no kernel/modules, so OTAs skip the
   `/boot/uImage` rewrite and the post-update kernel-symlink restore. Keep it that
   way; a future kernel change would reintroduce that hazard.
8. **Signature verification is mandatory on the bootstrap channel** (§5) — do not
   ship a plain-HTTP bootstrap without it.

---

## 7. Effort (incremental to the Doctor scope)

| Phase | Work | Effort |
|-------|------|--------|
| **O0. Component manifest + ipk parity** | Ensure every CE component has an ipk form with a `pmPostInstall` matching the Doctor bake; author the shared manifest (§1). | 2–3 days |
| **O1. Server: listeners + update API** | Legacy + modern listeners; `check`/`offer`/package-host; eligibility CE baseline. | 3–5 days |
| **O2. Signing** | Signing service + pinned-key verification in the OTA Ready daemon (§5). | 2–3 days |
| **O3. Bootstrap ipk + chained sessions** | CE Bootstrap package (DmTree repoint + OTA Ready + key); session-1/2 payload definitions; `/media` staging. | 3–4 days |
| **O4. End-to-end QA** | Real stock 3.0.5 `topaz`: install bootstrap → session 1 (legacy) → session 2 (modern) → verify CE 3.1; then a 3.1→3.1.x incremental. | 3–5 days |

**Incremental total: ~2–3 weeks** on top of the Doctor build, most of it server
work and the end-to-end hardware validation of the two-session bootstrap.

---

## 8. Open confirmations

- **Bootstrap transport:** plain HTTP + signed payloads (recommended), or invest
  in a TLS-1.0 cert chaining to a still-trusted 2011-bundle root?
- **Native OMA-DM server:** implement it for a fully-native stock Updates
  experience, or ship only the OTA Ready direct-update REST path (recommended)?
- **Bootstrap distribution:** publish the CE Bootstrap ipk to an existing feed
  (App Museum II / Preware) and/or a WOSQI-installable download?
- **Signing key custody & rotation policy.**
- **CE release cadence / version scheme** beyond `3.1.0` (who cuts releases, how
  the shared manifest is maintained).
