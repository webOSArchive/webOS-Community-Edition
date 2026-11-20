#!/usr/bin/env python3
"""Compare a TouchPad's root filesystem with an image, reading only.

    device-check.py IMAGE [--device ID] [--out DIR]

IMAGE is a rootfs tarball or a Doctor JAR. The device is read over novacom: a
node script walks / and /boot (nothing else is mounted on the same device) and
prints type, mode, owner, link target and md5 of every path. Nothing is written
to the device, not even to /tmp.

One tool, three uses (Docs/OTA-PLAN.md):
  pre-flight   a 3.1.0 device against the 600070 image: is it what the payload
               was diffed against?
  convergence  an OTA'd device against the target image (section 1.3), so no
               second, flashed device is needed
  baseline     a flashed, lived-in device against its own image: the differences
               that are normal, and so must not fail the two checks above
"""

import argparse
import collections
import importlib.util
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("make_payload", os.path.join(HERE, "make-payload.py"))
mp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mp)

# Mounted from elsewhere on a running device; the image only carries their
# mount points or first-boot seed. Not the rootfs payload's business.
OTHER_FILESYSTEMS = ("dev", "var", "media", "proc", "sys", "tmp")

# node 0.4 on the device. Printed as one JSON object per line.
WALKER = r'''
var fs = require("fs"), crypto = require("crypto");
var buf = new Buffer(1 << 20);
function md5(p) {
  var h = crypto.createHash("md5"), fd = fs.openSync(p, "r"), n;
  while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.slice(0, n));
  fs.closeSync(fd);
  return h.digest("hex");
}
function walk(p, dev) {
  var st;
  try { st = fs.lstatSync(p); } catch (e) { console.log(JSON.stringify({p: p, err: "" + e})); return; }
  if (st.dev !== dev) return;                     // another filesystem is mounted here
  var r = {p: p, m: st.mode & 4095, u: st.uid, g: st.gid};
  try {
    if (st.isSymbolicLink()) { r.t = "symlink"; r.l = fs.readlinkSync(p); }
    else if (st.isDirectory()) { r.t = "dir"; }
    else if (st.isFile()) { r.t = "file"; r.s = st.size; r.n = st.nlink; r.h = md5(p); }
    else { r.t = "other"; }
  } catch (e) { r.err = "" + e; }
  console.log(JSON.stringify(r));
  if (r.t === "dir") {
    var names = fs.readdirSync(p).sort();
    for (var i = 0; i < names.length; i++) walk((p === "/" ? "" : p) + "/" + names[i], dev);
  }
}
walk("/", fs.lstatSync("/").dev);
walk("/boot", fs.lstatSync("/boot").dev);
console.log(JSON.stringify({done: true}));
'''


def read_device(device):
    script = "exec node -e \"$(cat <<'CE_WALKER'\n%s\nCE_WALKER\n)\"\n" % WALKER
    cmd = ["novacom"] + (["-d", device] if device else []) + ["run", "file://bin/sh"]
    out = subprocess.run(cmd, input=script.encode(), stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, timeout=1800)
    recs, done = {}, False
    for line in out.stdout.decode("utf-8", "replace").splitlines():
        if not line.startswith("{"):
            continue
        r = json.loads(line)
        if r.get("done"):
            done = True
        elif "p" in r:
            recs[r["p"].strip("/") or "."] = r
    if not done:
        sys.exit("the device walk did not finish: %s" % out.stderr.decode()[-400:])
    return recs


def expected(image, p):
    """What the image says should be at p, in the walker's terms."""
    r = image[p]
    t = r["type"]
    if t == "hardlink":                 # a link's content is its target's
        r = image[mp.norm(r["target"])]
        t = "file"
    e = {"t": t if t in ("file", "dir", "symlink") else "other",
         "m": r["mode"], "u": r["uid"], "g": r["gid"]}
    if t == "file":
        e["h"] = r["md5"]
    elif t == "symlink":
        e["l"] = image[p]["target"]
    return e


# What the Doctor's customization layer and a running system add to every device.
NORMAL_EXTRA = ("usr/lib/luna/customization/", "usr/palm/applications/com.palm.app.crotest/",
                "usr/lib/ipkg/info/", "boot/", "etc/fs.d/", "Settings/", "usr/share/alsa/")

# Reclaimed after the first boot, or hidden under a bind mount, on every device.
NORMAL_MISSING = ("usr/lib/luna/customization/", "usr/lib/purple-2/", "usr/lib/synergy-runtime/")


