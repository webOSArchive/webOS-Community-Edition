# Video player rewrite — plan

**Status (2026-09-14): Phases 0–2 done on the `video-player` branch. The app
lives in `apps/com.palm.app.videos/` (dev loop: `scripts/videos-app.sh`),
passes every Phase 0 recipe by self-test, and is wired into `bake.py` (Videos
tier, Photos handoff patch, `com.palm.app.videoplayer` shim, Tweaks toggle).
Browser hand-off verified end to end (one card) via the runtime
`ce-register-video-handler` job. Delivery is a **Preware feed ipk**
(`scripts/videos-app.sh feed` / `deploy` / `undeploy`;
`build/full-ce/videos-app/feed/`), since 3.1.0 is released — the bake
wiring stays for a future 3.2.0. The stock id `com.palm.app.videoplayer`
hosts the player itself (a forwarding shim left a blank pre-created card
behind whenever a card app launched it by id). Not yet: a baked flash,
`ce-test-full.sh` section, the soak (Phase 3).**

Things learned building it that the plan below did not predict:
- WebKit reports `seekable=[0-duration]` even for HTTP hosts that ignore
  Range, so Rule 9 cannot detect them; a failed HTTP seek (or a network error
  within 10 s of one) marks the URL unseekable for the session and recovery
  reloads from 0.
- The periodic crash is `media-pipeline` SIGSEGV in the video sink's RGB frame
  capture when a seek lands before a freshly loaded pipeline has a frame
  (§2.5). `readyState` lies; the engine holds the first seek after load
  (1.2 s), or — when resuming with autoplay — muted-plays until the first
  `timeupdate` and seeks then (340 ms).
- mediaserver's `currentTime` property lags `seeked` over the bus; trust the
  seek target until a `timeupdate` agrees.
- The platform pauses video ~0.5 s after the card leaves the foreground. The
  app's default is to resume it (users wanted background play); the Tweaks
  toggle "Pause video when minimized" restores the old behaviour. What remains
  visible is card-view compositing of the sink's snapshot — above the app.
- `x-palm-media-extended-overlay-playback` (which Photos sets) causes a black
  flash on every play/pause; without it the controls still draw over the
  video. Not set.
- db8 denies other apps the `com.palm.media.*` kinds (get and merge), so
  Photos passes path/title/lastPlayTime in the launch params and the app keeps
  its own resume positions in localStorage.
- Enyo 1.0's `AppMenu` creates its items lazily — touching them in `create()`
  white-screens the app. The preference moved to Tweaks anyway.
- Resource handlers resolve two ways: by Content-Type (`video/mp4`, the
  Browser path) and by extension through Palm pseudo-mimes
  (`mimeTypeForExtension mp4` → `video/mp4-generic`, the file:// and
  attachment path). `addResourceHandler` only adds an *alternate* when a
  system-default exists; `swapResourceHandler {mimeType, index}` (not `mime`)
  makes it active. Going through the Mojo shim instead left an extra Videos
  card behind the Browser; direct registration does not.

### HTTPS: media-tls13 (option B, 2026-09-14)

The stock media fetch is `souphttpsrc` → libsoup **2.4.1** → GnuTLS **2.10.4**:
TLS 1.0-class, and libsoup 2.4.1 never calls `gnutls_server_name_set`, so
there is no SNI — a drop-in GnuTLS would not have been enough. The CE TLS
packages do not reach it (luna-tls13 even wraps `media-pipeline` to *scrub*
the OpenSSL 1.1 preload out of it).

`build/full-ce/media-tls13/curlhttpsrc/` is a GStreamer 0.10 source element
on the CE libcurl 7.88.1 / OpenSSL 1.1 in `/usr/lib/ssl11` (RPATH, so the
env scrub does not matter), cross-built with the Linaro 4.9 toolchain against
the stock rootfs libraries (`make` checks nothing newer than the device's
glibc 2.8 is needed). Packaged as `org.webosarchive.media-tls13`
(`scripts/media-tls13.sh feed|deploy|undeploy|release`).

