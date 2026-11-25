#!/usr/bin/env python3
"""Diff two complete rootfs images: the first step of an OTA payload.

    make-payload.py diff  OLD NEW [--out DIR]
    make-payload.py build OLD NEW --out DIR
    make-payload.py finish-list IMAGE > build/full-ce/ce-ota/finish/from-MARK.list

OLD and NEW are each a rootfs tarball (rootfs.ce.tar.gz) or a Doctor JAR, from
which the rootfs is read without unpacking the JAR to disk.

Prints a summary and, with --out, writes:

    delta.json   every difference, machine-readable (the payload's source of truth)
    delta.txt    the same as one line per path, for reading and for review

Staged ipks (the cryptofs apps) are also compared from the inside, because an
installed device never reinstalls them: those differences are ce-ota-finish's
work list, not the rootfs payload's.

`build` also writes the payload ipk (one data ipk under a package id that exists
in no image, with a generated preinst and postinst), manifest-inputs.json for
the signer, and refuses to write anything unless applying the payload to OLD's
member table gives NEW's exactly. It does not sign, and nothing it builds has
run on a device. See Docs/OTA-PLAN.md section 1.1.
"""

import argparse
import hashlib
import io
import json
import os
import re
import sys
import tarfile
import zipfile

ROOTFS_IN_WEBOS_TAR = "nova-cust-image-topaz.rootfs.tar.gz"
WEBOS_TAR_IN_JAR = "resources/webOS.tar"

# Differences that are expected on every pair of builds and carry no payload
# decision of their own. They are still delivered; this only groups the report.
VERSION_PATHS = (
    "etc/palm-build-info",
    "etc/prefs/properties/buildMark",
    "etc/prefs/properties/buildDate",
)
IPKG_DB_PREFIX = "usr/lib/ipkg/"
CONTROL_MTIME = 1262304000      # 2010-01-01, fixed so a payload builds the same twice
IPKG_INFO = "usr/lib/ipkg/info"
BUILD_INFO = "etc/palm-build-info"
# The harness's record of every CE file. A device whose copy differs from the
# old image's is not the image this payload was diffed against.
PREFLIGHT_FILE = "usr/lib/ipkg/info/org.webosarchive.ce-files.md5sums"

# Apps the image carries as staged ipks. First boot after a flash installs them
# into /media/cryptofs/apps; an installed device never reinstalls them, so a
# changed staged ipk changes nothing there. Their inner differences are what
# ce-ota-finish has to lay over the installed copy (Docs/OTA-PLAN.md 2.2).
STAGED_IPK = re.compile(r"^usr/palm/ipkgs/[^/]+/[^/]+\.ipk$")
CRYPTOFS_APPS = "/media/cryptofs/apps"

# The staged customization media (issue #14). 3.1.0 had a job that deleted it
# after first boot, so every 3.1.0 device lacks it, yet a Full Erase copies it
# again from here: the payload must put it back. Part of it is CE's (in the
# rootfs image) and most is hp.tar's sweatshop ipk, which the Doctor installs
# over the rootfs at flash time and so is in neither rootfs tar. The new side is
# modelled with both parts. The old side has none of it if its image carried the
# reclaim job (RECLAIM_JOB), and both parts from its own JAR if not (load()).
# The diff delivers the difference and the convergence proof covers it.
EXTRAS = ":customization-media"    # new_blobs key; not a path
RECLAIM_JOB = "etc/event.d/ce-reclaim-customization-media"   # 600028-600114 only
CUSTOMIZATION_MEDIA = "usr/lib/luna/customization/copy_binaries/media/internal"
# The customization tar is the JAR's own: recoverytool.config names it
# (CustomizationBuild=hp.tar on the Wi-Fi TouchPad, att.tar on the AT&T one),
# and its sweatshop ipk stages the media under the same path on both.
RECOVERYTOOL_CONFIG = "resources/recoverytool.config"
SWEATSHOP_IPK = re.compile(r"^sweatshop-[a-z0-9]+-topaz_.*\.ipk$")


def customization_tar(path):
    """The JAR member of its customization tar, e.g. resources/att.tar."""
    cfg = zipfile.ZipFile(path).read(RECOVERYTOOL_CONFIG).decode("latin-1")
    m = re.search(r"^CustomizationBuild=([A-Za-z0-9_.-]+\.tar)\s*$", cfg, re.M)
    if not m:
        sys.exit("%s: %s names no CustomizationBuild" % (path, RECOVERYTOOL_CONFIG))
    return "resources/" + m.group(1)


