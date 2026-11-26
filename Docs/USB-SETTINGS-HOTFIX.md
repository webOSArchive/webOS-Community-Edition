# USB Settings "Helper not running" — hotfix specification

**Status: diagnosed and reproduced on hardware (600070, released). Fix not written.**

**Status 2026-11-26:** still open, and still in 3.2.0 (600121/600122): the baked
ipk is still `com.webosarchive.usbsettings_1.1.9`, the latch in
`usbctl-watchd.sh` (`LAST_STATUS="$s"` before the write, ~line 299) is
unchanged, and `bake.py` still seeds no ipkg status stanza for it. The
technical fix below stands. The OTA landscape in §2 and Option C has moved on:
3.2.0 itself shipped by OTA, OTA Ready 3.0.0 is the client in production, and
the armed flash was proven on 2026-11-20 (`Docs/OTA-HANDOFF.md`, now the OTA
source of truth). With those blockers gone, the fix can ride the next CE OTA.

This document says what a hotfix has to do and why. It is a specification, not a
change log — nothing described here has been built.

Related: `KNOWN-ISSUES.md`, the entry "USB Settings reports 'Helper not running' on every fresh flash" (the fault itself, with the hardware evidence).

---

## 1. What has to be fixed

`usbctl-watchd.sh` latches its write-suppression cache *before* the write it is
suppressing, so a failed write poisons the cache permanently:

```sh
    [ "$s" = "$LAST_STATUS" ] && return          # unchanged -> no write, no fork
    LAST_STATUS="$s"
    echo "$s" > "$STATUS.tmp" 2>/dev/null && mv -f "$STATUS.tmp" "$STATUS" 2>/dev/null
```

The daemon starts at ~3 s of uptime (`start on stopped rcS`); `/media/internal`
does not mount until ~2 min. Every boot, the first `write_status` fails silently
against the read-only root — but `LAST_STATUS` already holds the current JSON, so
the 1 Hz loop early-returns forever and `/media/internal/.usbctl-status` is never
created. `GetStatusAssistant.js` reports `daemon:false` when it cannot read that
file, which is the warning row the user sees.

`state_save` has the same shape and fails the same way, so `armed=yes` never
persists and the OTG controller is re-armed on every boot. Harmless in itself;
same root cause; fixed by the same change.

### 1.1 The source change

Two edits in `usbctl-watchd.sh`. Latch only on success:

```diff
     [ "$s" = "$LAST_STATUS" ] && return
-    LAST_STATUS="$s"
-    echo "$s" > "$STATUS.tmp" 2>/dev/null && mv -f "$STATUS.tmp" "$STATUS" 2>/dev/null
+    echo "$s" > "$STATUS.tmp" 2>/dev/null && mv -f "$STATUS.tmp" "$STATUS" 2>/dev/null \
+        && LAST_STATUS="$s"
```

and move the state seed off the one-shot startup path into the loop, so it
retries once `/media/internal` arrives:

```diff
-[ -f "$STATE" ] || echo "power=off" > "$STATE"
-state_load
-write_status
-
 while true; do
+    [ -f "$STATE" ] || { echo "power=off" > "$STATE" 2>/dev/null && state_load; }
```

Leave the upstart job's `start on stopped rcS` alone. Retrying is more robust
than guessing a later start event, and a later start event would delay OTG
arming.

**These edits belong in the `com.webosarchive.usbsettings` ipk** (bumped to
1.1.10), not in the generated overlay: `build/full-ce/bake.py` §15 copies
`usbctl-watchd.sh` out of the ipk into `usr/bin/usbctl-watchd`, and
`build/overlays/full-ce/` is wiped and regenerated on every bake. Patching the
overlay copy would be silently reverted by the next build.

---
## 2. Why it cannot ship as an image change alone

600070 is released. The daemon lives at `/usr/bin/usbctl-watchd` on the
read-only root, baked at flash time. Fixing the ipk fixes the *next* image;
it does nothing for devices already in the field.