- **media-pipeline creates `souphttpsrc` by name** (the literal is in the
  binary), so ranking a new element higher does nothing. The element registers
  *as* `souphttpsrc`, with souphttpsrc's properties, and the stock
  `libgstsouphttpsrc.so` is moved aside (`.webosce-orig`). Every GStreamer
  user on the device gets it.
- **The registry cache must be dropped after the swap.** GLib 2.16 takes the
  home directory from passwd, not `$HOME`, so the cache is always
  `/var/home/root/.gstreamer-0.10/registry.arm.bin` (and `HOME=/tmp
  gst-inspect` silently rewrites it). On rescan, `gst_element_register` found
  the stale stock `souphttpsrc` feature, reused it, and the end-of-scan purge
  of the removed stock plugin then deleted it — plugin present, 0 features.
- Verified on hardware: TLS handshake to Google (answered 403 — the sample
  bucket is closed), the archive.org `http://` → `https://` chain, and a
  TLS-1.3-only test server (`scripts/rangeserver.py 8443 --tls CERT KEY`).
- Test media must be faststart: the archive.org sample is 455 MB with `moov`
  after `mdat`, which cannot start quickly on any source.

This is a plan, not a change log. Stock sources are pulled to
`build/work/stock-videoplayer/` (gitignored; re-pull with the command in §1.3).
Server-side requirements for streaming hosts are a separate, self-contained
document: `Docs/STREAMING-SERVER-REQUIREMENTS.md`.

---

## 1. What is actually running

There are **two** stock video players on a TouchPad, and both sit on the same
broken stack. "The built-in one" is almost certainly the first:

| Player | Where | Framework | When you hit it |
|---|---|---|---|
| **`DbViewVideo`** inside Photos & Videos (`com.palm.app.photos` 3.1.8001) | cryptofs preload, `source/DbViewVideo.js` (1858 lines) | Enyo 1.0 | Tapping any video in the Photos app. Plays inline in the photo carousel. |
| **`com.palm.app.videoplayer`** ("Videos" 1.0-150.1) | `/usr/palm/applications/`, `visible:false`, `noWindow` | Mojo + `metascene.videos` + `mediastream` frameworks | Opening a video file from Browser, Email, Messaging (mimetype handler). Not in the launcher. |

Both do the same thing underneath: create an HTML `<video>` element, set
`x-palm-media-audio-class=media`, and let WebKit's `MediaPlayerPrivate`
(`libWebKitLuna.so`) talk to **`mediaserver`** (gst 0.10 `playbin2`, Palm
hardware decoder `libpalmvideodecoder.so`, overlay sink) over the Luna bus
(`palm://com.palm.mediad.MediaPlayer_<pid>/`). The video frames never go through
WebKit — mediaserver paints an overlay and ignores the element's width/height
(`DbViewVideo.js:1377-1382`). Fit/fill is an attribute:
`x-palm-media-extended-fitmode = VIDEO_FIT|VIDEO_FILL`.

CE already touches this stack: the `mediastream` webm/mkv `<source type=video/ogg>`
reroute and the `libWebKitLuna` MIME byte-patch (bake.py ~1786, ~3677), plus the
gst opus/vpx/matroska plugins. None of that changes seek/EOS behaviour.

### 1.1 What we cannot change

`mediaserver` and `libWebKitLuna.so` are closed binaries. The rewrite has to live
entirely in the app layer and *drive the `<video>` element defensively*. Going
around WebKit (talking to `com.palm.mediad` directly via the `mediaextension`
proxy) loses the overlay placement and is what `DisconnectingState` does only for
unload — not a viable playback path.

### 1.2 Evidence status

- Hang / crash / no-restart: user's firsthand report. **No rdxd crash report on
  the dev device points at video** (the one pending report, 2026-09-08, is a
  `DashboardWindowManager` SIGSEGV — unrelated). No videos exist on the device's
  `/media/internal`, so nothing has been exercised since the last flash.
