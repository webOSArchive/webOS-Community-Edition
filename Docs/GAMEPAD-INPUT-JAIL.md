> **DESIGN DOC — proposed for vNext, nothing here is built.** The part that
> *is* shipped (the `jail_pdk.conf` bind) is described in §1 and has been in
> the image since 600024; §3–§5 are the proposal.

# Exposing `/dev/input` to jailed apps, OS-wide

**The question.** Today a PDK game that wants to read a joystick ships a
postinst that edits the jail config. Can the OS just expose `/dev/input` to
every PDK app, so no game needs a postinst at all?

**Short answer.** Yes, and CE already does half of it. The `pdk` jail type has
had the bind since 600024. What is missing is (a) the other jail types and
(b) a device-agnostic permission rule on the event nodes — without (b) the
bind alone does not let an app open anything.

---

## 1. What CE already ships

`build/full-ce/bake.py:3848` inserts two lines into stock
`/etc/jail_pdk.conf`, anchored on its `mkdir /dev`:

```
mkdir /dev/input
mount ro /dev/input
```

Result is visible in the baked overlay at
`build/overlays/full-ce/rootfs/etc/jail_pdk.conf:41-43`. Stock
`jail_pdk.conf` (from `nova-cust-image-topaz.rootfs.tar.gz`) has no
`/dev/input` line at all — this is a CE addition, made for the BT gamepad shim
(`SCOPE-3.1-CE.md` §2a).

So on a CE image, an app with `"type": "pdk"` in its appinfo already gets
`/dev/input` mounted read-only inside its jail, with no postinst.

**It applies to already-installed apps.** `jailer` composes its config path at
launch as `/etc/jail_<type>.conf` (falling back to `jail_app.conf`) and is
invoked per launch — `jailer [-t type] -i appId program [args]` — with an
idempotent mount path (`Skipping mount %s on %s: already mounted`). Changing
the config in the image does not require reinstalling apps whose jails were
created earlier.

## 2. Why games still ship jail postinsts

Two reasons, and they are separable.

### 2a. Only the `pdk` jail type was patched

The 3.0.5 rootfs carries six jail configs:

| Config | App type | Has `/dev/input`? |
|---|---|---|
| `jail_pdk.conf` | `pdk` | **yes, in CE** (stock: no) |
| `jail_hybrid.conf` | `hybrid` (Mojo shell + PDL plugin) | no |
| `jail_game.conf` | `game` | no |
| `jail_default.conf` | fallback | no |
| `jail_native-palm.conf` | Palm-signed native | no |
| `jail_device.conf` | *not a type* — `include`d by the others for per-device `set` flags | n/a |

Hybrid is a common shape for ported games, so a game shipping a jail postinst
on CE today is most likely hybrid, or is simply carrying a postinst written for
stock and never revisited.

Each missing config takes the same one-line insert at the same `mkdir /dev`
anchor, replayed the same way `bake.py` already does it for `jail_pdk.conf`.

### 2b. The bind is necessary but not sufficient — node permissions are the gate

Mounting the directory does not grant `open()` on what is in it. Stock udev
gives event nodes 0640 root:root:

```
# 50-udev-default.rules:31
KERNEL=="mouse*|mice|event*",  NAME="input/%k", MODE="0640"
# permissions.rules — only these get widened
KERNEL=="js[0-9]*",            MODE="0664"
KERNEL=="event[0-9]*", SYSFS{name}=="*dvb*|*DVB*|* IR *"  MODE="0664", GROUP="video"
```

A jailed app runs as a per-app uid in groups `video,pulse-access,luna` (the
`groups` line in each jail config), so a plain `event*` node stays unreadable
to it.

CE works around this for exactly one device, by name:

```
# etc/udev/rules.d/99-bt-gamepad.rules
SUBSYSTEM=="input", KERNEL=="event[0-9]*", ATTRS{name}=="Wireless Controller", MODE="0666"
```

`Wireless Controller` is the DS4. Any other pad — and any pad whose kernel
name string differs — gets a node the app cannot open, which is exactly the
gap a game's postinst is papering over.

## 3. Proposal

1. **Add the bind to `jail_hybrid.conf` and `jail_game.conf`** (and decide
   deliberately about `jail_default.conf`; `jail_native-palm.conf` is
   Palm-signed code and is not the audience here). Same two lines, same
   anchor, same `sure_replace` replay in `bake.py`.

2. **Replace the name-matched udev rule with a capability-matched one**, so
   any joystick works without an image change:

   ```
   SUBSYSTEM=="input", KERNEL=="event[0-9]*", ENV{ID_INPUT_JOYSTICK}=="1", \
       GROUP="video", MODE="0660"
   ```

   `video` is already in every jail's `groups` line, so this needs no jail
   change to take effect. Prefer this over `MODE="0666"`: it grants the app
   what it needs without making the node readable to every process on the
   device.

   **Verify before adopting:** 3.0.5 ships an old udev, and
   `ID_INPUT_JOYSTICK` is set by `input_id` in `80-drivers.rules` /
   `udev-default` on newer versions. If this udev does not populate it, the
   fallback is `ATTRS{bInterfaceProtocol}` / `ATTRS{name}` matching or a small
   helper — that check is the first task of this work item, not an assumption.

3. **Then drop the jail postinst from CE-bundled games**, and note in the
   packaging guidance that on CE 3.2+ the postinst is unnecessary.

## 4. Security trade-off (unchanged in kind, worth restating)

`SCOPE-3.1-CE.md` §150 and item 9 already record the decision: binding all of
`/dev/input` exposes the touchscreen and any paired BT keyboard to every PDK
app, shipped as-is, with per-app scoping listed as future hardening.

What holds the line today is the node mode, not the bind. That is the reason
§3.2 scopes the widened permission to joystick-capable nodes and to `video`
rather than world-readable: broadening the *bind* is a decision already taken,
broadening the *permissions* on touchscreen and keyboard event nodes is not,
and the two should not be conflated because they are edited in adjacent files.

Real per-app scoping (only the app that asked for input, only the nodes it
asked for) remains the proper fix and is out of scope here.

## 5. Effort and risk

Small: two config-line inserts and one udev rule, all in the existing
`bake.py` replay style. `/etc/jail_*.conf` are stock files, so each edited one
needs its owning package's `ipkg` md5sums regenerated the way `bake.py`
already handles `jail_pdk.conf` (`SCOPE-3.1-CE.md` §160).

Main risk is §3.2's `ID_INPUT_JOYSTICK` availability on this udev vintage.
Validation needs a pad that is *not* a DS4, on hardware — the existing DS4 path
will pass either way and proves nothing about the change.