Two channels exist: Preware, and the community OTA. The authoritative OTA
document is now `Docs/OTA-HANDOFF.md` (when this section was written it was
`OTA-3.1.0.md` in the `webos-update-exploration` repo).

*Status 2026-11-26:* the rest of this section is the 2026-09 picture. Since
then OTA Ready 3.0.0 replaced 1.2.0 and is in production (App Museum II),
3.2.0 shipped as a real OTA payload (so "no real payload exists" no longer
holds), and the armed flash was proven on hardware on 2026-11-20.

600070 bakes only the OTA **trust anchor**: `/usr/bin/ce-ota-verify` and
`/usr/share/ce-ota/keys/ce-ota-signing.pub`. The client is not in the image. But
`org.webosarchive.otaready` 1.2.0 — the readiness app, its root daemon, and a
working `com.palm.app.updates` reroute — **is already deployed to users**, and it
restores onto CE 3.1.0 with its service on the bus (`Docs/TEST-PLAN.md:461`). The
planned OTA Ready v2 is the bootstrapper and reaches those users as an ordinary
app update.

That makes the OTA a real third option here, and an unusually well-matched one:
`OTA-3.1.0.md`'s open item #5 is "no real OTA payload exists". See Option C.

### 2.1 3.0.5 devices are not in the same position

The same defect is in the same script on 3.0.5, but it does not produce the
symptom there, because the package's postinst ends with `start usbctl-watchd` —
run at install time, on a device where `/media/internal` has been mounted for
some while. The daemon's first-ever `write_status` therefore succeeds,
`.usbctl-status` is created, and nothing ever removes it. Later boots fail the
3-second write exactly as CE does, but the file is already there.

CE is exposed because it **bakes** the app: `bake.py` §15 replays the postinst's
*file* effects at build time and cannot replay `start`, so the daemon's first-ever
execution is the cold-boot one, with nothing mounted.

*(Source-level conclusion, from the ipk's postinst and the daemon. Not verified on
3.0.5 hardware.)*

3.0.5 does carry one live consequence of the same latch: the status file goes
stale across a reboot. Shut down with the OTG cable in, boot without it, and the
boot-time write computes `peripheral`, latches it, then fails — leaving the file
saying `host`. The app shows On-the-Go as on until the next real state change.
So 1.1.10 is worth shipping to 3.0.5 on its own merits.

### 2.2 The hazard on the CE side: a bus-name clash

CE **seeds no ipkg status stanza** for `com.webosarchive.usbsettings`.
`STATUS_SEED_DESC` (`bake.py:3232`, plus `PATCH_SEED` for the TLS patch set right
after it) covers Govnah, Synergy, Backup, Videos and Calculator — not
usbsettings (still true 2026-11-26). Preware's `isInstalled` is a pure name match against
`/media/cryptofs/apps/usr/lib/ipkg/status`, so on a CE device USB Settings shows
as **not installed today**, and a 1.1.10 of the same id would arrive as a fresh
install into `/media/cryptofs/apps` — not as an upgrade of the baked copy.

That install brings a *service* directory with it, and bake.py's de-shadow pass
already states the cost (`bake.py`, ~line 4209):

> a stale cryptofs SERVICE is worse than a stale app dir: the roles LunaSysMgr
> generated for it claim the same bus name the baked image now claims
> statically, and ls-hubd drops both on a clash.

The baked image claims `com.webosarchive.usbsettings.service` statically —
confirmed on hardware in `/usr/share/ls2/roles/{prv,pub}/` and
`/usr/share/dbus-1/{services,system-services}/`. A cryptofs install claims the
same name dynamically. If ls-hubd drops both, the JS service is gone outright:
the warning row becomes permanent *and* the High-power workaround stops working,
because there is no service left to carry the toggle.

The de-shadow job that would clear this is gated on a once-per-flash `/var` flag,
so it does not rescue an install performed after the flash.

**Not tested.** This is bake.py's own documented reasoning plus the static
registration verified on hardware — not an observed collision. Whichever option
below is chosen, this is the first thing to put on a device.