- Everything in §2 is read from the code. Phase 0 (§5) reproduces it before any
  design is committed to.

### 1.3 Re-pulling the sources

```sh
novacom run file:///bin/tar -- czf - -C /usr/palm applications/com.palm.app.videoplayer \
  frameworks/metascene.videos frameworks/mediastream frameworks/mediaextension > vp.tgz
novacom run file:///bin/tar -- czf - -C /media/cryptofs/apps/usr/palm/applications/com.palm.app.photos \
  source appinfo.json depends.js > photos.tgz
```

---

## 2. Why it hangs, crashes, and won't restart (from code)

File references are under `build/work/stock-videoplayer/`.
`DbViewVideo.js` = `com.palm.app.photos/source/DbViewVideo.js`;
`nowplaying-assistant.js` = `frameworks/metascene.videos/submission/107/javascript/assistants/`;
`MediaController.js` / `StreamingStates.js` = `frameworks/mediastream/submission/24/javascript/`.

### 2.1 Scrubbing → seek storm → hang

**Photos (`DbViewVideo`)** seeks the pipeline **on every drag move**:
`onSeeking()` (`:1045`) → `requestVideoSeek()` (`:892`) → `node.currentTime = t`.
The only throttle is `videoSeekingRequestPending`, cleared by the `seeked`
event — *or* by a 3.4 s retry timer (`:913-918`) that **re-issues the seek up to
3 more times** (`secondSeekRequestAttempt`, `:931`) because "mediaserver some
times just ignores it". So a back-and-forth scrub produces: one live seek, a
queued `seekToPosition` that fires the instant `seeked` arrives (`:976-982`),
then delayed retries of positions the user already left. It seeks **while
playing** (no pause-around-seek), so the decoder is asked to flush and re-sync
to a keyframe in both directions, repeatedly, while also rendering. On gst 0.10 +
the Palm hardware decoder, a flushing seek that lands while the previous one is
still in `flush-resume` is the classic wedge: `seeked` never comes, the pending
flag stays set, the scrubber freezes, and the retry timer keeps poking a dead
pipeline. The `mediaserver` watchdog (`x-palm-watchdog-triggered`) then either
recovers the session or the daemon goes down with it — the Photos code's own
comment at `:926` ("most likely that the mediaserver is crashed causing the video
node not usable") says they saw exactly this.

**Mojo (`nowplaying-assistant.js`)** is better on the slider (it pauses on
`sliderDragStart` and seeks once on `sliderDragEnd`, `:334-362`) but flick
gestures set `currentTime` directly with no gate (`_doVideoFlick`, `:237`), the
held-seek callback fires every 600 ms (`MediaController._seekCallback`), and
nothing waits for `seeked` anywhere.

### 2.2 Won't restart after the stream ends

**Photos**: the `ended` handler (`DbViewVideo.js:435-453`) calls `pauseVideo()`
and then immediately `node.currentTime = 0` — a seek issued at EOS on a pipeline
that has just delivered EOS, with no wait for `seeked`. Next tap → `playVideo()`
→ `node.play()` (`:1152`). If the seek-to-0 was one of the ones mediaserver
"ignores", `play()` at EOS is a no-op: the button flips to pause, the monitor
starts, nothing moves.

**Mojo**: `_ended` (`:852`) just pauses. On the next play the position is reset
to 0 *only* if `|currentTime − duration| ≤ 0.1` (`:821-824`); the comment admits
mediaserver "doesn't call ended at *exactly* the duration". `MediaController.play`
has its own rewind path guarded by `this._ended` (`MediaController.js:39`) —
**nothing ever sets `_ended`**; it is dead code. So on most files the restart
path is `play()` at EOS, which does nothing.

### 2.3 Periodic crashes

Two candidate mechanisms, both need Phase 0 to confirm:

1. **mediaserver watchdog / SEGV during a seek storm** (§2.1). Recoverable in
   principle — the app just never recovers: `DbViewVideo` has no handler for
   `x-palm-disconnect` / `x-palm-watchdog-triggered` at all; the Mojo engine maps
   both straight to `ErrorState` = modal "There was an error playing the file"
   and back out (`StreamingPlayEngine.js:303-318`).
2. **Stale-node use after destroy.** `DbViewVideo` keeps timers (`playMonitorId`,
   `updateSeekerId`, `secondSeekRequestAttemptId`, the 250 ms `doPause` retry loop
   `:1204-1214`) that outlive swipes; `destroy()` (`:1762`) clears none of the
   seek/pause timers. A retry landing on a removed `<video>` node inside
   WebAppMgr is the kind of thing that takes the whole `LunaSysMgr`/WebAppMgr
   process down — which the user would see as "Photos crashed".

Also worth noting: `IS_LOADEDING` (`:1169`, `:1195`) is a typo for `IS_LOADING`
— those `switch` arms never match, so tapping play while a video is still
loading takes the `default` path.

### 2.5 Phase 0 results (hardware, 2026-09-14)

Setup: four ffmpeg-generated clips with burned-in timecode pushed to
`/media/internal/Videos/` (§4), `ls-monitor -f com.palm.mediad` capturing the
bus (`build/work/test-media/lsmon-stock-scrub.log`, 4105 lines), `media-pipeline`
lines from `/var/log/messages`, and a host HTTP server for the stream cases.
User drove the touch UI; every state claim below is theirs, every number is
from the traces. `mediaserver` pid 1898 and the rdxd report count were
unchanged throughout — **no crash was provoked in ~25 min of abuse**, so §2.3
stays a hypothesis.

**Seek latency is keyframe distance, not a wedge** (Photos, local 720p H.264,
10 s GOP). Seek → `seeking:true` ack: 0.18–0.29 s when the target is a
keyframe, 1.3–3.3 s when it is 5–8 s past one. The hardware decoder prerolls
from the previous keyframe at ~100 fps. The stock 3.4 s retry timer sits right
on that edge. Each far seek also shows `gst_element_get_state returned
GST_STATE_CHANGE_ASYNC` ~2 s after the request: mediaserver blocks on the
pending preroll before it will accept the next command.

**A drag is a seek storm.** 8 pipeline seeks in 200 ms during one drag
(≈40/s). Photos never pauses before seeking. Freeze the user saw = several of
those queued behind 2–3 s prerolls.

**Restart after EOS — works on a well-formed file, fails on unknown
duration.** 30 s faststart mp4: 4/4 restarts in Photos, 3/3 in the Mojo
player. Fragmented mp4 (`empty_moov`, indexer stored `duration: 0`, pipeline
logs `Query duration failed`): Mojo player shows `Infinity:NaN` tallies; play
after EOS tears the session down, `load`s a new one (`duration: -1`), sends
`seek(0)` — **and never sends `play`**. It is waiting on `canplaythrough`,
which WebKit does not fire for an unknown-length source. Black flash (pipeline
rebuild) then a frozen first frame. Three taps, three identical traces.

**HTTP without Range wedges the pipeline permanently.** Python `http.server`
(no Range support): first seek → `souphttpsrc` re-GETs from byte 0 →
`Play: Could not get pipeline state`, `failed to set the state to PLAYING`,
1514 `ffdec_aac` error lines, scrubber twitching between two positions, no
recovery from further seeks or play. Same file on a Range-capable server
(`rangeserver.py`, 206 + `Content-Range`): scrubbing works; the client issues
one `Range: bytes=N-` request per seek and resets the previous connection.

**The crash, caught in Phase 1 (2026-09-14 17:33:56, rdxd_log_2):**
`media-pipeline.real` SIGSEGV in `libPmMediaGstVideoSinkLib.so`:
`_vhm_rotate ← vhm_get_rgb ← rgb_capture ← palm_videosink_set_property`. The
video sink's RGB frame capture (mediaserver's `videoFrameCapture` property —
it snapshots a frame on seeks/pauses for the card image) ran on a pipeline that
had no decoded frame yet: the app's seek to 83.5 s landed 70 ms after the
pipeline's own seek-to-0 on a just-(re)loaded source. `readyState` was already
4, so readiness cannot be read from the element — it is a timing rule
(`POST_LOAD_SEEK_HOLD`). The pipeline process is per session, so `mediaserver`
survives; the element gets an error / `x-palm-disconnect`, which the stock
players turn into a black card or a modal, and which the engine's Rule 6
recovered from. The saved report is `build/work/test-media/crashes/`.