def is_customization_media(p):
    return p == CUSTOMIZATION_MEDIA or p.startswith(CUSTOMIZATION_MEDIA + "/")


def customization_media(path):
    """{path: (TarInfo, body)} for the sweatshop ipk's staged media in a Doctor
    JAR's customization tar (hp.tar, att.tar). A bare rootfs tarball has none: refuse, because a payload
    without this media leaves an updated device unable to recover from a Full
    Erase."""
    if not zipfile.is_zipfile(path):
        sys.exit("%s: not a Doctor JAR, so there is no customization tar to take the staged "
                 "customization media from" % path)
    member = customization_tar(path)
    custo = tarfile.open(fileobj=zipfile.ZipFile(path).open(member), mode="r|")
    blob = None
    for ti in custo:
        if SWEATSHOP_IPK.match(os.path.basename(norm(ti.name))):
            if blob is not None:
                sys.exit("%s: more than one sweatshop ipk in %s" % (path, member))
            blob = custo.extractfile(ti).read()
    if blob is None:
        sys.exit("%s: no sweatshop ipk in %s" % (path, member))
    out = {}
    with tarfile.open(fileobj=io.BytesIO(ar_members(blob)["data.tar.gz"]), mode="r:gz") as tf:
        for ti in tf:
            name = norm(ti.name)
            if not is_customization_media(name) or not (ti.isreg() or ti.isdir()):
                continue
            body = tf.extractfile(ti).read() if ti.isreg() else None
            ti.name, ti.pax_headers = "./" + name, {}
            ti.uid = ti.gid = 0                 # ipkg installs it as root
            ti.uname = ti.gname = "root"
            out[name] = (ti, body)
    if not any(b is not None for _, b in out.values()):
        sys.exit("%s: the sweatshop ipk stages no media" % path)
    return out


def record_of(ti, body):
    rec = {"type": TYPE_NAMES[ti.type], "mode": ti.mode & 0o7777, "uid": ti.uid, "gid": ti.gid}
    if ti.isreg():
        rec["size"] = len(body)
        rec["sha256"] = hashlib.sha256(body).hexdigest()
        rec["md5"] = hashlib.md5(body).hexdigest()
    return rec


def file_bytes(recs):
    """Bytes of regular-file content in an image record set (hard links counted once)."""
    return sum(r.get("size", 0) for r in recs.values() if r["type"] == "file")


TYPE_NAMES = {
    tarfile.REGTYPE: "file", tarfile.AREGTYPE: "file", tarfile.DIRTYPE: "dir",
    tarfile.SYMTYPE: "symlink", tarfile.LNKTYPE: "hardlink",
    tarfile.CHRTYPE: "char", tarfile.BLKTYPE: "block", tarfile.FIFOTYPE: "fifo",
}


def norm(name):
    while name.startswith("./"):
        name = name[2:]
    return name.strip("/") or "."


def open_rootfs(path):
    """Return a streaming TarFile over the rootfs inside `path`."""
    if zipfile.is_zipfile(path):
        jar = zipfile.ZipFile(path)
        webos = tarfile.open(fileobj=jar.open(WEBOS_TAR_IN_JAR), mode="r|")
        for ti in webos:
            if norm(ti.name) == ROOTFS_IN_WEBOS_TAR:
                return tarfile.open(fileobj=webos.extractfile(ti), mode="r|gz")
        sys.exit("%s: no %s in %s" % (path, ROOTFS_IN_WEBOS_TAR, WEBOS_TAR_IN_JAR))
    return tarfile.open(path, mode="r|gz")


def ar_members(blob):
    """{name: bytes} of an ar archive (the ipk container)."""
    if blob[:8] != b"!<arch>\n":
        raise ValueError("not an ar archive")
    out, pos = {}, 8
    while pos + 60 <= len(blob):
        hdr = blob[pos:pos + 60]
        size = int(hdr[48:58].decode().strip())
        out[hdr[:16].decode().strip().rstrip("/")] = blob[pos + 60:pos + 60 + size]
        pos += 60 + size + (size & 1)
    return out