Note that this hazard is specific to *Preware* delivery. An OTA payload writes
the rootfs directly and never creates a second registration, so Option C sidesteps
this section entirely — see §3, Option C.

---

## 3. Three options

All three start from the same 1.1.10 source change (§1.1). They differ in how it
reaches a CE device.

### Option A — one package, CE-aware postinst

Ship `com.webosarchive.usbsettings` 1.1.10 to the feed for both platforms, and
teach its postinst to recognise a baked install.

```sh
BAKED=/usr/palm/applications/com.webosarchive.usbsettings
if [ -d "$BAKED" ] && [ "$APP_DIR" != "$BAKED" ]; then
    # CE: the image owns the app, the launcher entry and the ls2/dbus
    # registration. Refresh only the root-side daemon, then delete our own
    # cryptofs payload so it cannot shadow the static registration.
    ...refresh /usr/bin/*, restart usbctl-watchd...
    rm -rf "$IPKG_OFFLINE_ROOT/usr/palm/applications/com.webosarchive.usbsettings"
    rm -rf "$IPKG_OFFLINE_ROOT/usr/palm/services/com.webosarchive.usbsettings.service"
    rm -rf "$IPKG_OFFLINE_ROOT/usr/palm/packages/com.webosarchive.usbsettings"
fi
```

This is the same move CE's own de-shadow pass makes, performed by the package
instead of the image. On 3.0.5 the baked path does not exist and the postinst
behaves exactly as it does today.

**For:** one package, one version number, one feed entry; 3.0.5 and CE converge
on the same daemon; no new package id to maintain or explain.

**Against:** a package that deletes most of its own payload is unusual, and ipkg's
recorded file list will then not match what is on disk — `ipkg remove` and any
later upgrade have to tolerate that. It also runs on CE devices we cannot test
ahead of publishing, and the failure mode if the self-de-shadow does not complete
is the §2.2 clash. The `Installed-Size` and the launcher's view of the package
both become mildly dishonest on CE.

### Option B — two packages

Leave `com.webosarchive.usbsettings` 1.1.10 as an ordinary 3.0.5 update, and ship
a separate CE-only package that touches no app directory at all.

**Proposed id:** `org.webosarchive.usbctl-watchd-fix`, version `1.0.0`, following
`org.webosarchive.help-redirect` / `org.webosarchive.tls-updates`: no app, no
launcher entry, all the work in the postinst.

| File | Purpose |
|------|---------|
| `…/org.webosarchive.usbctl-watchd-fix/usbctl-watchd.sh` | the patched daemon (1.1.10 content), staged where the postinst can find it |
| `control` / `postinst` / `prerm` | §3.1-3.3 |

No `appinfo.json` the launcher would pick up — check how `help-redirect` avoids
one and copy that exactly.

**For:** cannot collide with the baked registration, because it installs no app
and no service. Each platform gets a package shaped for it. Testable on CE
without risking the 3.0.5 feed.

**Against:** two artefacts, two version numbers, and a CE-only package that is
dead weight on the next image (it must no-op against a fixed baked daemon —
see the version guard in §3.1). Users on CE see a package whose purpose is
opaque, so the description has to carry its own explanation.

### Option C — ship it as the first community OTA payload

*Status 2026-11-26:* written before any OTA shipped. "OTA Ready v2" became
OTA Ready 3.0.0 (in production); open item #5 (no real payload) closed when
3.2.0 shipped by OTA, so this would no longer be the *first* payload; open item
#4 (the unverified armed flash) closed on 2026-11-20. What remains is simply:
put the fixed daemon in the next CE OTA. See `Docs/OTA-HANDOFF.md`.

Deliver the patched daemon through OTA Ready v2 instead of as a Preware package
of our own: a signed manifest naming one file, verified on-device by the baked
`ce-ota-verify`, applied by the client.

The fit is unusually good in both directions. We need a channel that cannot
collide with the baked registration; the OTA project needs a real payload for its
open item #5, having only a placeholder offer on the server today. And the manual
install this would normally cost is already spent — v2 reaches existing OTA Ready
users as an app update, not a new install.

