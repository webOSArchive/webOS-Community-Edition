# Videos player + Media TLS — state and learnings (for 3.2.0)

**Branch `video-player`, parked 2026-09-14.** Everything here works on
hardware as post-flash packages; nothing has been baked into an image. This
file is the handoff for folding the work into a future 3.2.0. The original
plan and the Phase 0 measurements are in `Docs/VIDEO-PLAYER-REWRITE.md`.

---

## 1. Where it stands

| Component | What it is | State | Bundle |
|---|---|---|---|
| **Videos** (`com.palm.app.videos` 3.2.0) | Enyo 1.0 player built on `VideoEngine`, a serialized seek/load gate over `<video>` | Daily-driven on the dev TouchPad | `AddToImage/NewApps/com.palm.app.videos_3.2.0_all.ipk` |
| **Photos hand-off** | Album-grid tap on a video launches Videos | Installed by the Videos postinst | (in the Videos ipk) |
| **`com.palm.app.videoplayer`** | The stock id apps launch by name now hosts the same Enyo player | Installed by the Videos postinst | (in the Videos ipk) |
| **Video handlers** | Every video type opens in Videos | Postinst + `ce-register-video-handler` job (bake) | (in the Videos ipk) |
| **Media TLS 1.3** (`org.webosarchive.media-tls13` 1.0.0) | GStreamer `souphttpsrc` replacement on the CE libcurl/OpenSSL 1.1 | Daily-driven on the dev TouchPad | `AddToImage/NewApps/org.webosarchive.media-tls13_1.0.0_armv7.ipk` |

The two packages are independent; install order does not matter. Videos
without Media TLS plays everything but HTTPS; Media TLS without Videos gives
HTTPS to every GStreamer user (stock players, Pandora, Browser media).

Versions (3.2.0 / 1.0.0) are the user's; do not change them unasked.

## 2. What is on the branch

```
apps/com.palm.app.videos/          the app
  source/VideoEngine.js            engine: the only code that touches <video>
  source/PlayerApp.js              the card (Enyo 1.0)
  source/SelfTest.js               luna-send-driven self-test (scrub / eos / all)
  css/player.css, images/          Mojo sprite icons, command-menu gradients
  tweaks/com.palm.app.videos.json  Tweaks toggle definition
build/full-ce/videos-app/
  patches/AlbumGridView-videos-handoff.js.patch   Photos grid -> Videos
  videoplayer-app/appinfo.json     appinfo for the player under the stock id
  feed/{control,postinst,prerm}    Preware package scripts
build/full-ce/media-tls13/
  curlhttpsrc/gstcurlhttpsrc.c     the element
  curlhttpsrc/Makefile             cross-build (+ glibc 2.8 symbol check)
  app/, feed/{control,postinst,prerm}   Preware package
build/full-ce/bake.py              Videos tier, Photos patch, handler job (see §4)
scripts/videos-app.sh              package|install|launch|selftest|log|close|feed|deploy|undeploy|release
scripts/media-tls13.sh             setup|build|feed|deploy|undeploy|release
scripts/rangeserver.py             test server: Range support; --tls = TLS 1.3 only
Docs/VIDEO-PLAYER-REWRITE.md       plan, Phase 0 evidence, phase log
```

Not in git (`build/work/`, regenerable): the stock sources pulled from the
device (`stock-videoplayer/`), test clips (`test-media/`), and the element's
build inputs (`curlhttpsrc/`, recreated by `scripts/media-tls13.sh setup`).

## 3. Installing on a running device (the 3.1.0 path)

- **Preware or Internalz** install either ipk and run its postinst as root
  through ipkgservice. Videos asks for a Luna restart (Photos reloads its
  patched source); Media TLS needs none — every media session starts a fresh
  media-pipeline.
- **Never `palm-install`** these: the stock installer copies files and skips
  the postinst, so nothing gets wired.
- Over USB from this repo: `scripts/videos-app.sh deploy`,
  `scripts/media-tls13.sh deploy` (ipkg as root + postinst, as ipkgservice
  would); `undeploy` runs the prerm and removes.
- Every postinst stage is md5-guarded, idempotent, logs to
  `/var/log/<package>-install.log`, and never exits non-zero. The prerms
  restore every backup (`*.webosce-orig`); the video handlers are rescanned
  by the Luna restart that removal asks for.
