# Spurious "hotspot sign-in needed" prompts

Fixed in the CE image since BUILDMARK 600000 (commit `473faed`, 2026-08-17).

## Symptom

On stock 3.0.5, a TouchPad on an ordinary home Wi-Fi network would claim the
network needed a hotspot (captive-portal) login, even though the internet
worked fine.

## Cause

`PmNetConfigManager`'s `NwHealthCheckSession` decides whether Wi-Fi really
reaches the internet by fetching a URL from a list built into the binary,
taking the next URL each time. It reads the fetched page's HTML `<title>` and
any WISPr tags, and sets `wifi.onInternet` to `yes` or `captivePortal`. A
`captivePortal` verdict makes the UI launch the network app's hotspot login.

The stock list:

```
http://www.google.com
http://developer.palm.com
http://www.yahoo.com
http://www.hp.com
http://www.bing.com
http://www.hpwebos.com
http://www.compaq.com
```

Three of these HP-era hosts are dead, parked or redirected. When a check used
one of them, the unexpected page looked like a captive portal. Because the
list rotates, the false prompt showed up only sometimes.

## Fix

`build/full-ce/bake.py`, in the "CE platform tweaks" tier (search for
`connectivity probe`), makes two changes.

**1. The dead URLs in the binary are replaced.** `patch_cstring` swaps each one
for a live community host:

| Stock | CE |
|---|---|
| `http://developer.palm.com` | `http://www.webosarchive.org` |
| `http://www.hpwebos.com` | `http://webosarchive.org` |
| `http://www.compaq.com` | `http://ipkg.preware.net` |

The google, yahoo, hp and bing entries are unchanged.

Rules for the patch:

- The new string must fit in the old string's space in the binary, which is
  its length plus the zero bytes after it. A shorter string is padded with
  zeros. If it doesn't fit, the bake stops.
- Each old URL must appear exactly once in the binary, or the bake stops.
- Any replacement host has to stay up and serve an ordinary page, meaning a
  normal `<title>` and no WISPr tags. A host that goes dark brings the bug
  back.

**2. The hotspot login page starts somewhere live.** The enyo captive-portal
library (`usr/palm/frameworks/enyo/0.10/framework/lib/captiveportal/CaptivePortalControl.js`)
first loads `urlToGoTo` in its webview so the real portal can redirect it. That
URL changed from `http://www.hpwebos.com/` to `http://www.webosarchive.org/`.

Both files are listed in `bake.py`'s overlay manifest.

## Verifying

- Check the patched list in the built overlay:
  `strings -n 6 build/overlays/full-ce/rootfs/usr/bin/PmNetConfigManager | grep -A6 '^http://www.google.com'`
- On the device, run
  `luna-send -n 1 palm://com.palm.connectionmanager/getstatus '{}' </dev/null`.
  On a normal network it should report `"onInternet":"yes"`.
- TEST-PLAN: "No spurious hotspot prompt on a normal home network" (Pass).
  "Captive-portal network → portal page loads from the archive-pointed
  webview" has not been tested yet (Skip).

## Unrelated noise

`ls-hubd` logs `Service not listed in service files: "com.palm.wifi.carrierhotspot"`
repeatedly. That's PmWiFiService asking for a carrier-hotspot service this
image doesn't include. It has nothing to do with the captive-portal check.