def ipk_files(blob):
    """{path: record} for the data files inside an ipk."""
    data = ar_members(blob).get("data.tar.gz")
    if data is None:
        raise ValueError("no data.tar.gz")
    out = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tf:
        for ti in tf:
            rec = {"type": TYPE_NAMES.get(ti.type, "type-%r" % ti.type),
                   "mode": ti.mode & 0o7777}
            if ti.isreg():
                body = tf.extractfile(ti).read()
                rec["size"] = ti.size
                rec["md5"] = hashlib.md5(body).hexdigest()
                rec["sha256"] = hashlib.sha256(body).hexdigest()
            elif ti.issym() or ti.islnk():
                rec["target"] = ti.linkname
            out[norm(ti.name)] = rec
    return out


def staged_ipk_deltas(delta, old_blobs, new_blobs):
    """For every staged ipk whose bytes changed, the differences inside it."""
    out = []
    for d in delta:
        p = d["path"]
        if d["change"] != "content" or not STAGED_IPK.match(p):
            continue
        inner = [x for x in compare(ipk_files(old_blobs[p]), ipk_files(new_blobs[p]))
                 if not (x["change"] == "meta" and x["new"]["type"] == "dir")]
        out.append({"ipk": p, "installed_under": CRYPTOFS_APPS, "delta": inner})
    return out


def scan(path, blobs=None, dups=None):
    """{path: record} for every member of the rootfs. Staged ipks' bytes are
    kept in `blobs` so they can be compared from the inside."""
    out = {}
    tf = open_rootfs(path)
    for ti in tf:
        rec = {
            "type": TYPE_NAMES.get(ti.type, "type-%r" % ti.type),
            "mode": ti.mode & 0o7777,
            "uid": ti.uid,
            "gid": ti.gid,
        }
        if ti.isreg():
            h = hashlib.sha256()
            m = hashlib.md5()           # what a device can compute (device-check.py)
            f = tf.extractfile(ti)
            keep = [] if blobs is not None and (
                STAGED_IPK.match(norm(ti.name)) or norm(ti.name) == BUILD_INFO) else None
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
                m.update(chunk)
                if keep is not None:
                    keep.append(chunk)
            if keep is not None:
                blobs[norm(ti.name)] = b"".join(keep)
            rec["size"] = ti.size
            rec["sha256"] = h.hexdigest()
            rec["md5"] = m.hexdigest()
        elif ti.issym() or ti.islnk():
            rec["target"] = ti.linkname
        elif ti.ischr() or ti.isblk():
            rec["dev"] = [ti.devmajor, ti.devminor]
        name = norm(ti.name)
        if name in out and dups is not None:
            dups.append(name)
        out[name] = rec                 # a later member replaces an earlier one
    return out


def compare(old, new):
    """List of {path, change, old?, new?}. `change` is one of:
    added, removed, content, meta (mode/owner only), retarget, type."""
    delta = []
    for p in sorted(set(old) | set(new)):
        o, n = old.get(p), new.get(p)
        if o is None:
            delta.append({"path": p, "change": "added", "new": n})
        elif n is None:
            delta.append({"path": p, "change": "removed", "old": o})
        elif o == n:
            continue
        elif o["type"] != n["type"]:
            delta.append({"path": p, "change": "type", "old": o, "new": n})
        elif o.get("sha256") != n.get("sha256") or o.get("dev") != n.get("dev"):
            delta.append({"path": p, "change": "content", "old": o, "new": n})
        elif o.get("target") != n.get("target"):
            delta.append({"path": p, "change": "retarget", "old": o, "new": n})
        else:
            delta.append({"path": p, "change": "meta", "old": o, "new": n})
    return delta


def group_of(path):
    if path in VERSION_PATHS:
        return "version"
    if path.startswith(IPKG_DB_PREFIX):
        return "ipkg-db"
    return "rootfs"


def describe(d):
    o, n = d.get("old"), d.get("new")
    c = d["change"]
    if c == "added":
        extra = n.get("target") or ("%d bytes" % n["size"] if "size" in n else "")
        return "%s %s" % (n["type"], extra)
    if c == "removed":
        return o["type"]
    if c == "content":
        return "%d -> %d bytes" % (o.get("size", 0), n.get("size", 0))
    if c == "retarget":
        return "%s -> %s" % (o["target"], n["target"])
    if c == "type":
        return "%s -> %s" % (o["type"], n["type"])
    bits = []
    if o["mode"] != n["mode"]:
        bits.append("mode %04o -> %04o" % (o["mode"], n["mode"]))
    if (o.get("uid"), o.get("gid")) != (n.get("uid"), n.get("gid")):
        bits.append("owner %d:%d -> %d:%d" % (o["uid"], o["gid"], n["uid"], n["gid"]))
    return ", ".join(bits)


