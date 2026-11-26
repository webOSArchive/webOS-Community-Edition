# Community first-use swap (OOBE)

Replaces stock first-use **in place** (`com.palm.app.firstuse`, id unchanged) so
a freshly CE-Doctored TouchPad activates against the **webOS Archive account
backend** (`device.php`) instead of HP's dead servers. The app + service source
comes from the community **webosaccount ipk** in `AddToImage/OOBE/` (the built
`webos-community-account` app, verified working on hardware as a standalone
re-sign-in app); this component adapts it to run as the *real* first-boot OOBE.

> **Pinned at webosaccount 1.1.12** (`AddToImage/OOBE/`, commit ca007ea,
> 2026-08-17). CE's first-use is that snapshot plus the `oobe/` deltas here; later
> releases of `webos-community-account` (1.1.13 … 1.2.0) do **not** reach the image.
> The CE-only first-use behaviour (Wi-Fi join, completion, Skip Account Setup)
> lives only in `oobe/`, never upstream. To move the pin: replace the ipk in
> `AddToImage/OOBE/`, re-run `make-overlay.sh` (its `patch -f` fails loudly if an
> `oobe/` patch no longer applies), rework any patch that fails, then bake and
> flash-test first use on hardware, including Skip Account Setup.

```
community-firstuse/
├── make-overlay.sh        # generator: AddToImage/OOBE ipk + oobe/ deltas
│                          #   -> ../overlays/community-firstuse/  (build input)
├── oobe/
│   ├── FirstUse-oobe.patch   # OOBE delta, applied to the ipk's FirstUse.js
│   ├── Palm-oobe.patch       # OOBE copy fixes for the terms card
│   └── config.js             # OOBE card list: language, palm, signin, namedevice
└── README.md
```

Build: `./make-overlay.sh` then `../build-ce-doctor.sh overlays/community-firstuse`.
The overlay is generated (never edit it by hand). The ipk's app tree lands over
`com.palm.app.firstuse` minus **every** `appinfo.json` (top-level and per-locale
`resources/` — they carry `id: com.palm.app.webosaccount` / `visible: true`;
the stock firstuse identity must stay authoritative or LunaSysMgr's
firstuse-mode launch breaks). Its flat `service/` files map onto the stock
`com.palm.service.palmprofile` layout: `services.json`/`sources.json` at the
service root, `palm_profile_util.js` → `utils/`, the assistants → `handlers/`.

## Why an OOBE delta on top of the community app

The community app is built as a **standalone app for an already-set-up
device**: it assumes Wi-Fi is connected, deliberately never calls
`PalmSystem.markFirstUseDone()`, and finishes by closing the app. Run unmodified
as the real OOBE, the device would boot into first-use forever. The deltas:

| Change | Why |
|--------|-----|
| `dataConnection` back to stock `false` | The `requires:{data:true}` gate is what opens the Wi-Fi join popup; the standalone app hardcoded it `true` to skip that. |
| Completion = `markFirstUseDone()` + `machineReboot` | `ran-first-use` is what keeps LunaSysMgr out of minimal mode, and only a restart leaves it. The confirm card's button becomes **Restart** (the stock wipe/shutdown paths stay neutered — the community patch's whole point). |
| `firstUseComplete()` routes to the same completion | Belt-and-suspenders if any stock path reaches it. |
| `setCustomization` (`populateDefaults`) restored in `done()` | Applies the language-card choice; it's a local service, unlike the dead `postLoginSettings`/`setTimeZoneFromIP`, which stay skipped. |
| Museum self-updater stripped | This copy lives in ROM and is updated by the CE OTA; the updater installs via Preware, which doesn't exist during OOBE. (The `Helpers.Updater` component and the update check are patched out; the vendored `Updater-Helper.js` file still ships — loaded but inert.) |
| Terms-card copy | "Update required" → "Connection Problem" (the CE image bakes modern TLS, so failure = connectivity), and the decline popup no longer suggests closing the app (there's no set-up device to fall back to). |
| Card list (`oobe/config.js`) | Drops `restoreComponent` (dead HP backup; its cleanup path wiped devices), `google` (defunct location-service consent), `updates` (stock OTA check hangs; CE OTA runs post-setup). Keeps `namedevice` — `assignDeviceName` is served by `device.php`. |

The launch-time "account already exists?" probe is kept: if OOBE relaunches
after the account was written but before completion (e.g. a Luna restart), the
signed-in card appears and its Restart button finishes first use properly.

## Transport prerequisites (baked into the same overlay)

The account flow's first secure fetch (the terms card) is a hard gate, so its
prerequisites ship in the rootfs rather than as a hoped-for later install:

- **Modern curl** (7.88.1, OpenSSL 1.1.1w, TLS 1.3) at `/usr/bin/curl` +
  `/usr/lib/curl11/`, from `OpenSSL-legacyWebOS/ipks`' curl-tls13 ipk — the
  patched palmprofile service's `curlPost()` shells out to it (stock node 0.4
  TLS can't reach the Cloudflare-fronted backend). Same layout the ipk's
  postinst produces, except `libcurl.so.4` is a real file, not a symlink (the
  overlay engine adds regular files; it's the binary's DT_NEEDED name).
- **`ntpdate-sync`** upstart job — a fresh flash can boot with a clock outside
  cert validity windows; stock time sync targets dead palm.com servers.
- **Current Mozilla CA bundle** replacing the 2011 one at
  `/etc/ssl/certs/ca-certificates.crt` (taken from the build host; override
  with `CA_BUNDLE=`).

Also here because "every CE device is novacom-capable out of the box" is the
community decision: `/var/gadget/novacom_enabled` (under `/var`, so untracked
by integcheck).

## Boot-order safety, verified against the stock image

- LunaSysMgr's pre-start writes `-u minimal -a com.palm.app.firstuse` when
  `ran-first-use` is absent — that's how our patched app becomes the OOBE.
- `firstuse-createDefaultAccount` only fires when `ran-first-use` **exists**,
  and `createNovaAccount {createDefaultAccount:true}` lists accounts first and
  no-ops (flag-only) when one exists — a real sign-in is never clobbered by the
  "Dr. Skipped Firstuse" bypass path.

## Known gaps (accepted)

- **Time zone** isn't auto-set (stock used the dead `setTimeZoneFromIP` GEOIP
  endpoint; `device.php` doesn't serve `getTimezone` yet — server-side
  follow-up). Clock itself is correct via NTP; users set the zone in Date & Time.
- The locale overrides (`resources/<locale>/appinfo.json`) are untouched — the
  app keeps its stock id/title/hidden flags, which is correct here (it *is*
  firstuse); the standalone app's re-id gymnastics don't apply. The community
  string changes are English-only for now, so non-English locales still show
  some HP-era strings on the patched cards.
- **Sign-in is optional.** The community patches add a "Skip Account Setup" link
  to both the terms and sign-in cards (`skipSetup` → `FirstUse.closeApp()`), and
  `Firstuse.css.patch` styles it. Under OOBE the delta makes **`closeApp` itself
  finish first use** (`markFirstUseDone()` + reboot) rather than `window.close()`
  — a bare close would just relaunch firstuse in minimal mode — so Skip, the
  Restart button, and `firstUseComplete` all converge on the same safe
  completion. Skipping with no account is fine: `firstuse-createDefaultAccount`
  creates the local "Dr. Skipped Firstuse" profile on the next boot.
- **Captive-portal false positive (observed on first hardware boot):** Wi-Fi join
  was slow and the flow briefly believed it needed a hotspot/captive sign-in.
  That's the stock `$enyo-lib/captiveportal/` probe hitting a dead Palm
  connectivity-check URL; repoint it at a live HTTP-204 endpoint. A wifi-card
  concern, not touched by the account patches.

## Verified on hardware (2026-08-15)

Flashed a real `topaz` from this Doctor: on-device `ROM Verifyer` reported
`integcheck IPKG VERIFICATION SUCCEEDED`, the flash completed, and the device
booted the community OOBE. Terms card rendered the **community** terms (full
TLS path — patched palmprofile → baked curl → CA bundle → `device.php` — works
on real hardware), sign-in succeeded, and Restart completed first use without a
wipe.