- **A prerm must never block on a bus call.** LunaSysMgr's appinstaller runs
  it synchronously as `.scripts/<id>/pmPreRemove.script`, so a `luna-send`
  to `com.palm.applicationManager` deadlocks LunaSysMgr and freezes the UI
  (Preware removal of Videos 3.2.0 froze twice, 2026-09-14; the old prerm
  swapped handlers back). `undeploy` never caught it: it runs the prerm
  from a novacom shell. Test removal **through Preware**. Media TLS's
  removal path has not been exercised.

## 4. Folding into 3.2.0 — checklist

Already wired in `bake.py` (never baked or flashed):
- `IPK["videos"]` from `AddToImage/NewApps`; the Videos tier bakes the app,
  drops its `ce-install/` payload, puts the player under
  `com.palm.app.videoplayer` (index.html + appinfo + source/css/4 images),
  and stages the Tweaks JSON into the cryptofs seed.
- `edit_photos()` applies the album-grid hand-off patch.
- `ce-register-video-handler` first-boot job (verify-then-flag, like the ipk
  handler job). Its register logic duplicates postinst stage 4 — keep them in
  sync.

Still to do:
1. **Wire Media TLS into the bake**: ship `libgstcurlhttpsrc.so` in
   `/usr/lib/gstreamer-0.10/` and *delete* the stock `libgstsouphttpsrc.so`
   from the image (a fresh `/var` has no registry cache, so no drop needed).
   Depends on the browser-tls13 tier (`/usr/lib/ssl11`).
2. **Bake, flash, verify** both — neither has been through a real image.
3. `scripts/ce-test-full.sh` video section (the self-test recipes in §7) and
   the reboot/playback soak (plan Phase 3).
4. Guard against **two `souphttpsrc`s**: any later image or OTA that restores
   the stock plugin next to ours makes the winner load-order dependent.
5. Optional hardening (proposed, not done): if `/usr/lib/ssl11` is missing,
   have the plugin load the stock souphttpsrc instead of leaving the device
   with no HTTP media at all.
6. Decide on the Photos carousel: swiping to a video inside picture mode still
   uses Photos' old inline player (only grid taps hand off).
7. Confirm the package id `org.webosarchive.media-tls13` and the feed icon
   URLs in both `feed/control` files (both are guesses).
8. Not implemented from the stock player: trim/edit, share/upload, details
   scene, RTSP, the camera capture flows (`source: upload-popup|upload-dashboard`
   now just play).

## 5. What was verified on hardware, and what wasn't

Self-test (`scripts/videos-app.sh selftest`) results, all with mediaserver's
pid unchanged:

| Recipe | Result |
|---|---|
| Local 30 s clip, scrub + restart at end | 19/19 |
| Local 3 min 720p, 10 s GOP (worst case) | 19/19 — 1181 seek requests → 22 pipeline seeks, worst 3.1 s |
| Fragmented MP4 (no duration), restart at end | 10/10 via reload |
| HTTP host without Range | 6/6 — downgraded to unseekable after 1 recovery |
| HTTP host with Range | 10/10 |
| HTTPS, TLS-1.3-only server | 13/13 (Media TLS) |

Also verified by hand: Photos grid tap (with resume), Browser link → one
card, MeTube → one card, Tweaks toggle, background play when carded,
percent-decoded titles, spinner, 404 fails fast and releases the pipeline,
public HTTPS (Cloudflare, TLS 1.3, moov at end), http → https redirect
chains, moov-at-end over Range, Pandora (plain HTTP through the new element).

**Untested through Media TLS:** Shoutcast/Icecast radio (the icy metadata
path has never run), live or chunked streams, HTTP auth (the stock element had
user/password properties; ours has none), proxies, cookie-gated URLs, Browser
inline `<video>`/`<audio>`, Pandora track skips. SoundCloud does not use the
media HTTP path at all (see §6.4).

## 6. Learnings

### 6.1 The stock video stack

- **Two stock players**: Photos' inline `DbViewVideo` (what users meet) and
  the hidden Mojo `com.palm.app.videoplayer` (Browser/Email/Messaging/apps).
  Both are an HTML `<video>` → libWebKitLuna → mediaserver → a per-session
  `media-pipeline` process (gst 0.10 `playbin2`, Palm hardware decoder,
  overlay sink). mediaserver ignores the element's size.
- **Seek latency is keyframe distance**: 0.2 s landing on a keyframe, 1.3–3.3 s
  landing 5–8 s past one (720p). Stock Photos issued a pipeline seek on every
  drag move (≈40/s) plus a 3.4 s retry timer — the "hang".
- **Restart after the end** failed only for unknown-duration sources: the
  Mojo engine waits for `canplaythrough`, which never fires without a
  duration. Restarting an unseekable source must be a reload, not a seek.