def load(args):
    # A payload never crosses models: the Doctor installed the old device's
    # customization tar, and the new image's media must be that same carrier's.
    if zipfile.is_zipfile(args.old) and zipfile.is_zipfile(args.new):
        oc, nc = customization_tar(args.old), customization_tar(args.new)
        if oc != nc:
            sys.exit("old is a %s image and new a %s one: a payload never crosses models"
                     % (os.path.basename(oc), os.path.basename(nc)))
    print("scanning old: %s" % args.old, file=sys.stderr)
    old_blobs, new_blobs = {}, {}
    old = scan(args.old, old_blobs)
    print("scanning new: %s" % args.new, file=sys.stderr)
    dups = []
    new = scan(args.new, new_blobs, dups)
    if dups:
        print("note: the new rootfs tar names %d paths twice (the last member wins), "
              "e.g. /%s" % (len(dups), dups[0]))
    # The new image keeps CE's part of the staged media, and the Doctor adds
    # hp.tar's (CUSTOMIZATION_MEDIA). The old device depends on its image:
    # 600028 to 600114 (3.1.0 among them) had a reclaim job that deleted the
    # media, so the payload delivers all of it. From 600115 the media stays,
    # so the old device has it too, and only what changed is delivered:
    # otherwise a 600119 -> 600120 payload re-sent 28 MB the device already had.
    if RECLAIM_JOB in old:
        for p in [p for p in old if is_customization_media(p)]:
            del old[p]
        print("old image deleted its staged media (%s): delivering all of it" % RECLAIM_JOB,
              file=sys.stderr)
    else:
        for p, (ti, body) in customization_media(args.old).items():
            if p in old and old[p]["type"] == "file":
                sys.exit("/%s is in both the old rootfs and its customization tar" % p)
            if p not in old:
                old[p] = record_of(ti, body)
        print("old image keeps its staged media: delivering only what changed", file=sys.stderr)
    extras = customization_media(args.new)
    for p, (ti, body) in extras.items():
        if p in new and new[p]["type"] == "file":
            sys.exit("/%s is in both the rootfs and the customization tar" % p)
        if p not in new:
            new[p] = record_of(ti, body)
    new_blobs[EXTRAS] = extras
    delta = compare(old, new)
    staged = staged_ipk_deltas(delta, old_blobs, new_blobs)
    return old, new, delta, staged, old_blobs, new_blobs


def cmd_diff(args):
    old, new, delta, staged, _, _ = load(args)
    report(args, old, new, delta, staged)


def report(args, old, new, delta, staged):
    counts = {}
    payload_bytes = 0
    for d in delta:
        key = (group_of(d["path"]), d["change"])
        counts[key] = counts.get(key, 0) + 1
        if d["change"] in ("added", "content", "type") and "size" in d.get("new", {}):
            payload_bytes += d["new"]["size"]

    print("old: %d members   new: %d members" % (len(old), len(new)))
    print("differences: %d   file bytes to deliver: %d (%.1f MB)"
          % (len(delta), payload_bytes, payload_bytes / 1048576.0))
    for (grp, change), cnt in sorted(counts.items()):
        print("  %-8s %-9s %6d" % (grp, change, cnt))

    print("staged ipks changed (cryptofs apps; not delivered by the rootfs diff):")
    for st in staged:
        c = {}
        for x in st["delta"]:
            c[x["change"]] = c.get(x["change"], 0) + 1
        print("  %-28s %s" % (st["ipk"].split("/")[3],
              ", ".join("%d %s" % (v, k) for k, v in sorted(c.items())) or "no file differences"))

    if args.out:
        os.makedirs(args.out, exist_ok=True)
        meta = {
            "old": os.path.basename(args.old),
            "new": os.path.basename(args.new),
            "old_members": len(old),
            "new_members": len(new),
            "payload_file_bytes": payload_bytes,
        }
        with open(os.path.join(args.out, "delta.json"), "w") as f:
            json.dump({"meta": meta, "delta": delta, "staged_ipks": staged}, f, indent=1, sort_keys=True)
            f.write("\n")
        with io.open(os.path.join(args.out, "delta.txt"), "w", encoding="utf-8") as f:
            for d in delta:
                f.write(u"%-8s %-8s /%s  (%s)\n"
                        % (d["change"], group_of(d["path"]), d["path"], describe(d)))
            for st in staged:
                f.write(u"\n# inside /%s (installed under %s)\n" % (st["ipk"], CRYPTOFS_APPS))
                for d in st["delta"]:
                    f.write(u"%-8s %-8s /%s  (%s)\n"
                            % (d["change"], "cryptofs", d["path"], describe(d)))
        print("wrote %s/delta.json and delta.txt" % args.out)