**Also found:** the mediaindexer never lands `.webm` in db8 (parsed by
`fileparserd`, no `com.palm.media.video.file:1` row) — separate CE issue;
Photos' launch params (`albumID`/`pictureID`) do not switch the current picture
if the card is already open — close and relaunch for tests.

### 2.4 Smaller things a rewrite gets for free

- Scrubber position is polled at 80 ms (10 ms for clips < 30 s) via
  `setInterval` and *interpolated* against wall-clock because mediaserver only
  updates `currentTime` ~5 Hz (`:1466-1471`, `:1571-1578`). Use `timeupdate` and
  interpolate from the last event instead.
- `viewSizeCode` and `playedStates` are written to the **prototype**
  (`this.ctor.prototype.…`, `:1439`, `:1661`) — shared across every instance.
- Fit/fill only works while playing (`:1249`), mediaserver limitation; the
  rewrite should re-apply the attribute on every `play`.
- Last-position resume writes `lastPlayTime` to `com.palm.media.video.file:1`
  (Photos) vs `playbackPosition` on the Mojo side — two incompatible schemas.

---

## 3. The rewrite

### 3.1 Shape

One new Enyo 1.0 app, **`com.palm.app.videos`** (title "Videos"), that owns
video playback everywhere:

- Launched by Photos & Videos for `mediaType === "video"` (small patch in
  `DbImageView.js:618-632` where it currently instantiates `DbViewVideo`; applied
  by `edit_photos()` in bake.py like the existing Photos patches).