- **HTTP hosts without Range wedge the stock pipeline permanently**, with no
  error event. WebKit still reports `seekable=[0-duration]` for them, so they
  can only be detected by a seek that fails.
- **media-pipeline crash #1**: SIGSEGV in the video sink's RGB frame capture
  (`_vhm_rotate ← rgb_capture`) when a seek lands before a freshly loaded
  pipeline has a frame. `readyState` is already 4, so the engine holds the
  first seek 1.2 s after load, or — resuming with autoplay — plays muted
  until the first `timeupdate` and seeks then (340 ms).
- **media-pipeline crash #2** (`Watchdog::HOG`): an app that gives up must
  release the element. Left loaded, mediaserver keeps prerolling, hits its own
  timeout, waits for an element error that never comes, and its watchdog
  kills the pipeline.
- mediaserver's `currentTime` lags the `seeked` event over the bus: trust the
  seek target until a `timeupdate` agrees.
- The platform pauses video ~0.5 s after the card leaves the foreground; the
  app resumes it by default (the user's choice), Tweaks can turn that off.
- `x-palm-media-extended-overlay-playback` (set by Photos) causes a black
  flash on every play/pause; the controls still draw over the video without it.
- **H.264 High profile stalls the TouchPad decoder** over any transport (data
  arrives, preroll never completes). Main (with or without B-frames) and
  Baseline play; adding audio or rewriting the level flag does not help.
  Before blaming HTTPS for a stream, play the same file over plain HTTP.
- `MediaResourceArbitration::requestPipeline restore timeout` in the log
  means a session's load did not complete within ~5 s — a symptom, not a cause.
- db8 denies other apps the `com.palm.media.*` kinds (get and merge):
  Photos passes path/title/lastPlayTime in the launch params, and the player
  keeps its own resume positions (localStorage, 60 most recent).

### 6.2 The webOS app platform

- A card app launching another app by id makes LunaSysMgr **pre-create a card
  for it**. A headless forwarding shim therefore leaves a blank card behind;
  the stock id must host the real player.
- Resource handlers resolve two ways: by Content-Type (`video/mp4`, the
  Browser path) and by extension through Palm pseudo-mimes
  (`mimeTypeForExtension mp4` → `video/mp4-generic`, file:// and
  attachments). `addResourceHandler` only adds an *alternate* when a
  system-default exists; `swapResourceHandler {mimeType, index}` (the key is
  `mimeType`, not `mime`) makes it active. Registrations persist in
  `/var/usr/palm/command-resource-handlers-active.json`.
- Enyo 1.0's `AppMenu` creates its items lazily — touching them in
  `create()` white-screens the app. Preferences went to Tweaks instead:
  a JSON file in `org.webosinternals.tweaks.prefs/preferences/` plus
  `palm://org.webosinternals.tweaks.prefs/get {owner, keys}`.
- `palm-install` skips package scripts; ipkgservice (Preware, Internalz)
  runs them. `palm-launch -p` passes params through a device shell — `'` and
  `(` in URLs must be percent-encoded.
- Device busybox lacks `timeout` and `paste`; `patch` takes only `-p N -i
  DIFF` (no `-s`, no `--fuzz`); `df` wraps long device names (take the
  field from the end).

### 6.3 GStreamer and TLS

- The stock media fetch is `souphttpsrc` → libsoup **2.4.1** → GnuTLS
  **2.10.4**: TLS 1.0-class and **no SNI** (libsoup 2.4.1 never sets a server
  name), so a GnuTLS drop-in would not have fixed modern hosts. The CE TLS
  packages do not reach it; luna-tls13 even scrubs the OpenSSL 1.1 preload
  out of media-pipeline.
- **media-pipeline creates `souphttpsrc` by name.** A higher-ranked element
  is ignored; the replacement registers *as* `souphttpsrc` with the same
  properties (the ones mediaserver sets: location, user-agent, cookies,
  extra-headers, iradio-mode, automatic-redirect, is-live).
- **The registry cache** is always `/var/home/root/.gstreamer-0.10/registry.arm.bin`
  — GLib 2.16 takes home from passwd, not `$HOME`, so `HOME=/tmp
  gst-inspect` rewrites the real cache. After swapping in a plugin that
  re-registers an existing feature name, delete the cache: the rescan reuses
  the stale feature and then purges it with the removed plugin (plugin
  loaded, 0 features).
- **Never link a plugin against `libcurl.so.4`**: stock `libgstpdksink.so` →
  `libpdl.so` loads the stock libcurl 7.21.7 (OpenSSL 0.9.8) whenever the
  registry is rescanned, and the soname wins over RPATH. The element dlopens
  the CE OpenSSL 1.1 and libcurl by full path, `RTLD_LOCAL`, and calls curl
  through a function table.
- **Never `RTLD_DEEPBIND`** in media-pipeline: it preloads `libptmalloc3.so`,
  and DEEPBIND'd curl allocated from glibc's heap as well → SIGSEGV in
  `__libc_calloc` (three rdxd reports).
- media-pipeline runs with `--gst-debug=1`; the element logs `curlhttpsrc:`
  lines to syslog instead (start, status, DNS/connect/TLS timings, curl
  result). `curl 23` / `curl 42` there are transfers aborted by a seek.
- Certificates are not verified (`ssl-strict` defaults off), matching the
  stock element, which never verified either. `ssl-strict` would need a
  newer CA bundle than the 2011 `/etc/ssl/certs/ca-certificates.crt`.
- Cross-build: Linaro 4.9 toolchain, ARMv7 VFPv3 soft-float ABI, headers from
  Debian armel `-dev` packages of the matching era, linking against the stock
  rootfs libraries; the Makefile fails if anything newer than glibc 2.8 is
  required.

### 6.4 Apps seen in the field

- **MeTube** asks its server for a URL, then launches
  `com.palm.app.videoplayer` by id with `{target, videoTitle}` (plain HTTP).
- **Pandora** (`com.jmtk.apollo`) streams through the media pipeline, plain
  HTTP from `p-cdn.us` — it goes through the new element.
- **SoundCloud** (`com.cmcs.playersoundcloud`) downloads each track with its
  own service to `/media/internal/.scplayer_<n>.mp3` and plays `file://` —
  untouched by Media TLS.
- archive.org `http://…/download/…` links 302 to an `https://` mirror; the
  PBS sample there is 455 MB with `moov` at the end (slow to start anywhere).
- test-videos.co.uk's Big Buck Bunny 720p is High profile (won't play);
  learningcontainer.com's `sample-mp4-file.mp4` is Main + AAC over HTTPS
  (plays).