**The payload mechanism, confirmed.** Reviewed against
`../webos-update-exploration/OTA-UPDATE-GUIDE.md` and
`webos-update-server/device-scripts/direct-update.sh` on 2026-09-04. Palm's OTA
never shipped a system image — the Doctor is the full-image path, and an OTA is a
**list of ipks** installed by `PmUpdater`/`mmipkg`. There is no binary-delta
support anywhere in the mechanism: a file inside an ipk is replaced whole.
"Delta" exists only at *package* granularity, which is exactly the granularity we
want. **A single-file payload is the natural unit here, not a special case** — an
8 KB update is an 8 KB update.

**Two install paths, and only one of them is dangerous.**

| Tier | What it does | Risk |
|------|--------------|------|
| Armed flash | `make-update-uimage` builds a ~9 MB ramdisk, repoints `/boot/uImage`, reboots; `PmUpdater` installs against `/rootfs`; reboots back. Requires an `updatefsinfo` package declaring `UPDATEFS_KB`/`INODES`. | Open item #4. Can strand a device. |
| Running-system install | `ipkg`/`mmipkg install` on the live device. No ramdisk, no `/boot`, no reboot. | Bounded by what the payload touches. |

The ramdisk tier exists for what a running system cannot do: replace files that
are held open, and — on CE specifically — write a read-only root. Our payload
needs neither. The daemon is restartable and the root is remountable at runtime
under `/tmp/.ce-rootfs-rw.lock`.

**So the hotpatch tier is not a new mechanism anyone has to invent.** It is the
running-system path with signature verification in front of it: fetch signed
manifest, verify, take the lock, remount rw, replace, restore ro, restart the job,
record the version. No `updatefsinfo`, no `make-update-uimage`, no reboot.

So Option C closes open item #5 and proves signed delivery end to end, but it does
**not** exercise open item #4, the unverified armed flash. Do not let the payload's
harmlessness be read as evidence about that path: a benign payload bounds the
damage of a failed *apply*, not of a broken *flash mechanism*, which bricks
regardless of what it carries. The armed flash deserves its own milestone on a
bench device, proven separately.

**An OTA can write the rootfs; a Preware package effectively cannot.** This is
the strongest argument for C, and it was not available when §2.2 was written. The
clash hazard exists *only* because a Preware ipk lands in `/media/cryptofs/apps`
on CE and registers its service dynamically against the baked static claim. An
OTA payload installs into the rootfs natively and replaces the baked file in
place — there is no second registration, so there is no clash to reason about.
**Option C is the only one of the three that removes the §2.2 hazard rather than
working around it**, and it is the only one that does not depend on answering
open question 1 first.

**For:** no new package id, no collision surface, no dead weight after the next
image; unblocks another project's blocker with the same work; exercises the trust
anchor 600070 shipped for exactly this.

**Against:** schedule coupling — the fix lands when v2 lands. Reaches only users
who have OTA Ready installed, so it is not a complete answer for the field on its
own. And it is the least-tested delivery path of the three.

**What an OTA payload can actually do — read from `mmipkg` source, 2026-09-04.**
`/usr/bin/mmipkg` in the shipped 3.1.0 rootfs is a `/bin/sh` script, so this is
read rather than inferred. Four properties matter for a payload of ours:

- **No path restriction.** `unpack_data` is `ar p $ipk data.tar.gz | tar -C
  $ROOT_DIRECTORY -xvzf -`. No allowlist, no protection of system directories.
  `/usr/palm/applications/`, `/usr/bin/`, `/etc/event.d/` and `/usr/share/ls2/`
  are all writable by a payload.
- **In the ramdisk the rootfs is mounted rw.** `ota.sh:239-244` mounts
  store-root rw at `/rootfs`, plus `/boot`, `/var`, `/var/log`,
  `/var/lib/update` and `/media/internal`. **CE's read-only root is simply not a
  factor on the armed-flash path** — no remount, no lock, no `mv`-vs-`cp` hazard.
  That is the one thing the heavy tier does better than the hotpatch tier.