- Registered as the handler for `video/*` so Browser/Email/Messaging attachments
  open it instead of `com.palm.app.videoplayer`. `com.palm.app.videoplayer` stays
  on disk (non-removable; Messaging and Device Info reference its id) — its
  `app-assistant.js` becomes a relaunch shim that forwards its `target`/`video`
  launch params to the new app.
- Accepts the same launch params both callers already send:
  `{ _id | video:{…} | target:"/path", title, initialPos }`.

Why a separate app rather than fixing `DbViewVideo` in place:

- **Testable without taps** — launch by `luna-send` with a path, drive the seek
  gate from a `selftest` launch param that calls the *same* methods the slider
  calls (memory: `verify-ui-by-looking`, `photos-app-ce-changes`). Inline in the
  Photos carousel there is no such entry point.
- One code path instead of two divergent ones (Photos inline + Mojo handler).
- Photos' carousel (`DbImageView`, swipe-in/out, show/hide-controls groups) is
  where most of the lifetime bugs in §2.3 come from. A single-purpose card has
  one `<video>` with one lifetime.
- Trade-off: tapping a video in Photos opens a card instead of playing inline,
  and you can't swipe photo→video→photo. That is how webOS 1.x/2.x worked. See
  §7 — this is the decision to make before Phase 2.

### 3.2 Core: `VideoEngine` (the only thing that touches `<video>`)

~400 lines, framework-agnostic, unit-testable in a desktop browser with a fake
element. Everything else (UI, db8, launch params) goes through it.

**Rule 1 — one in-flight operation.** `load`, `seek`, `play`, `pause` are queued;
the next starts only when the current one has produced its completion event
(`loadedmetadata`, `seeked`, `playing`, `pause`) **or** its deadline expires.