def build_info(blob):
    return dict(l.split("=", 1) for l in blob.decode().splitlines() if "=" in l)


def plan_ops(delta, old, new):
    """Split the delta into what the three install stages do.

    mmipkg (read in the 3.1.0 rootfs) runs, chrooted into the device's rootfs:
    preinst, then `tar -x` of data.tar.gz, then postinst. So:
      preinst   unlink every path whose type changes (a 3.1.0 zoneinfo hard
                link must not be written through into its sibling)
      data      every added or changed member, with the new image's metadata
      postinst  removals, mode/owner-only changes, and the package's own
                records, which a flashed image does not have
    """
    pre, data, post_rm, post_rmdir, post_meta = [], [], [], [], []
    for d in delta:
        p, c = d["path"], d["change"]
        if c == "removed":
            (post_rmdir if d["old"]["type"] == "dir" else post_rm).append(p)
        elif c == "meta":
            post_meta.append((p, d["new"]))
        else:
            if c in ("type", "retarget"):
                if "dir" in (d["old"]["type"], d["new"]["type"]):
                    sys.exit("unsupported: /%s changes %s -> %s"
                             % (p, d["old"]["type"], d["new"]["type"]))
                pre.append(p)
            if d["new"]["type"] not in ("file", "dir", "symlink", "hardlink"):
                sys.exit("unsupported member type for /%s: %s" % (p, d["new"]["type"]))
            data.append(p)
    # Directories neither tar names (tar made them for the files under them)
    # that hold nothing in the new image: found by unpacking a payload with a
    # real tar, which left com.palm.app.contacts/tests behind, empty.
    def ancestors(paths):
        out = set()
        for q in paths:
            while "/" in q:
                q = q.rsplit("/", 1)[0]
                out.add(q)
        return out
    gone = ancestors(old) - ancestors(new) - set(new) - set(post_rmdir)
    post_rmdir += sorted(gone)
    post_rmdir.sort(key=lambda x: -x.count("/"))        # deepest first
    return {"preinst_unlink": pre, "data": data, "postinst_rm": post_rm,
            "postinst_rmdir": post_rmdir, "postinst_meta": post_meta}


def sh_quote(p):
    return "'" + p.replace("'", "'\\''") + "'"


def render_preinst(ops):
    lines = ["#!/bin/sh", "# GENERATED by build/ota/make-payload.py -- do not edit.",
             "# Must exit 0 on every path: mmipkg aborts the whole update otherwise."]
    lines += ["rm -f %s" % sh_quote("/" + p) for p in ops["preinst_unlink"]]
    return "\n".join(lines + ["exit 0", ""])


def render_postinst(ops, pkg):
    lines = ["#!/bin/sh", "# GENERATED by build/ota/make-payload.py -- do not edit.",
             "# Runs chrooted into the device's rootfs, in the update ramdisk: no Luna,",
             "# no bus, no cryptofs. Must exit 0 on every path: mmipkg aborts the whole",
             "# update otherwise."]
    lines += ["rm -f %s" % sh_quote("/" + p) for p in ops["postinst_rm"]]
    lines += ["rmdir %s 2>/dev/null" % sh_quote("/" + p) for p in ops["postinst_rmdir"]]
    for p, n in ops["postinst_meta"]:
        lines.append("chown %d:%d %s; chmod %04o %s"
                     % (n["uid"], n["gid"], sh_quote("/" + p), n["mode"], sh_quote("/" + p)))
    lines += ["# A flashed image has no record of this package: drop the ones mmipkg",
              "# just wrote, so its status file is regenerated without it."]
    lines += ["rm -f /%s/%s.%s" % (IPKG_INFO, pkg, ext)
              for ext in ("control", "list", "preinst", "postinst")]
    return "\n".join(lines + ["exit 0", ""])