- **`postinst` runs, and a nonzero exit fails the entire update.** `install_ipk`
  runs `preinst` → unpack → `postinst`; in the ramdisk via
  `chroot /rootfs /usr/lib/ipkg/info/<pkg>.postinst`, and `run_script` ends with
  `if [ $? -ne 0 ]; then fail "Script execution failed"`. **Any OTA postinst must
  `exit 0` unconditionally** — `mmipkg` is far less forgiving than the `ipkg`
  Preware drives. It also runs with no Luna, no D-Bus, and the *ramdisk's*
  upstart rather than the target's, so `luna-send` and `start <job>` do nothing
  useful there; rely on `post-update`'s reboot for anything service-shaped.
- **Replacing an app's files is not enough to replace the app.** webOS serves
  cached app code — a payload touching `/usr/palm/applications/<id>/` must also
  bump that app's `appinfo.json` `version`. The reboot handles the restart; it
  does not handle the cache.

**An upgrade is remove-then-install, not an overlay.** This is the trap most
likely to cost someone a device. `install_prep` treats a package as *existing*
iff `/usr/lib/ipkg/info/<pkg>.control` is present; if it is, `install_ipk` calls
`remove` **first**, which runs `prerm` and deletes every file in the old
`.list` — protected only by files owned by packages not in the update. So a
partial single-file ipk claiming an existing package id **deletes the rest of
that package**. A single-file payload is safe only as a *new* package id, or as
a *complete* replacement of an existing one.

**We are safe here by accident, and the accident is worth protecting.** The
shipped rootfs has **zero** entries for `com.webosarchive.usbsettings` under
`/usr/lib/ipkg/info/` — verified against `rootfs.ce.tar.gz`. The app directory is
baked; the package was never registered with the rootfs ipkg database. So
`mmipkg` classifies our payload as new, skips the remove step, and cleanly
overlays the baked files. Note this is a **different database** from the one
Preware reads (`/media/cryptofs/apps/usr/lib/ipkg/status`), which is the one
§1.1 recommends seeding. Seeding the *rootfs* database for this package would
silently turn the same payload destructive — see open question 5.

**Two traps to know before building a payload.** Neither blocks a hotpatch; both
are cheap to get wrong later. (1) `direct-update.sh`'s `create_session_files`
orders the package list with `sort -r`, so `updatefsinfo` ends up first only
because `u` sorts after `c`. That is not an explicit ordering rule — a package
named later in the alphabet would silently displace it and fail
`make-update-uimage`. Irrelevant to a hotpatch, which builds no ramdisk, but it
is waiting for whoever attempts the first armed flash. (2) Overwriting a baked
rootfs file diverges its ipkg `md5sums`, exactly as `OTA-3.1.0.md` already notes
for `UpdatesApp.js`. Harmless at runtime, since `integcheck` is a flash-time
gate, but it will surface for anyone who runs it afterwards; §1.1's fold into the
next image is what actually resolves it.

### Recommendation

**Option C if OTA Ready v2 is close; Option B only if it is not.**
*(2026-11-26: the OTA channel is live — OTA Ready 3.0.0 — so this resolves to
C: ship the fix in the next CE OTA.)*

C is the one that leaves something behind — a proven channel — and it costs users
nothing they have not already paid. It is also the only option that makes §2.2
moot instead of merely survivable, which means it is the only one that can be
committed to before open question 1 is answered. B closes the bug sooner but spends a manual
install on a package that is dead weight the moment the next image ships, and
asking the same users for a second manual install later is the outcome most worth
avoiding.

Either way, fold 1.1.10 into the next image via the ipk (§1.1) and seed an ipkg
status stanza for `com.webosarchive.usbsettings`, so Preware stops offering a
baked app as a fresh install.

Take Option A only if the §2.2 clash is first shown *not* to happen on hardware.