def preflight(rows, dev, image, payload):
    """Is this device one the payload may be applied to?

    The payload replaces the paths it names and leaves every other path alone, so
    a device does not have to match the old image, and no drift has to be known in
    advance. What has to hold is that the device IS the old image underneath:

      refuse   the harness's record of the image's files is not the old image's
               (another build), or a path is unreadable
      replaced the device changed a file the payload replaces or removes anyway
               (a feed app's edits to a stock app, for one): the update wins
      kept     the device changed or added something the payload does not name
               (a game's jail config, an owner's udev rule, rootfs_open): it
               stays as the owner left it, and is listed so it can be told apart
               from damage

    Owner and mode differences are reported and never refuse.
    """
    named = dict((d["path"], d["change"]) for d in payload["delta"])
    refuse, replaced, kept, meta = [], [], [], []
    rec = image.get(mp.PREFLIGHT_FILE)
    got = dev.get(mp.PREFLIGHT_FILE, {})
    if not rec or got.get("h") != rec["md5"]:
        refuse.append("/%s is not the old image's: this device is another build" % mp.PREFLIGHT_FILE)
    for kind, p, note in rows:
        if p == "usr/lib/ipkg/status":
            continue
        if kind == "unreadable":
            refuse.append("/%s cannot be read (%s)" % (p, note))
        elif kind in ("owner", "mode"):
            meta.append(p)
        elif kind in ("extra", "extra-dir") and p.startswith(NORMAL_EXTRA):
            continue
        elif kind == "extra-dir" or (kind == "missing" and image[p]["type"] != "file"):
            continue
        elif kind == "missing" and p.startswith(NORMAL_MISSING):
            continue
        elif p in named:
            replaced.append((kind, p, named[p]))
        else:
            kept.append((kind, p))
    print("pre-flight for the payload %s -> %s:" % (payload["meta"]["old"], payload["meta"]["new"]))
    print("  the update replaces %d path(s) this device had changed" % len(replaced))
    for kind, p, ch in replaced[:40]:
        print("    %-8s /%s  (payload: %s)" % (kind, p, ch))
    print("  %d change(s) of the owner's stay as they are" % len(kept))
    for kind, p in kept[:40]:
        print("    %-8s /%s" % (kind, p))
    if meta:
        print("  %d path(s) differ only in owner or mode, e.g. /%s" % (len(meta), meta[0]))
    for r in refuse:
        print("  REFUSE: " + r)
    print("  verdict: %s" % ("DO NOT APPLY" if refuse else "may be applied"))
    return 1 if refuse else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("image")
    ap.add_argument("--device", help="novacom device id (default: the only one)")
    ap.add_argument("--out", help="directory for device.json and check.txt")
    ap.add_argument("--listing", help="a saved device.json to use instead of reading a device")
    ap.add_argument("--delta", help="a payload's delta.json: judge the device as a pre-flight "
                    "for that payload (exit 1 when it must not be applied)")
    args = ap.parse_args()

    if args.listing:
        dev = json.load(open(args.listing))
    else:
        print("reading the device (a few minutes)...", file=sys.stderr)
        dev = read_device(args.device)
    print("scanning the image...", file=sys.stderr)
    image = mp.scan(args.image)

    rows = []
    for p in sorted(set(dev) | set(image)):
        if p == "." or p.split("/")[0] in OTHER_FILESYSTEMS:
            continue
        d = dev.get(p)
        if d is None:
            rows.append(("missing", p, image[p]["type"]))
            continue
        if p not in image:
            rows.append(("extra-dir" if d.get("t") == "dir" else "extra", p, d.get("t", "?")))
            continue
        e = expected(image, p)
        if "err" in d:
            rows.append(("unreadable", p, d["err"]))
        elif d["t"] != e["t"]:
            rows.append(("type", p, "%s, image has %s" % (d["t"], e["t"])))
        elif e["t"] == "file" and d["h"] != e["h"]:
            rows.append(("content", p, "%s, image has %s" % (d["h"], e["h"])))
        elif e["t"] == "symlink" and d["l"] != e["l"]:
            rows.append(("target", p, "%s, image has %s" % (d["l"], e["l"])))
        elif d["m"] != e["m"]:
            rows.append(("mode", p, "%04o, image has %04o" % (d["m"], e["m"])))
        elif (d["u"], d["g"]) != (e["u"], e["g"]):
            rows.append(("owner", p, "%d:%d, image has %d:%d" % (d["u"], d["g"], e["u"], e["g"])))

    counts = collections.Counter(r[0] for r in rows)
    print("device: %d paths   image: %d members   differences: %d"
          % (len(dev), len(image), len(rows)))
    for k, v in sorted(counts.items()):
        print("  %-10s %6d" % (k, v))
    verdict = 0
    if args.delta:
        verdict = preflight(rows, dev, image, json.load(open(args.delta)))
    if args.out:
        os.makedirs(args.out, exist_ok=True)
        with open(os.path.join(args.out, "device.json"), "w") as f:
            json.dump(dev, f, sort_keys=True)
        with open(os.path.join(args.out, "check.txt"), "w") as f:
            for kind, p, note in rows:
                f.write("%-10s /%s  (%s)\n" % (kind, p, note))
        print("wrote %s/check.txt and device.json" % args.out)
    sys.exit(verdict)


if __name__ == "__main__":
    main()