def tar_gz(members):
    """members: [(TarInfo, bytes or None)] -> deterministic .tar.gz bytes."""
    import gzip
    raw = io.BytesIO()
    with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as gz:
        with tarfile.open(fileobj=gz, mode="w", format=tarfile.GNU_FORMAT) as tf:
            for ti, body in members:
                tf.addfile(ti, io.BytesIO(body) if body is not None else None)
    return raw.getvalue()


def text_member(name, text, mode):
    body = text.encode()
    ti = tarfile.TarInfo("./" + name)
    # Not 0: the device's GNU tar 1.17 warns "implausibly old time stamp".
    ti.size, ti.mode, ti.mtime = len(body), mode, CONTROL_MTIME
    return ti, body


def ar_pack(parts):
    out = [b"!<arch>\n"]
    for name, body in parts:
        out.append(("%-16s%-12d%-6d%-6d%-8s%-10d`\n"
                    % (name, 0, 0, 0, "100644", len(body))).encode())
        out.append(body + (b"\n" if len(body) & 1 else b""))
    return b"".join(out)


def collect_data(path, wanted, extras):
    """[(TarInfo, bytes)] for the wanted members of the new rootfs, in its order,
    then the wanted members that only hp.tar has."""
    out, seen = [], set()
    tf = open_rootfs(path)
    for ti in tf:
        name = norm(ti.name)
        if name not in wanted:
            continue
        body = tf.extractfile(ti).read() if ti.isreg() else None
        ti.name = "./" + name
        ti.pax_headers = {}
        if name in seen:                # named twice: keep only the final member
            out = [m for m in out if norm(m[0].name) != name]
        out.append((ti, body))
        seen.add(name)
    for name in sorted(wanted - seen):
        if name in extras:
            out.append(extras[name])
            seen.add(name)
    if seen != wanted:
        sys.exit("new rootfs lacks members the delta names: %s" % sorted(wanted - seen)[:5])
    return out


def simulate(old, ops, data_members, pkg):
    """Apply the payload to the old image's member table, the way mmipkg would."""
    state = dict(old)
    for p in ops["preinst_unlink"]:
        state.pop(p, None)
    for ti, body in data_members:
        rec = {"type": TYPE_NAMES[ti.type], "mode": ti.mode & 0o7777,
               "uid": ti.uid, "gid": ti.gid}
        if ti.isreg():
            rec["size"] = ti.size
            rec["sha256"] = hashlib.sha256(body).hexdigest()
            rec["md5"] = hashlib.md5(body).hexdigest()
        elif ti.issym() or ti.islnk():
            rec["target"] = ti.linkname
        state[norm(ti.name)] = rec
    for p in ops["postinst_rm"]:
        state.pop(p, None)
    for p in ops["postinst_rmdir"]:
        if not any(k.startswith(p + "/") for k in state):   # rmdir: only if empty
            state.pop(p, None)
    for p, n in ops["postinst_meta"]:
        state[p] = dict(state[p], mode=n["mode"], uid=n["uid"], gid=n["gid"])
    return state