Because the bug is cosmetic, self-healing, and now documented with two one-touch
workarounds (§6), the schedule pressure here is low. That is what makes waiting
for C affordable — and it is also what makes this a good pilot payload rather than
an urgent one.

### 3.1 postinst — two stages, in this order

Written for Option B. Option A's CE branch does the same work, and Option C's
hotpatch apply step is Stage B without the ipk around it.

**Stage A — heal the running device, no rootfs write.**

```sh
restart usbctl-watchd 2>/dev/null || start usbctl-watchd 2>/dev/null || true
```

By install time `/media/internal` is long since mounted, so the restarted
daemon's startup `write_status` succeeds and `.usbctl-status` appears within a
second. **This alone clears the user-visible symptom permanently for that media
partition**, because the status file persists across reboots and across a
re-Doctor (the Doctor does not wipe `/media/internal`). Stage A must run first
and must not be gated on Stage B succeeding.

**Stage B — fix the root cause on disk.**

```sh
L=/tmp/.ce-rootfs-rw.lock                      # CE's shared rootfs-rw lock
n=0; while ! mkdir $L 2>/dev/null && [ $n -lt 60 ]; do sleep 1; n=$((n+1)); done
mount -o remount,rw / 2>/dev/null || true
# NEVER cp over the running daemon -- see the note below.
cp "$APP_DIR/usbctl-watchd.sh" /usr/bin/.usbctl-watchd.new
chmod 755 /usr/bin/.usbctl-watchd.new
mv -f /usr/bin/.usbctl-watchd.new /usr/bin/usbctl-watchd
mount -o remount,ro / 2>/dev/null || true
rmdir $L 2>/dev/null || true
restart usbctl-watchd
```

Requirements on Stage B:

- **Write via a temporary file and `mv`, never `cp` in place.** `usbctl-watchd`
  is a `/bin/sh` script and it is *running* at this moment. `sh` reads its script
  from an open fd at a byte offset, so `cp` — which truncates and rewrites the
  same inode — makes the live daemon execute garbage from wherever it had got to.
  `mv` within a filesystem is `rename(2)`: the running process keeps the old
  inode open and finishes cleanly while the new file takes the name. This is the
  same hazard as OTA-3.1.0's M13, and it applies to any in-place hotpatch of a
  shell script. (The ramdisk OTA path is inherently safe here — `mmipkg` unlinks
  and recreates rather than truncating — so this requirement is specific to the
  running-system tier.)
- **Take CE's lock.** `ce-firstboot-tweaks` and `ce-remove-preloads` both remount
  the root rw and serialise on `/tmp/.ce-rootfs-rw.lock`. A hotfix that remounts
  without it can flip the root back to `ro` underneath one of them.
- **Idempotent.** Re-installing must be a no-op, not a second mutation.
- **Must not downgrade.** A future image carries a baked daemon that already has
  the fix, possibly a newer one. Version-guard the copy: compare a version marker
  inside the installed `/usr/bin/usbctl-watchd` against the payload's and skip
  unless the payload is strictly newer. Do not compare by size or mtime — the
  baked copy's mtime is the image build date on every device.
- **Must survive Stage B failing.** If the remount is refused, log it, leave
  Stage A's repair in place, and `exit 0`. A package that failed here would look
  to the user like the fix did not install, when the symptom is in fact gone.

### 3.2 prerm

Restore `/usr/bin/usbctl-watchd` from the baked original if one was saved, or
leave the fixed daemon in place — decide which, and say so in the package
description. Do **not** delete `/media/internal/.usbctl-status`; removing the
hotfix must not re-break the device.

### 3.3 control metadata

Preware reads a one-line `Source` JSON blob out of the control file for its title
and category. Without it the package lists as untitled and Unsorted. Do not let
`palm-package`'s defaults through — see the existing `org.webosarchive.*`
packages for the exact shape.

---
## 4. Verification

On a device with a genuinely clean media partition (no `.usbctl-*` files):