**Rule 2 — seeks coalesce to the newest target.** A `seek(t)` while another seek
is in flight replaces the pending target; it never queues a history of positions.
No retries of old positions. Minimum spacing between pipeline seeks: 300 ms.

**Rule 3 — scrubbing does not seek the pipeline.** While the finger is down the
scrubber and time labels track the finger locally. The pipeline gets **one** seek
on release. (Option, off by default: a throttled ≤2 Hz preview seek while dragging
*and* paused — evaluate in Phase 1, keep only if it cannot wedge in the soak.)

**Rule 4 — pause around seek.** If playing when the seek is requested: `pause()`
→ wait for `pause` → `currentTime = t` → wait for `seeked` → `play()`. The Mojo
player already does this and it is the one that doesn't hang on the slider.

**Rule 5 — EOS is a state, not a position.** On `ended`: set `atEnd = true`, show
play, do **not** touch `currentTime`. On the next play from `atEnd`: seek to 0 via
the gate, wait for `seeked` (deadline 1.5 s), then `play()`. If `seeked` does not
come, fall through to Rule 6.

**Rule 6 — deadlines recover, they don't retry.** Any step that misses its
deadline (load 8 s, seek 1.5 s, play/pause 1 s) triggers a **reload**: remember
the target position, `removeAttribute('src')`, `load()`, then `src = url`,
`load()`, seek to the remembered position once `loadedmetadata` arrives, resume
if it was playing. Two consecutive reloads → **rebuild**: remove the `<video>`
node, create a fresh one, same procedure (the Photos comment says the node is
unusable after a mediaserver crash; a fresh element gets a fresh
`x-palm-media-control` session). A third failure surfaces an error with a Retry
button — no modal-and-pop-scene.

**Rule 7 — mediaserver lifecycle events are inputs, not fatal.**
`x-palm-disconnect`, `x-palm-watchdog-triggered`, `error` (except
`MEDIA_ERR_ABORTED`) → rebuild via Rule 6, keeping position.

**Rule 8 — one owner of every timer.** All `setTimeout`/`setInterval` handles
live in the engine and are cleared in `destroy()`. Nothing in the UI layer holds
a timer that can touch the element.