def cmd_build(args):
    old, new, delta, staged, old_blobs, new_blobs = load(args)
    report(args, old, new, delta, staged)
    oi, ni = build_info(old_blobs[BUILD_INFO]), build_info(new_blobs[BUILD_INFO])
    to_version = ni["PRODUCT_VERSION_STRING"].split()[-1]
    pkg = "org.webosarchive.ce-ota-%s" % to_version
    for rec in old:
        if rec.startswith("%s/%s." % (IPKG_INFO, pkg)):
            sys.exit("package id %s already exists in the old image" % pkg)

    ops = plan_ops(delta, old, new)
    data_members = collect_data(args.new, set(ops["data"]), new_blobs[EXTRAS])

    # Proof before anything is written: old image + payload == new image.
    left = compare(simulate(old, ops, data_members, pkg), new)
    if left:
        for d in left[:20]:
            print("NOT CONVERGED %-8s /%s (%s)" % (d["change"], d["path"], describe(d)))
        sys.exit("payload does not turn the old image into the new one (%d paths)" % len(left))
    print("converges: old image + payload == new image, all %d members" % len(new))

    control = ("Package: %s\nVersion: %s\nArchitecture: all\n"
               "Maintainer: webOS Archive\n"
               "Description: webOS CE %s (%s) to %s (%s), rootfs delta\n"
               % (pkg, ni["BUILDMARK"], oi["PRODUCT_VERSION_STRING"].split()[-1],
                  oi["BUILDMARK"], to_version, ni["BUILDMARK"]))
    control_tgz = tar_gz([text_member("control", control, 0o644),
                          text_member("preinst", render_preinst(ops), 0o755),
                          text_member("postinst", render_postinst(ops, pkg), 0o755)])
    data_tgz = tar_gz(data_members)
    ipk = ar_pack([("debian-binary", b"2.0\n"), ("control.tar.gz", control_tgz),
                   ("data.tar.gz", data_tgz)])
    ipk_name = "%s_%s_all.ipk" % (pkg, ni["BUILDMARK"])

    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, ipk_name), "wb") as f:
        f.write(ipk)
    for name, text in (("preinst", render_preinst(ops)), ("postinst", render_postinst(ops, pkg))):
        with open(os.path.join(args.out, name), "w") as f:
            f.write(text)
    manifest_inputs = {
        "from": {"version": oi["PRODUCT_VERSION_STRING"], "buildmark": oi["BUILDMARK"]},
        "to": {"version": ni["PRODUCT_VERSION_STRING"], "buildmark": ni["BUILDMARK"]},
        "payload": {"file": ipk_name, "size": len(ipk),
                    "sha256": hashlib.sha256(ipk).hexdigest(),
                    "md5": hashlib.md5(ipk).hexdigest()},
        "preflight": {"path": "/" + PREFLIGHT_FILE, "sha256": old[PREFLIGHT_FILE]["sha256"],
                      "md5": old[PREFLIGHT_FILE]["md5"]},   # the device has md5sum only
        "counts": {k: len(v) for k, v in ops.items()},
        "tier": "armed-flash",
        # What the client checks before arming. Running out of room on / inside the
        # ramdisk leaves a half-written rootfs that no retry repairs, so the client
        # needs the free space on / to cover the net growth plus the largest file
        # (the old copy and the new one coexist while tar replaces it).
        "space": {"rootfs_growth": file_bytes(new) - file_bytes(old),
                  "largest_file": max([new[p].get("size", 0) for p in ops["data"]] or [0])},
    }
    with open(os.path.join(args.out, "manifest-inputs.json"), "w") as f:
        json.dump(manifest_inputs, f, indent=1, sort_keys=True)
        f.write("\n")
    print("payload: %s/%s  %d bytes (%.1f MB)  sha256 %s"
          % (args.out, ipk_name, len(ipk), len(ipk) / 1048576.0,
             manifest_inputs["payload"]["sha256"]))
    print("UNSIGNED and never run on a device.")


SEED_PREFIX = "usr/palm/ce-seed/cryptofs/"
IPKGS_PREFIX = "usr/palm/ipkgs/"


def cmd_finish_list(args):
    """What ce-ota-finish needs to know about an image a device can come from:
    the md5 of every staged ipk (I) and of every cryptofs seed file (S)."""
    image = scan(args.image, {})
    out = ["# GENERATED by build/ota/make-payload.py finish-list from %s -- do not edit."
           % os.path.basename(args.image)]
    for p in sorted(image):
        r = image[p]
        if r["type"] != "file":
            continue
        if p.startswith(IPKGS_PREFIX) and p.endswith(".ipk"):
            out.append("I %s %s" % (r["md5"], p[len(IPKGS_PREFIX):]))
        elif p.startswith(SEED_PREFIX):
            if " " in p:
                sys.exit("a seed path with a space, which ce-ota-finish cannot read: %s" % p)
            out.append("S %s %s" % (r["md5"], p[len(SEED_PREFIX):]))
    sys.stdout.write("\n".join(out) + "\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("diff", help="compare two rootfs images")
    d.add_argument("old")
    d.add_argument("new")
    d.add_argument("--out", help="directory for delta.json and delta.txt")
    d.set_defaults(func=cmd_diff)
    b = sub.add_parser("build", help="diff, then build the payload ipk and prove it converges")
    b.add_argument("old")
    b.add_argument("new")
    b.add_argument("--out", required=True, help="directory for the ipk and its reports")
    b.set_defaults(func=cmd_build)
    f = sub.add_parser("finish-list", help="an old image's staged-ipk and seed md5s, for ce-ota-finish")
    f.add_argument("image")
    f.set_defaults(func=cmd_finish_list)
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