0. **CE only, and before anything else:** after installing, confirm
   `com.webosarchive.usbsettings.service` is still on the bus and still answers
   `getStatus`. Options B and C should never put it at risk; Option A depends on
   it.
   A hotfix that silences the warning by removing the service would pass every
   step below.
1. `ls /media/internal/.usbctl-*` — only `.usbctl-devices` / `.usbctl-watch` may
   exist; `.usbctl-status` and `.usbctl-state` must be absent.
2. Open USB Settings — the "Helper not running" row must be visible.
3. Install the hotfix.
4. `.usbctl-status` and `.usbctl-state` exist, and `cat /usr/bin/usbctl-watchd`
   shows the latch after the write.
5. Re-open USB Settings — **confirm the warning row is gone by looking at the
   screen**, not from the status file.
6. Reboot. Then, *before* the ~2 min mount window closes, confirm the daemon has
   still written status by the time the app is usable. This is the case the old
   code got wrong and the only one that proves the fix rather than Stage A.
7. Delete both files, reboot, and confirm they are recreated. Stage A cannot help
   here — this isolates Stage B.

Step 6/7 are the real test. Steps 1-5 pass with Stage A alone.

---

## 5. Open questions

1. **Does a cryptofs install of `com.webosarchive.usbsettings` actually clash
   with the baked static registration?** This decides between Option A and
   Option B. Install the current 1.1.9 from a feed onto a CE device and watch
   whether `com.webosarchive.usbsettings.service` survives on the bus. bake.py
   asserts the clash; it has not been observed here. **Option C does not depend
   on the answer** — it writes the rootfs and creates no second registration — so
   this stops being the doc's blocking question if C is chosen.
2. **Which of Option A / B / C ships?** §3 recommends C if OTA Ready v2 is close,
   B if it is not. Decide before any package is cut — the payload differs. This
   one is not ours alone: C depends on the OTA project's v2 schedule, so it needs
   agreeing with them rather than deciding here.
3. **What happens after a full erase?** Cryptofs is wiped, so the hotfix package
   goes with it, and `/media/internal` is wiped, so the status file goes too. The
   device returns to the broken state and the user must reinstall the hotfix from
   Preware. Acceptable, but it needs to be in the release notes.
4. **Does the same latch pattern appear elsewhere in the daemon?** `state_save`
   is confirmed. Audit the rest of the script for other write-then-cache
   orderings before cutting 1.1.10 — the mirror-side check.
5. **Do not seed the *rootfs* ipkg database for
   `com.webosarchive.usbsettings`.** The shipped image registers the package in
   neither database. §1.1 recommends seeding the **cryptofs** status file so
   Preware stops offering a baked app as a fresh install — that is correct and
   should happen. Seeding `/usr/lib/ipkg/info/` in the rootfs is a different
   thing entirely and would make `mmipkg` take the remove-then-install path,
   turning any partial OTA payload into a deletion of the whole app. If a future
   image ever wants that registration, the payload must become a complete
   package at the same time. Worth an assertion in `bake.py` rather than a note
   here.

---

## 6. What users can do today, with no install

Open USB Settings and flip **High-power devices** on, then off. That changes the
`power` field, which breaks the poisoned cache and writes the status file; the
warning row clears immediately and stays cleared across reboots.

This works because `togglePower` has no guard on the warning state — it checks
only `this.updating` and `this.pendingPower`. Verified on hardware, and
independently reproduced on a second device.

**Plugging in the OTG Y-cable heals it too — with nothing attached to the cable.**
Verified on a device wiped to bare partitions with the toolkit and re-flashed:
registering the host controller flips `otg` to `host`, which is change enough.
This is the likelier real-world heal, since anyone who opens USB Settings
generally owns the cable.

`power` is the only status field reachable from inside the app — the On-the-Go
toggle is `disabled: true`, a read-only indicator — so the toggle is the fix for
someone who has no cable to hand, or whose port never armed because the device
has sat on a PC connection since boot (`arm_otg_once` skips arming while
`host_connected = 1`). See the USB Settings "Helper not running" entry in `KNOWN-ISSUES.md`.