**Rule 9 — seekability is decided before the first seek, never assumed.**
After `loadedmetadata`: `duration` finite and > 0 **and** `seekable.length > 0`
with `seekable.end(0) > 0` (WebKit derives it from `maxTimeSeekable`, which
mediaserver sets from the source's Range support and known length) → seekable.
Otherwise the scrubber is a progress indicator only (no drag, no flick), the
time labels show elapsed with no remaining, and no `currentTime` write is ever
issued for that source. Unknown duration is displayed as `--:--`, never `NaN`.
This covers non-Range HTTP hosts, chunked responses, fragmented MP4 and live
sources with one rule.

**Rule 10 — a play that does not start is a failure, not a wait.** After
`play()`, if neither `playing` nor `timeupdate` arrives within the deadline
(1.5 s local, 6 s HTTP — measured HTTP start was ~2.5 s), treat it as Rule 6.
For an unseekable source, "restart after EOS" is *always* a reload from 0 (new
`src` assignment), never a seek — that is the path the stock player never takes.

**Rule 11 — pipeline error floods are terminal.** An `error` event, or
`x-palm-media-extended-error` changing, during a seek or play → rebuild (Rule 6)
immediately; do not wait for the deadline. The non-Range wedge produces no
`error` event at all — that is what the deadline in Rule 10 is for.

**Time display:** `timeupdate` events (WebKit fires them at ~4 Hz) feed
`lastTime/lastWall`; the scrubber renders `lastTime + (now − lastWall)` at 10 Hz
while playing. No polling of `currentTime`.

### 3.3 UI (deliberately small)

Full-screen dark card, orientation free. Header: title (basename, HTML-escaped —
copy Photos' convention). Bottom bar: play/pause, elapsed, scrubber with buffered
range, remaining, fit/fill. Tap video = toggle bars; bars auto-hide 5 s after
play, never while paused. Flick left/right = ±10 s / ±30 s through the seek
gate. Headset unplug → pause (subscribe `palm://com.palm.keys/headset/status`
like Photos). `blockScreenTimeout` while playing only. Card deactivate → pause,
persist position. Back-swipe / close → persist position, destroy engine.

Resume position: write `lastPlayTime` to `com.palm.media.video.file:1` (the
Photos schema — it is what the library UI already reads for the resume badge);
also honour `initialPos` from launch params.

Not in scope for v1: sharing/YouTube upload (`metascene.videos.share`), trim
(`videoeditor-assistant.js`), RTSP/live streams, the storaged/MSM dance (the
card is simply closed by the launcher when USB mode starts, and it persists
position on deactivate).

### 3.4 Packaging

- `AddToImage/NewApps/com.palm.app.videos_<ver>_all.ipk` — baked like
  usbsettings/btgamepad (`addtoimage-convention`). Enyo 1.0 from
  `/usr/palm/frameworks/enyo/1.0` (same as Photos; nothing new on the rootfs).
- Photos handoff: `build/full-ce/photos-exhibition/patches/DbImageView-video-handoff.patch`,
  applied in `edit_photos()` **after** the synergy patches (patch order is
  load-bearing — memory `photos-app-ce-changes`).
- `com.palm.app.videoplayer` shim: a `PatchOrReplace` ipk carrying only
  `app-assistant.js`, or a bake-time overwrite of that one file. Prefer the
  bake-time overwrite (no second package to version).
- Mimetype registration at **runtime** (`ce-register-*` pattern — a static
  `command-resource-handlers` entry was the wrong tool last time, memory
  `ipk-browser-handoff-investigation`): the app's own first-launch (or a boot
  job) calls `com.palm.applicationManager/addResourceHandler` for `video/mp4`,
  `video/3gpp`, `video/webm`, `video/x-matroska`, `video/quicktime` with
  `shouldDownload:false`… verify on device in Phase 3 that the streamable flag
  behaves for video the way it did for ipk.

---

## 4. Test media

There are none on the device. Generate locally (ffmpeg is installed) into
`build/work/test-media/`, push to `/media/internal/Videos/` with novacom, then
kick `filenotifyd`/mediaindexer (or just remount — the indexer picks them up):

| File | Purpose |
|---|---|
| `bars-3m-720p-h264.mp4` — 3 min, `libx264 -profile baseline -g 250 -bf 0`, AAC, burned-in timecode | long GOP (10 s keyframes) = worst case for backward seeks |
| `bars-30s-h264.mp4` — 30 s, `-g 30` | short clip; exercises the < 30 s code paths and rapid EOS loops |
| `bars-3m-vp8.webm` | the CE webm reroute path |
| `bars-3m-720p-h264-frag.mp4` — `-movflags frag_keyframe+empty_moov` | moov-at-end / fragmented = the "seek ignored" case |
| `real-phone-clip.3gp` (any real capture, if available) | non-synthetic timing |

Burned-in timecode (`drawtext=text='%{pts\:hms}'`) is what lets a screenshot
prove a seek landed where the scrubber said.

---

## 5. Phases and exit criteria

### Phase 0 — reproduce and instrument (no app code) — DONE, see §2.5

Recipes that now serve as the regression suite (all launch by `luna-send`,
touch by hand, evidence = `pidof mediaserver`, rdxd count, `media-pipeline`
log lines, `ls-monitor -f com.palm.mediad`):

| # | Recipe | Stock result |
|---|---|---|
| R1 | Photos on `bars-3m-720p-h264.mp4` (10 s GOP), scrub hard 10 s while playing | 2–3 s freezes per far seek, 40 seeks/s issued |
| R2 | Photos on `bars-30s-h264.mp4`, play to end, play again ×4 | works |
| R3 | Mojo player on `bars-30s-h264-frag.mp4`, play to end, play again | **fails**: `Infinity:NaN`, black flash, frozen frame 0, no `play` on the bus |
| R4 | Mojo player on `http://host:8080/bars-3m-720p-h264.mp4` from **python `http.server`** (no Range), scrub | **wedges permanently** |
| R5 | same URL from `rangeserver.py`, scrub + play to end | scrubbing works |
| R6 | Photos on the 3 min file, seek near end, let it end, play | works |

Not yet run: R7 https URL (expected to fail at TLS — GnuTLS 2.x), R8 card/uncard
mid-play, R9 low-memory.

Launch commands (`luna-send -n 1 palm://com.palm.applicationManager/launch …`):
- Photos: `{"id":"com.palm.app.photos","params":{"albumID":"<album _id>","pictureID":"<video _id>","mediaType":"video"}}` — ids from db8 `com.palm.media.image.album:1` / `com.palm.media.video.file:1` with `-a com.palm.app.photos`; close any open Photos card first.
- Mojo: `{"id":"com.palm.app.videoplayer","params":{"target":"<path or http URL>","videoTitle":"…"}}`.
- Host server for R4/R5: `python3 -m http.server 8080` (no Range) vs `scripts/rangeserver.py 8080`.

### Phase 1 — `VideoEngine` + a bare card

Engine + minimal UI (play, scrubber, times). Launch by path only. Ship to the
device as a dev ipk (not baked). Run the Phase 0 repro recipes against it.

**Exit:** 200 scrub cycles (script-driven through the engine's public methods +
by hand), 20 play-to-end-then-play loops, 20 card/uncard-mid-play cycles on each
test file, with `pidof mediaserver` unchanged and rdxd count unchanged. Verified
by looking, not by logs (`verify-ui-by-looking`).

### Phase 2 — integrations

Photos handoff patch, videoplayer shim, launch-param parity, resume position,
headset, fit/fill, orientation. Add to the CE build (`AddToImage/NewApps` +
`edit_photos()`), bake, flash a fresh device (`media-partition-survives-reflash`
— clear `/media/internal/Videos` first so the indexer path is fresh).

**Exit:** `scripts/ce-test-full.sh` gains a video section; results file shows it.

### Phase 3 — mimetype handler + soak

Runtime resource-handler registration; open a video from Browser and from an
Email attachment. 24 h reboot soak (`ce-reboot-soak.sh`) with the app opened on
every boot via the boot-test hook.

### Phase 4 — retire

Decide whether `metascene.videos*` / `mediastream` can drop from the image
(~300 KB) or must stay for the deviceinfo/messaging references. Update
`KNOWN-ISSUES.md`, `TEST-PLAN.md`, release notes.

---

## 6. Risks

- **The hang is inside mediaserver, not just triggered by the app.** If Phase 0
  shows a *single* well-spaced seek can wedge the pipeline on some file, the
  engine's reload/rebuild path (Rule 6) is the mitigation, not a cure; the plan
  still stands but the exit criteria loosen to "recovers within 3 s".
- **Overlay + card handoff.** Opening a second card while Photos still holds a
  paused `<video>` means two mediaserver sessions; audio-class arbitration
  ("paused true by arbitrator" in the WebKit strings) may pause the new one.
  Photos must destroy its element before launching us — the handoff patch has to
  do that, not just call `launch`.
- **`addResourceHandler` semantics for video** are unverified (see §3.4).
- **Enyo 1.0 card in the Photos app's place** changes UX (§3.1 trade-off).

---

## 7. Decisions (taken 2026-09-14)

1. **Standalone card**, not a fix inside Photos (§3.1).
2. **No preview seeking** while scrubbing — seek on release only.
3. **Shim `com.palm.app.videoplayer`** so Browser/Email hand-offs land in the
   new app. Streams are the user's primary pain point; assume most hosts are
   not Range-capable and make the app survive that (Rules 9–11).