## 7. Test tooling and recipes

- Clips (`build/work/test-media/`, pushed to `/media/internal/Videos/`):
  ffmpeg `smptebars` + `sine`, burned-in timecode (`drawtext %{pts\:hms}`),
  `-profile:v baseline -bf 0`, `-g 300` (10 s GOP worst case) or `-g 30`,
  `+faststart`; a fragmented copy (`frag_keyframe+empty_moov`) for unknown
  duration; a moov-at-end copy (`-movflags -faststart`).
- Servers on the host: `scripts/rangeserver.py 8080` (Range),
  `python3 -m http.server 8081` (no Range — the wedge case),
  `scripts/rangeserver.py 8443 --tls CERT KEY` (TLS 1.3 only; the stock
  stack cannot connect).
- `scripts/videos-app.sh selftest <url> [scrub|eos|all] [rounds]` drives the
  engine through its public API and prints PASS/FAIL lines from syslog.
- Crashes: count `/var/log/rdxd/pending/*.tgz` before and after; stacks are
  in each report's `minicore.txt`. `pidof mediaserver` should not change.
- Which curl is live: a `curlhttpsrc: plugin_init, libcurl/7.88.1
  OpenSSL/1.1.1w` line in `/var/log/messages` after opening a stream.

## 8. Decisions taken (so they are not re-litigated)

Standalone app rather than fixing Photos inline; no preview seeks while
scrubbing (one seek on release); the stock id hosts the player (no shim);
keep playing when carded is the default; preferences through Tweaks, never an
Enyo AppMenu; Mojo sprite icons with the stock Enyo slider bubble; spinner at
the top-left; HTTPS by replacing the binary, **no local proxy**; app id
`com.palm.app.videos` at 3.2.0; the streaming-server requirements document
lives in the streaming server's own project.

## 9. Dev TouchPad state (c37f7a34…)

Both packages installed via their postinsts; Photos' grid patched; the stock
souphttpsrc kept as `/usr/lib/gstreamer-0.10/libgstsouphttpsrc.so.webosce-orig`;
test clips in `/media/internal/Videos/`; Pandora and SoundCloud installed.
rdxd reports 2–6 on it come from this work (2: the sink capture crash; 3: the
watchdog kill; 4–6: the DEEPBIND experiment) — all causes fixed.
