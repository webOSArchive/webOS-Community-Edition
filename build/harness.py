#!/usr/bin/env python3
"""
webOS CE Doctor — Phase 0 repack harness.

Pipeline: unpack the OEM Doctor JAR -> apply an overlay of file changes to the
rootfs -> regenerate the ipkg md5sum database for the changes -> verify with a
faithful re-implementation of the on-device `integcheck ... ipkg` check ->
repack into a flashable JAR, with the FlasherThread `checkToFlash` gate patched
off and the JAR unsigned.

No device required. Nothing here changes the OS behaviour beyond the overlay you
supply; with no overlay it produces a functionally-identical (re-signed-off,
gate-patched) Doctor.

Subcommands:
  extract       JAR -> work/webos/ (webOS.tar members incl. rootfs.tar.gz on disk)
  integcheck    Faithful `integcheck ... ipkg` dry-run over a rootfs tar.gz
  build         extract (if needed) -> apply overlay -> regen md5 -> integcheck ->
                repack -> patched, unsigned CE Doctor JAR
  patch-flasher Show/verify the FlasherThread checkToFlash patch on a class file

See build/README.md for the model and the overlay format.
"""

import argparse
import fnmatch
import gzip
import hashlib
import io
import json
import os
import shutil
import sys
import tarfile
import time
import zipfile

# ---- Constants tied to this Doctor / device (topaz) -------------------------

WEBOS_TAR_ENTRY = "resources/webOS.tar"
ROOTFS_MEMBER = "./nova-cust-image-topaz.rootfs.tar.gz"
FLASHER_CLASS = "com/palm/nova/installer/core/FlasherThread.class"
MAIN_CLASS = "com.palm.nova.installer.recoverytool.RecoveryTool"
IPKG_INFO_DIR = "./usr/lib/ipkg/info"

# ---- CE branding of the installer wrapper (JAR resources) -------------------
# The OEM Doctor's own UI still says HP everywhere: the title bar, the two cards
# that promise an HP profile restore, and support links to servers that have
# been dead for over a decade. None of it is load-bearing — see the audit in
# TEARDOWN §2 — so it is rewritten at repack time from the SAME build metadata
# the rootfs is branded with (etc/palm-build-info in the overlay), which keeps
# the wrapper and the OS it installs from disagreeing about what this is.
CONFIG_ENTRY = "resources/recoverytool.config"
CARDCTL_CLASS = "com/palm/nova/installer/recoverytool/CardController.class"
MESSAGES_GLOB = "resources/messages"

# The window title is built in CardController as
#   "HP(R) webOS(tm) Doctor (Build " + ConfigFileMgr.getPhoenixBuildVersion() + ")"
# so dropping the vendor mark here is the whole change. It is a length-prefixed
# CONSTANT_Utf8 entry, so a SHORTER replacement is fine (see patch_class_utf8).
TITLE_OLD = b"HP(R) webOS(tm) Doctor (Build "
TITLE_NEW = b"webOS(tm) Doctor (Build "

# recoverytool.config keys that are safe to rewrite. Audited against every class
# in the JAR:
#   VersionStr           read by NO class — ConfigFileMgr's key set does not
#                        include it; it only reaches the log because
#                        loadConfiguration enumerates every property.
#   RomBuildNumber       reaches getPhoenixBuildVersion() (the title bar) only.
#   RecoveryToolBuildTime  same — title bar only.
# DELIBERATELY NOT TOUCHED: RecoveryToolBuildNumber (MainFlasher hands it to the
# build-approval check alongside the Approval*Hash blobs — the dead-server gate
# we neutralise via setCheckFlash(false); no reason to poke it), and
# CustomizationBuild (it names the resources/hp.tar payload the customization
# stage flashes — it is not a display string, even though the title's "Hp."
# prefix is derived from it), BaseBuild, DeviceType, ForceModemUpdate,
# SoftwareUpdateSite, Approval*.
SUPPORT_URL = "https://docs.webosarchive.org/doctor/"

# Every message bundle carries the same keys; the localized ones are older still
# and say "Palm profile". Replaced in all 9 so no locale keeps the dead promise.
# Not touched here, and worth deciding on separately: BootiefyCard.2/.3 tell the
# user to pull the back cover and remove the battery, which no TouchPad has, and
# EulaCard.1 still points at HP's EULA.
_MSG_EN = {
    "EndFlashingCard.2": "Your device is now restarting. Follow the instructions on your device to set your language and finish setup.\n\n",
    "EndFlashingCard.4": "After your device is reset, your apps and data can be restored from a backup made with the webOS CE Backup app. Music, videos and documents already on the device are not affected.",
    "BeginFlashingCard.3": "After your device is reset, your apps and data can be restored from a backup made with the webOS CE Backup app. Music, videos and documents already on the device are not affected.",
    "FlashingFailedCard.2": " webOS Archive",
}
_MSG_DE = {
    "EndFlashingCard.2": "Ihr Ger\u00E4t wird jetzt neu gestartet. Folgen Sie den Anweisungen auf dem Ger\u00E4t, um die Sprache einzustellen und die Einrichtung abzuschlie\u00DFen.\n\n",
    "EndFlashingCard.4": "Nach dem Zur\u00FCcksetzen k\u00F6nnen Ihre Apps und Daten aus einer Sicherung wiederhergestellt werden, die mit der Backup-App von webOS CE erstellt wurde. Musik, Videos und Dokumente auf dem Ger\u00E4t sind nicht betroffen.",
    "FlashingFailedCard.2": " webOS Archive",
}
_MSG_ES = {
    "EndFlashingCard.2": "El dispositivo se est\u00E1 reiniciando. Sigue las instrucciones en pantalla para elegir el idioma y completar la configuraci\u00F3n.\n\n",
    "EndFlashingCard.4": "Despu\u00E9s de restablecer el dispositivo, tus aplicaciones y datos se pueden restaurar desde una copia de seguridad creada con la aplicaci\u00F3n Backup de webOS CE. La m\u00FAsica, los v\u00EDdeos y los documentos del dispositivo no se ven afectados.",
    "FlashingFailedCard.2": " webOS Archive",
}
_MSG_FR = {
    "EndFlashingCard.2": "Votre appareil red\u00E9marre. Suivez les instructions affich\u00E9es pour choisir la langue et terminer la configuration.\n\n",
    "EndFlashingCard.4": "Une fois l\u2019appareil r\u00E9initialis\u00E9, vos applications et vos donn\u00E9es peuvent \u00EAtre restaur\u00E9es \u00E0 partir d\u2019une sauvegarde cr\u00E9\u00E9e avec l\u2019application Backup de webOS CE. La musique, les vid\u00E9os et les documents pr\u00E9sents sur l\u2019appareil ne sont pas affect\u00E9s.",
    "FlashingFailedCard.2": " webOS Archive",
}
_MSG_IT = {
    "EndFlashingCard.2": "Il dispositivo si sta riavviando. Segui le istruzioni sul dispositivo per impostare la lingua e completare la configurazione.\n\n",
    "EndFlashingCard.4": "Dopo il ripristino, le tue app e i tuoi dati possono essere ripristinati da un backup creato con l\u2019app Backup di webOS CE. Musica, video e documenti gi\u00E0 presenti sul dispositivo non vengono modificati.",
    "FlashingFailedCard.2": " webOS Archive",
}
for _m in (_MSG_DE, _MSG_ES, _MSG_FR, _MSG_IT):
    _m["BeginFlashingCard.3"] = _m["EndFlashingCard.4"]
# All dead links (go.palm.com, palm.com/us/support, hpwebos.com) -> the community
# doctor docs, in every bundle.
_MSG_LINKS = {k: SUPPORT_URL for k in
              ("CardController.14", "FlashingFailedCard.5", "FlashingFailedCard.7")}
MESSAGE_OVERRIDES = {}
for _suffix, _base in (("", _MSG_EN), ("_en_GB", _MSG_EN), ("_en_IE", _MSG_EN),
                       ("_de_DE", _MSG_DE), ("_es_ES", _MSG_ES), ("_es_US", _MSG_ES),
                       ("_fr_FR", _MSG_FR), ("_fr_CA", _MSG_FR), ("_it_IT", _MSG_IT)):
    MESSAGE_OVERRIDES[f"resources/messages{_suffix}.properties"] = dict(_base, **_MSG_LINKS)

# integcheck ipkg-mode semantics, copied verbatim from /usr/sbin/integcheck.
IGNORE_IPKG_PREFIXES = ("./dev", "./media/internal", "./var")
FS_EXCLUDE_PREFIXES = ("./usr/lib/ipkg", "./dev", "./media/internal", "./var")
IPKG_ROOTFS_EXTRA_FILES = (
    "./etc/passwd", "./etc/group", "./etc/version", "./etc/ipkg/arch.conf",
)
# ROOTFS_EXTRA_FILES: files that may exist yet are in no md5sums list. Globs allowed.
ROOTFS_EXTRA_FILES = (
    "./usr/share/omadm/internal", "./usr/share/omadm/beta",
    "./usr/share/omadm/carrier", "./usr/share/omadm/production",
    "./usr/share/omadm/none", "./etc/ld.so.cache", "./usr/bin/PmUpdater.save",
    "./usr/lib/libipkg.so.0.0.0.save", "./usr/update-save-lib/*", "./.reboot",
    "./etc/.rootfs_RW", "./etc/modules", "./etc/modules.conf",
    "./etc/modules.conf.old", "./lib/modules/*/modules.*",
    "./etc/ppp/connect-errors", "./etc/.configured", "./boot/lib", "./boot/usr",
    "./boot/bin", "./boot/sbin", "./etc/fstab", "./etc/fs.d/*",
    "./usr/share/omadm/sdk", "./md5sums", "./md5sums.gz",
)

BLOCK = 1 << 20


def log(msg):
    print(f"[ce-harness] {msg}", file=sys.stderr, flush=True)


def norm(path):
    """Normalize a member/overlay path to integcheck's './...' form."""
    p = path.replace("\\", "/")
    if p.startswith("/"):
        p = "." + p
    elif not p.startswith("./"):
        p = "./" + p.lstrip("./") if not p.startswith(".") else p
    return p


def md5_stream(fileobj):
    h = hashlib.md5()
    while True:
        b = fileobj.read(BLOCK)
        if not b:
            break
        h.update(b)
    return h.hexdigest()


def md5_file(path):
    with open(path, "rb") as f:
        return md5_stream(f)


# ---- extract ----------------------------------------------------------------

def cmd_extract(jar_path, work):
    webos_dir = os.path.join(work, "webos")
    os.makedirs(webos_dir, exist_ok=True)
    meta = {"order": [], "members": {}}
    log(f"opening {jar_path}")
    with zipfile.ZipFile(jar_path) as z:
        with z.open(WEBOS_TAR_ENTRY) as wf:
            tf = tarfile.open(fileobj=wf, mode="r|")
            for m in tf:
                meta["order"].append(m.name)
                meta["members"][m.name] = {
                    "mode": m.mode, "uid": m.uid, "gid": m.gid,
                    "uname": m.uname, "gname": m.gname, "mtime": int(m.mtime),
                    "type": m.type.decode() if isinstance(m.type, bytes) else m.type,
                    "size": m.size,
                }
                out = os.path.join(webos_dir, os.path.basename(m.name))
                if m.isfile():
                    log(f"  extract {m.name} ({m.size} bytes)")
                    src = tf.extractfile(m)
                    with open(out, "wb") as o:
                        shutil.copyfileobj(src, o, BLOCK)
                # dirs/other webOS.tar members: recorded in meta, no content
    with open(os.path.join(webos_dir, ".tarmeta.json"), "w") as f:
        json.dump(meta, f, indent=2)
    log(f"extracted webOS.tar members -> {webos_dir}")
    rootfs = os.path.join(webos_dir, os.path.basename(ROOTFS_MEMBER))
    if not os.path.exists(rootfs):
        raise SystemExit(f"ERROR: rootfs member not found: {ROOTFS_MEMBER}")
    log(f"base rootfs: {rootfs}")
    return webos_dir


# ---- overlay + md5 regeneration ---------------------------------------------

def load_webos_overrides(overlay_dir, webos_dir):
    """Return {basename: local_path} for the files in overlay/webos/.

    These replace same-named members of webOS.tar itself -- the files the
    Doctor flashes that are not in the rootfs, such as the boot logos it writes
    to NVRAM. A name that is not already a member is refused: topaz.xml names
    every file it flashes, so a new one would be carried and never used, and a
    typo would ship the stock file without a word. The rootfs is not replaced
    this way; it is built from overlay/rootfs/.
    """
    out = {}
    d = os.path.join(overlay_dir, "webos") if overlay_dir else None
    if not d or not os.path.isdir(d):
        return out
    with open(os.path.join(webos_dir, ".tarmeta.json")) as f:
        members = {os.path.basename(n) for n in json.load(f)["order"]}
    for name in sorted(os.listdir(d)):
        full = os.path.join(d, name)
        if not os.path.isfile(full):
            sys.exit(f"[ce-harness] FATAL: {full} is not a regular file")
        if name == os.path.basename(ROOTFS_MEMBER):
            sys.exit(f"[ce-harness] FATAL: {full}: the rootfs comes from overlay/rootfs/, "
                     f"not overlay/webos/")
        if name not in members:
            sys.exit(f"[ce-harness] FATAL: {full} is not a webOS.tar member "
                     f"(members: {', '.join(sorted(members))})")
        out[name] = full
    return out


def load_overlay(overlay_dir):
    """Return (adds_replaces, removes, symlinks, changes_cfg).

    adds_replaces: {normpath: local_file_path} regular files from overlay/rootfs/**
    removes:       [normpath, ...] from changes.json
    symlinks:      {normpath: target} — symlinks found in overlay/rootfs/** (their
                   link target is read with os.readlink; NOT followed). integcheck
                   treats symlinks as invisible (-type f), so these carry no md5.
    changes_cfg:   parsed changes.json (may declare a ce_package name, adds' owners)
    """
    adds = {}
    removes = []
    symlinks = {}
    cfg = {}
    if not overlay_dir:
        return adds, removes, symlinks, cfg
    # A wrong --overlay path must fail the build, not silently produce a
    # stock jar: the path is resolved relative to the caller's cwd, and an
    # empty overlay is indistinguishable from a typo'd one.
    if not os.path.isdir(overlay_dir):
        sys.exit(f"[ce-harness] FATAL: overlay dir does not exist: {overlay_dir} "
                 f"(paths resolve relative to the current directory)")
    if not (os.path.exists(os.path.join(overlay_dir, "changes.json"))
            or os.path.isdir(os.path.join(overlay_dir, "rootfs"))):
        sys.exit(f"[ce-harness] FATAL: {overlay_dir} has neither changes.json "
                 f"nor rootfs/ — not an overlay dir")
    cfg_path = os.path.join(overlay_dir, "changes.json")
    if os.path.exists(cfg_path):
        with open(cfg_path) as f:
            cfg = json.load(f)
        removes = [norm(p) for p in cfg.get("remove", [])]
    root = os.path.join(overlay_dir, "rootfs")
    if os.path.isdir(root):
        for dirpath, _dirs, files in os.walk(root):
            for name in files:
                full = os.path.join(dirpath, name)
                rel = os.path.relpath(full, root)
                if os.path.islink(full):
                    symlinks[norm(rel)] = os.readlink(full)
                else:
                    adds[norm(rel)] = full
    return adds, removes, symlinks, cfg


def read_base_metadata(rootfs_tar):
    """One streaming pass over the base rootfs tar.

    Collects: member path set, the raw bytes of every *.md5sums under the ipkg
    info dir, and each member's TarInfo (for edit-in-place of tracked files).
    """
    present = set()
    present_dirs = set()   # python tarfile strips the trailing "/" from dir
                           # names, so dir-ness must be recorded explicitly
    md5sums_files = {}   # './usr/lib/ipkg/info/<pkg>.md5sums' -> text
    log(f"pass A (metadata): scanning {rootfs_tar}")
    tf = tarfile.open(rootfs_tar, mode="r|gz")
    for m in tf:
        name = norm(m.name)
        present.add(name)
        if m.isdir():
            present_dirs.add(name)
        if name.startswith(IPKG_INFO_DIR + "/") and name.endswith(".md5sums"):
            md5sums_files[name] = tf.extractfile(m).read().decode("utf-8", "replace")
    tf.close()
    log(f"  {len(present)} members, {len(md5sums_files)} .md5sums files")
    return present, md5sums_files, present_dirs


def find_owner(path, md5sums_files):
    """Which package's .md5sums lists `path` (normpath). Returns member name or None."""
    needle_suffixes = (" *" + path + "\n", " *" + path)
    for member, text in md5sums_files.items():
        for line in text.splitlines():
            # format: "<md5> *./path"
            parts = line.split(" *", 1)
            if len(parts) == 2 and norm(parts[1].strip()) == path:
                return member
    return None


def plan_md5_updates(adds, removes, present, md5sums_files, ce_pkg):
    """Compute the new content for every .md5sums we must rewrite, plus new
    members for a CE package covering brand-new tracked files.

    Returns (md5sums_rewrites, new_members) where:
      md5sums_rewrites: {member_name: new_text}
      new_members: {normpath: bytes}  (e.g. the CE package's .md5sums/.list/status additions)
    """
    rewrites = {name: text for name, text in md5sums_files.items()}  # start from copies
    ce_md5_member = f"{IPKG_INFO_DIR}/{ce_pkg}.md5sums"
    ce_list_member = f"{IPKG_INFO_DIR}/{ce_pkg}.list"
    ce_entries = {}   # path -> md5   (new files with no existing owner)
    changed = set()

    def is_ignored(p):
        return any(p == pre or p.startswith(pre + "/") for pre in IGNORE_IPKG_PREFIXES)

    # Removals: drop the path's line from its owning .md5sums.
    for p in removes:
        owner = find_owner(p, rewrites)
        if owner:
            rewrites[owner] = "\n".join(
                ln for ln in rewrites[owner].splitlines()
                if not (ln.split(" *", 1)[-1].strip() == p.lstrip("."))
                and norm(ln.split(" *", 1)[-1].strip()) != p
            ) + ("\n" if rewrites[owner].endswith("\n") else "")
            changed.add(owner)

    # Adds/replaces: compute md5 and route to the owning package or the CE package.
    for p, local in sorted(adds.items()):
        if is_ignored(p):
            continue  # /var,/dev,/media/internal not tracked by integcheck
        digest = md5_file(local)
        owner = find_owner(p, rewrites)
        line = f"{digest} *{p}"
        if owner:
            new_lines = []
            replaced = False
            for ln in rewrites[owner].splitlines():
                cur = ln.split(" *", 1)
                if len(cur) == 2 and norm(cur[1].strip()) == p:
                    new_lines.append(line)
                    replaced = True
                else:
                    new_lines.append(ln)
            if not replaced:
                new_lines.append(line)
            rewrites[owner] = "\n".join(new_lines) + "\n"
            changed.add(owner)
        else:
            ce_entries[p] = digest

    new_members = {}
    if ce_entries:
        existing = rewrites.get(ce_md5_member, "")
        lines = [ln for ln in existing.splitlines() if ln.strip()]
        have = {norm(ln.split(" *", 1)[-1].strip()) for ln in lines if " *" in ln}
        for p, digest in sorted(ce_entries.items()):
            if p not in have:
                lines.append(f"{digest} *{p}")
        text = "\n".join(lines) + "\n"
        rewrites[ce_md5_member] = text
        changed.add(ce_md5_member)
        # a matching .list so the package looks installed to tooling
        list_text = "\n".join(sorted(p.lstrip(".") for p in ce_entries)) + "\n"
        new_members[norm(ce_list_member)] = list_text.encode()

    # Normalize every rewritten file: entry lines only, and a file whose
    # entries were ALL removed must be truly EMPTY (0 bytes, like stock's
    # genuinely empty md5sums). Serializing it as a lone "\n" leaves a blank
    # line, and the DEVICE integcheck (busybox `md5sum -c` over the
    # concatenation of every *.md5sums) counts each blank line as a failed
    # checksum — SILENTLY (the per-line error goes to stderr, which integcheck
    # discards) — failing the whole flash with "Base ROM Failed Verification,
    # CODE 1" and no visible detail. Confirmed live 2026-08-17: 14 emptied
    # packages -> 14 blank lines -> flash fail at the ROM Verifyer stage.
    for name in changed:
        if name in rewrites:
            lines = [ln for ln in rewrites[name].splitlines() if ln.strip()]
            rewrites[name] = "\n".join(lines) + "\n" if lines else ""

    # Only return the .md5sums we actually changed.
    rewrites = {k: v for k, v in rewrites.items() if k in changed}
    return rewrites, new_members, ce_entries


# ---- rootfs rewrite (streaming) ---------------------------------------------

def compute_emptied_dirs(present, present_dirs, removes, adds, symlinks):
    """Directory members whose entire (non-dir) subtree is being removed and
    which get nothing added back — dropped by rewrite_rootfs so a fully
    retired app doesn't leave an empty directory skeleton on the device (seen
    live: /usr/palm/applications/com.palm.app.skype, 57 empty dirs, 0 files).
    present_dirs comes from read_base_metadata (python tarfile strips the
    trailing "/" from dir names, so names alone can't tell dirs apart)."""
    remove_set = {norm(p) for p in removes} | {norm(p) for p in (symlinks or {})}
    files = present - present_dirs
    dirs = set(present_dirs)

    def ancestors(path):
        d = path.rsplit("/", 1)[0]
        while len(d) > 1:
            yield d
            d = d.rsplit("/", 1)[0]

    protected = set()   # dirs with surviving base content or overlay additions
    for f in files - remove_set:
        protected.update(ancestors(f))
    for p in list(adds) + list(symlinks or {}):
        protected.update(ancestors(norm(p)))
    candidates = set()  # dirs that actually lose content
    for p in remove_set:
        candidates.update(ancestors(p))
    return (candidates & dirs) - protected


def rewrite_rootfs(base_tar, out_tar, adds, removes, md5sums_rewrites, new_members,
                   symlinks=None, drop_dirs=None):
    """Pass B: stream base rootfs -> out, substituting/removing/appending.

    Untouched members are copied verbatim (TarInfo preserved: mode, uid/gid,
    device nodes, symlinks). Edited/added members are forced to root:root (0/0).
    symlinks: {normpath: target} emitted as SYMTYPE members (replacing any base
    member at that path); invisible to integcheck, so no md5 bookkeeping.
    """
    symlinks = symlinks or {}
    sym_set = {norm(p) for p in symlinks}
    substitutions = {}          # normpath -> ('file', local) | ('bytes', b'...')
    for p, local in adds.items():
        substitutions[p] = ("file", local)
    for member, text in md5sums_rewrites.items():
        substitutions[norm(member)] = ("bytes", text.encode())
    remove_set = set(removes) | sym_set   # drop any base file we're replacing with a symlink
    appended = set()

    def make_ti(path, size, mode=0o644):
        ti = tarfile.TarInfo(name=path if path.startswith("./") else "./" + path.lstrip("./"))
        ti.size = size
        ti.mode = mode
        ti.uid = ti.gid = 0
        ti.uname = ti.gname = "root"
        ti.mtime = FIXED_MTIME
        ti.type = tarfile.REGTYPE
        return ti

    log(f"pass B (rewrite): {base_tar} -> {out_tar}")
    src = tarfile.open(base_tar, mode="r|gz")
    # Explicit GzipFile, not mode="w:gz": tarfile's gzopen hands the output
    # PATH to GzipFile, which embeds it plus the current wall-clock time in the
    # gzip header — the one part of the output FIXED_MTIME didn't cover.
    # filename="" + mtime=0 keep rebuilds byte-identical.
    with open(out_tar, "wb") as rawf, \
         gzip.GzipFile(filename="", fileobj=rawf, mode="wb", mtime=0) as gzf, \
         tarfile.open(fileobj=gzf, mode="w") as dst:
        n = 0
        for m in src:
            n += 1
            name = norm(m.name)
            if name in remove_set:
                log(f"  remove  {name}")
                continue
            if m.isdir() and drop_dirs and name.rstrip("/") in drop_dirs:
                log(f"  remove  {name} (emptied dir)")
                continue
            if name in substitutions and m.isfile():
                kind, val = substitutions[name]
                if kind == "file":
                    size = os.path.getsize(val)
                    # Keep the base member's mode: the overlay's own mode is
                    # NOT consulted for a path that already exists (stock's
                    # 0555/0700 etc. are not reproducible from a host file).
                    # Flag the one case where that silently bites -- an
                    # executable overlay source over a non-executable stock
                    # file -- rather than fix it up: upstream ipks carry stray
                    # exec bits on plain .js/.json payload (contacts.linker,
                    # 15 files), and promoting those would change a verified
                    # image for nothing. A script that genuinely needs the bit
                    # has to be handled by the overlay author.
                    if (os.stat(val).st_mode & 0o111) and not (m.mode & 0o111):
                        log(f"  WARNING replace {name}: overlay source is executable "
                            f"but stock mode {m.mode:o} is kept -- if this is a "
                            f"script, it will NOT be executable on the device")
                    ti = make_ti(name, size, mode=m.mode)
                    with open(val, "rb") as f:
                        dst.addfile(ti, f)
                    log(f"  replace {name} ({size} bytes)")
                else:
                    data = val
                    ti = make_ti(name, len(data), mode=m.mode)
                    dst.addfile(ti, io.BytesIO(data))
                    log(f"  update  {name} (md5sums)")
                appended.add(name)
            else:
                # verbatim passthrough (preserve all TarInfo)
                if m.isfile():
                    dst.addfile(m, src.extractfile(m))
                else:
                    dst.addfile(m)  # dirs, symlinks, hardlinks, devices
        # brand-new files not present in the base. Sorted: the dict is in
        # os.walk() order, i.e. the build host's directory-read order, which
        # made the tar (and so the JAR) differ between hosts with identical
        # inputs.
        for name, val in sorted(substitutions.items()):
            if name in appended:
                continue
            kind, v = val
            if kind == "file":
                size = os.path.getsize(v)
                # Brand-new files keep the overlay source's exec bit (0755/0644):
                # replaced files inherit the base member's mode above, but an
                # added binary (e.g. /usr/bin/curl) has no base member to copy.
                mode = 0o755 if (os.stat(v).st_mode & 0o111) else 0o644
                ti = make_ti(name, size, mode=mode)
                with open(v, "rb") as f:
                    dst.addfile(ti, f)
                log(f"  add     {name} ({size} bytes, mode {mode:o})")
            else:
                ti = make_ti(name, len(v))
                dst.addfile(ti, io.BytesIO(v))
                log(f"  add     {name}")
            appended.add(name)
        for name, data in sorted(new_members.items()):
            if name in appended:
                continue
            ti = make_ti(name, len(data))
            dst.addfile(ti, io.BytesIO(data))
            log(f"  add     {name} (ipkg meta)")
        # symlinks (SYMTYPE) — invisible to integcheck, emitted verbatim
        for name, target in sorted(symlinks.items()):
            nm = norm(name)
            if nm in appended:
                continue
            ti = tarfile.TarInfo(name=nm if nm.startswith("./") else "./" + nm.lstrip("./"))
            ti.type = tarfile.SYMTYPE
            ti.linkname = target
            ti.mode = 0o777
            ti.uid = ti.gid = 0
            ti.uname = ti.gname = "root"
            ti.mtime = FIXED_MTIME
            dst.addfile(ti)
            log(f"  symlink {nm} -> {target}")
            appended.add(nm)
        log(f"  {n} source members processed")


FIXED_MTIME = 1324497600  # 2011-12-21, stable so rebuilds are reproducible


# ---- integcheck (faithful ipkg-mode dry-run) --------------------------------

def _allowlisted(path):
    for pat in ROOTFS_EXTRA_FILES:
        if pat == path or fnmatch.fnmatch(path, pat):
            return True
    return False


def cmd_integcheck(rootfs_tar, quiet=False):
    """Re-implementation of `integcheck -r <root> ipkg` (a_opt=s_opt=q_opt=0)."""
    md5_of = {}
    fsfiles = set()
    md5sums_texts = {}
    root_manifest = None  # md5sums.gz contents (text)

    log(f"integcheck: reading {rootfs_tar}")
    tf = tarfile.open(rootfs_tar, mode="r|gz")
    for m in tf:
        name = norm(m.name)
        if name.startswith(IPKG_INFO_DIR + "/") and name.endswith(".md5sums"):
            md5sums_texts[name] = tf.extractfile(m).read().decode("utf-8", "replace")
            continue
        if name == "./md5sums.gz":
            try:
                root_manifest = gzip.decompress(tf.extractfile(m).read()).decode("utf-8", "replace")
            except Exception:
                root_manifest = None
            continue
        if m.isfile() or m.islnk():
            # regular file (or hardlink -> a regular file on device): -type f
            if not any(name == p or name.startswith(p + "/") for p in FS_EXCLUDE_PREFIXES):
                fsfiles.add(name)
            if m.isfile():
                md5_of[name] = md5_stream(tf.extractfile(m))
    tf.close()

    # expected[path] = md5, from all package md5sums minus IGNORE_IPKG paths.
    # Malformed lines — including BLANK ones — are counted as failures: the
    # device's real integcheck runs busybox `md5sum -c` over the concatenation
    # of every *.md5sums, and each such line is a (silent, stderr-only) failed
    # checksum there. Skipping them here let a lone-"\n" md5sums file pass the
    # build and fail the flash at the ROM Verifyer (confirmed live 2026-08-17).
    expected = {}
    malformed = []
    for member, text in md5sums_texts.items():
        for line in text.splitlines():
            parts = line.split(" *", 1)
            if len(parts) != 2:
                malformed.append((member, line))
                continue
            digest = parts[0].strip()
            path = norm(parts[1].strip())
            if any(path == pre or path.startswith(pre + "/") for pre in IGNORE_IPKG_PREFIXES):
                continue
            expected[path] = digest

    # borrow the 4 rootfs-extra files from the root manifest (as integcheck does)
    borrowed = set()
    if root_manifest:
        for line in root_manifest.splitlines():
            parts = line.split(" *", 1)
            if len(parts) != 2:
                continue
            path = norm(parts[1].strip())
            if path in IPKG_ROOTFS_EXTRA_FILES:
                expected[path] = parts[0].strip()
                borrowed.add(path)

    # corrupt / missing
    missing, failed = [], []
    for path, digest in expected.items():
        if path not in md5_of:
            if path not in fsfiles:  # a hardlink target may lack md5_of but exist
                missing.append(path)
        elif md5_of[path] != digest:
            failed.append(path)

    # ADDED: files on disk absent from the md5 list and not allowlisted
    md5files = set(expected.keys()) | borrowed | {"./md5sums", "./md5sums.gz"}
    added = []
    for f in sorted(fsfiles):
        if f in md5files or _allowlisted(f):
            continue
        added.append(f)

    status = 0
    if failed or missing or malformed:
        status += 1
    if added:
        status += 16

    if not quiet:
        for p in sorted(missing):
            print(f"{p}: MISSING")
        for p in sorted(failed):
            print(f"{p}: FAILED")
        for p in added:
            print(f"{p}: ADDED")
        for member, line in malformed:
            print(f"{member}: MALFORMED LINE {line!r} (would fail device md5sum -c)")
        if status == 0:
            print("integcheck IPKG VERIFICATION SUCCEEDED")
        else:
            print(f"integcheck IPKG VERIFICATION FAILED, CODE {status}")
        print(f"  checked={len(expected)} fsfiles={len(fsfiles)} "
              f"missing={len(missing)} failed={len(failed)} added={len(added)} "
              f"malformed={len(malformed)}")
    return status


# ---- FlasherThread bytecode patch -------------------------------------------

def _find_fieldref_index(data, field_name):
    """Parse the class constant pool; return the Fieldref cp-index whose
    NameAndType name == field_name. Robust to constant-pool renumbering."""
    if data[:4] != b"\xca\xfe\xba\xbe":
        raise SystemExit("ERROR: not a Java class file")
    n = int.from_bytes(data[8:10], "big")  # constant_pool_count
    p = 10
    utf8 = {}          # idx -> str
    nameandtype = {}   # idx -> (name_idx, desc_idx)
    fieldref = {}      # idx -> (class_idx, nat_idx)
    i = 1
    while i < n:
        tag = data[p]; p += 1
        if tag == 1:  # Utf8
            ln = int.from_bytes(data[p:p+2], "big"); p += 2
            utf8[i] = data[p:p+ln].decode("utf-8", "replace"); p += ln
        elif tag in (7, 8, 16):        # Class, String, MethodType: u2
            p += 2
        elif tag in (9, 10, 11, 12, 18, 17, 19, 20):  # *ref/NAT/(Invoke)Dynamic: u2 u2
            a = int.from_bytes(data[p:p+2], "big")
            b = int.from_bytes(data[p+2:p+4], "big")
            if tag == 9:
                fieldref[i] = (a, b)
            elif tag == 12:
                nameandtype[i] = (a, b)
            p += 4
        elif tag in (3, 4):            # Integer, Float: u4
            p += 4
        elif tag in (5, 6):            # Long, Double: u8, occupies TWO slots
            p += 8; i += 1
        elif tag == 15:                # MethodHandle: u1 u2
            p += 3
        else:
            raise SystemExit(f"ERROR: unknown constant pool tag {tag} at slot {i}")
        i += 1
    name_utf8_idx = next((k for k, v in utf8.items() if v == field_name), None)
    if name_utf8_idx is None:
        raise SystemExit(f"ERROR: field name {field_name!r} not in constant pool")
    nat_idxs = {k for k, (nm, _d) in nameandtype.items() if nm == name_utf8_idx}
    fr = [k for k, (_c, nat) in fieldref.items() if nat in nat_idxs]
    if len(fr) != 1:
        raise SystemExit(f"ERROR: expected 1 Fieldref for {field_name}, found {len(fr)}: {fr}")
    return fr[0]


def patch_flasher_bytes(data):
    """Force checkToFlash=false by neutralizing setCheckFlash():
    aload_0; iload_1; putfield #idx; return  ->  aload_0; iconst_0; putfield ...

    Length-preserving (iload_1=0x1b -> iconst_0=0x03), stack-safe, verifier-clean.
    The 2-arg constructor already defaults checkToFlash=false, so the setter is
    the only path that flips it true. The target putfield is disambiguated by the
    exact constant-pool Fieldref index for checkToFlash (not a hardcoded value).
    """
    import re
    idx = _find_fieldref_index(data, "checkToFlash")
    idx_bytes = idx.to_bytes(2, "big")
    # setter shape: aload_0(2A) iload_1(1B) putfield(B5) <idx> return(B1)
    pat = re.compile(rb"\x2a\x1b\xb5" + re.escape(idx_bytes) + rb"\xb1", re.DOTALL)
    hits = list(pat.finditer(data))
    if len(hits) != 1:
        raise SystemExit(f"ERROR: expected exactly 1 setCheckFlash(#{idx}) pattern, "
                         f"found {len(hits)}")
    off = hits[0].start()
    patched = data[:off + 1] + b"\x03" + data[off + 2:]  # iload_1 -> iconst_0
    return patched, off, idx


def cmd_patch_flasher(class_path, write=False):
    with open(class_path, "rb") as f:
        data = f.read()
    patched, off, idx = patch_flasher_bytes(data)
    log(f"setCheckFlash: iload_1->iconst_0 at file offset {off} (putfield #{idx})")
    if write:
        with open(class_path, "wb") as f:
            f.write(patched)
        log(f"patched in place: {class_path}")
    else:
        log("dry-run (pass --write to apply)")
    return patched


# ---- repack -----------------------------------------------------------------

def rebuild_webos_tar(webos_dir, out_path, overrides=None):
    """Rebuild resources/webOS.tar from work/webos/ in the original member order.

    overrides: {basename: local_path} — use this file's content for a member
    instead of the cached copy in webos_dir. Used to substitute the rewritten
    rootfs without ever writing over the cached pristine extraction, so
    work/webos/ stays a faithful, re-usable base across builds.
    """
    overrides = overrides or {}
    with open(os.path.join(webos_dir, ".tarmeta.json")) as f:
        meta = json.load(f)
    log(f"rebuilding webOS.tar -> {out_path}")
    with tarfile.open(out_path, mode="w") as tf:
        for name in meta["order"]:
            info = meta["members"][name]
            base = os.path.basename(name)
            local = overrides.get(base, os.path.join(webos_dir, base))
            ti = tarfile.TarInfo(name=name)
            ti.mode = info["mode"]
            ti.uid = info["uid"]; ti.gid = info["gid"]
            ti.uname = info["uname"]; ti.gname = info["gname"]
            ti.mtime = info["mtime"]
            t = info["type"]
            if os.path.isfile(local) and (t == "0" or t == "\x00" or t == tarfile.REGTYPE.decode() if isinstance(tarfile.REGTYPE, bytes) else True) and os.path.isfile(local):
                ti.type = tarfile.REGTYPE
                ti.size = os.path.getsize(local)
                with open(local, "rb") as fh:
                    tf.addfile(ti, fh)
            else:
                ti.type = tarfile.DIRTYPE if t == "5" else tarfile.REGTYPE
                ti.size = 0
                tf.addfile(ti)


def ce_branding(overlay_dir):
    """Read the overlay's etc/palm-build-info and turn it into the JAR-side
    branding values, so the installer wrapper and the OS it flashes cannot
    disagree. Returns None when the overlay has no build info (the
    community-firstuse overlay, or no overlay at all) — then the OEM strings are
    left exactly as they are rather than half-branded."""
    if not overlay_dir:
        return None
    info_path = os.path.join(overlay_dir, "rootfs", "etc", "palm-build-info")
    if not os.path.isfile(info_path):
        return None
    info = {}
    for line in open(info_path):
        if "=" in line:
            k, _, v = line.partition("=")
            info[k.strip()] = v.strip()
    version = info.get("PRODUCT_VERSION_STRING")
    mark = info.get("BUILDMARK")
    if not version or not mark:
        return None
    # BUILDTIME is YYYYMMDDhhmmss; the config field it feeds is displayed
    # verbatim in the title bar, in the OEM's MM/DD/YY hh:mm shape.
    bt = info.get("BUILDTIME", "")
    when = (f"{bt[4:6]}/{bt[6:8]}/{bt[2:4]} {bt[8:10]}:{bt[10:12]}"
            if len(bt) >= 12 and bt.isdigit() else None)
    cfg = {"VersionStr": version, "RomBuildNumber": mark}
    if when:
        cfg["RecoveryToolBuildTime"] = when
    return {"config": cfg, "version": version}


def props_escape(value):
    """Java .properties escaping: a value is one physical line, so newlines
    become \\n, and anything outside printable ASCII becomes \\uXXXX (the OEM
    bundles are written that way, and it keeps the file 7-bit whatever the
    reader assumes). Lets the override tables above hold readable text."""
    out = []
    for ch in value:
        if ch == "\n":
            out.append("\\n")
        elif ch == "\r":
            out.append("\\r")
        elif ch == "\t":
            out.append("\\t")
        elif ord(ch) > 0x7E:
            out.append("\\u%04X" % ord(ch))
        else:
            out.append(ch)
    return "".join(out)


def rewrite_kv_lines(data, overrides, sep="=", escape=False):
    """Replace the value of each `key<sep>value` line present in `data`, leaving
    every other line (and the file's order) untouched. Returns (bytes, hit-keys).
    With escape=True the value is run through props_escape first."""
    out, hits = [], set()
    for raw in data.split(b"\n"):
        line = raw.decode("latin-1")
        key = line.split(sep, 1)[0].strip() if sep in line else None
        if key in overrides:
            val = overrides[key]
            out.append(f"{key}{sep}{props_escape(val) if escape else val}"
                       .encode("ascii"))
            hits.add(key)
        else:
            out.append(raw)
    return b"\n".join(out), hits


def patch_class_utf8(data, old, new):
    """Swap a CONSTANT_Utf8 entry in a .class file. The entry is
    tag(0x01) + u2 length + bytes, and nothing in the format holds an absolute
    offset, so a different-length replacement is safe as long as the length
    prefix is rewritten with it. Fails loudly on 0 or >1 matches — a silent
    no-op here would ship OEM branding while the log claimed otherwise."""
    pat = b"\x01" + len(old).to_bytes(2, "big") + old
    n = data.count(pat)
    if n != 1:
        raise SystemExit(f"[ce-harness] FATAL: expected exactly 1 CONSTANT_Utf8 "
                         f"{old!r} in the class, found {n}")
    return data.replace(pat, b"\x01" + len(new).to_bytes(2, "big") + new, 1)


def rebuild_jar(src_jar, out_jar, new_webos_tar, branding=None):
    """Copy every entry from src_jar into out_jar, except:
      - resources/webOS.tar   (substitute new_webos_tar)
      - META-INF/*.SF, *.RSA  (drop -> unsigned)
      - META-INF/MANIFEST.MF  (replace with a minimal Main-Class manifest)
      - FlasherThread.class   (apply the checkToFlash patch)
    and, when `branding` is given (see ce_branding):
      - recoverytool.config   (VersionStr / RomBuildNumber / build time)
      - messages*.properties  (HP-profile promises + dead support links)
      - CardController.class  (drop the vendor mark from the window title)
    """
    manifest = (
        "Manifest-Version: 1.0\r\n"
        f"Main-Class: {MAIN_CLASS}\r\n"
        "Created-By: webOS CE harness (Phase 0)\r\n"
        "\r\n"
    ).encode()
    # Build to a temp path and os.replace() it into position. Writing the
    # output JAR in place TRUNCATES AND REWRITES a file the Doctor may have
    # open and be actively reading: a rebuild launched while someone is
    # flashing would corrupt that flash silently, with no error on either
    # side. Near-miss on 2026-08-18 — a 600021 build landed 63 seconds after a
    # 600020 flash finished reading the same path. A rename swaps the
    # directory entry only, so an in-flight flash keeps its original inode and
    # completes from intact bytes.
    tmp_jar = out_jar + ".tmp"
    log(f"repacking JAR -> {out_jar} (via {os.path.basename(tmp_jar)})")
    with zipfile.ZipFile(src_jar) as zin, \
         zipfile.ZipFile(tmp_jar, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            n = item.filename
            up = n.upper()
            if n == WEBOS_TAR_ENTRY:
                continue
            if up.startswith("META-INF/") and (up.endswith(".SF") or up.endswith(".RSA") or up.endswith(".DSA")):
                log(f"  drop signature {n}")
                continue
            if n == "META-INF/MANIFEST.MF":
                zi = zipfile.ZipInfo("META-INF/MANIFEST.MF", date_time=item.date_time)
                zi.compress_type = zipfile.ZIP_DEFLATED
                zi.external_attr = item.external_attr
                zout.writestr(zi, manifest)
                log("  rewrote MANIFEST.MF (unsigned, Main-Class only)")
                continue
            data = zin.read(n)
            if n == FLASHER_CLASS:
                data, off, idx = patch_flasher_bytes(data)
                log(f"  patched FlasherThread.class (checkToFlash off @ {off})")
            elif branding and n == CONFIG_ENTRY:
                data, hit = rewrite_kv_lines(data, branding["config"])
                missing = set(branding["config"]) - hit
                if missing:
                    sys.exit(f"[ce-harness] FATAL: {CONFIG_ENTRY} has no "
                             f"{sorted(missing)} line(s) — the OEM config moved")
                log(f"  branded {n}: " + ", ".join(
                    f"{k}={v}" for k, v in sorted(branding["config"].items())))
            elif branding and n in MESSAGE_OVERRIDES:
                data, hit = rewrite_kv_lines(data, MESSAGE_OVERRIDES[n], escape=True)
                missing = set(MESSAGE_OVERRIDES[n]) - hit
                if missing:
                    sys.exit(f"[ce-harness] FATAL: {n} has no {sorted(missing)} "
                             f"key(s) — the OEM bundle moved")
                log(f"  branded {n} ({len(hit)} strings)")
            elif branding and n == CARDCTL_CLASS:
                data = patch_class_utf8(data, TITLE_OLD, TITLE_NEW)
                log(f"  patched CardController.class title "
                    f"({TITLE_OLD.decode().strip()!r} -> {TITLE_NEW.decode().strip()!r})")
            zi = zipfile.ZipInfo(n, date_time=item.date_time)
            zi.compress_type = zipfile.ZIP_DEFLATED if not n.endswith("/") else zipfile.ZIP_STORED
            zi.external_attr = item.external_attr
            zout.writestr(zi, data)
        # add the rebuilt webOS.tar (stored: it's already-compressed content)
        zi = zipfile.ZipInfo(WEBOS_TAR_ENTRY, date_time=(2011, 12, 21, 11, 45, 0))
        zi.compress_type = zipfile.ZIP_STORED
        with open(new_webos_tar, "rb") as f:
            zout.writestr(zi, f.read())
        log(f"  added {WEBOS_TAR_ENTRY} ({os.path.getsize(new_webos_tar)} bytes, stored)")
    os.replace(tmp_jar, out_jar)   # atomic; see the comment above
    log(f"  moved into place: {out_jar}")


# ---- build orchestrator -----------------------------------------------------

def cmd_build(args):
    t0 = time.time()
    work = args.work
    os.makedirs(work, exist_ok=True)
    webos_dir = os.path.join(work, "webos")
    base_rootfs = os.path.join(webos_dir, os.path.basename(ROOTFS_MEMBER))

    if args.reextract or not os.path.exists(base_rootfs):
        cmd_extract(args.jar, work)
    else:
        log(f"reusing extracted rootfs: {base_rootfs}")

    adds, removes, symlinks, cfg = load_overlay(args.overlay)
    ce_pkg = cfg.get("ce_package", "org.webosarchive.ce-files")
    log(f"overlay: {len(adds)} add/replace, {len(removes)} remove, {len(symlinks)} symlink"
        + (f" (from {args.overlay})" if args.overlay else " (none)"))

    new_rootfs = os.path.join(webos_dir, "rootfs.ce.tar.gz")
    if adds or removes or symlinks:
        present, md5sums_files, present_dirs = read_base_metadata(base_rootfs)
        rewrites, new_members, ce_entries = plan_md5_updates(
            adds, removes, present, md5sums_files, ce_pkg)
        log(f"md5 regen: {len(rewrites)} .md5sums files updated, "
            f"{len(ce_entries)} new files attributed to {ce_pkg}")
        drop_dirs = compute_emptied_dirs(present, present_dirs, removes, adds, symlinks)
        if drop_dirs:
            log(f"emptied-dir cleanup: dropping {len(drop_dirs)} directory members")
        rewrite_rootfs(base_rootfs, new_rootfs, adds, removes, rewrites, new_members,
                       symlinks, drop_dirs)
    else:
        log("no overlay changes: rootfs passes through unchanged")
        # still round-trip so the output is produced by the same path
        rewrite_rootfs(base_rootfs, new_rootfs, {}, [], {}, {}, {})

    status = cmd_integcheck(new_rootfs, quiet=False)
    if status != 0 and not args.allow_integcheck_fail:
        raise SystemExit(f"ERROR: integcheck failed (code {status}); aborting. "
                         "Fix the overlay/md5 attribution or pass --allow-integcheck-fail.")

    # rebuild webOS.tar substituting the new rootfs for the cached base's copy
    # (via override, not a copy-over) so work/webos/ -- the cached pristine
    # extraction -- is never mutated by a build. A prior version of this
    # function copied new_rootfs over base_rootfs here, which meant a second
    # build reusing the cache (the documented, intended workflow) silently
    # applied its overlay on top of the PREVIOUS build's output instead of the
    # pristine OEM rootfs. bake.py worked around this by force-re-extracting
    # before every run; --reextract is no longer required for correctness.
    webos_tar = os.path.join(work, "webOS.ce.tar")
    overrides = load_webos_overrides(args.overlay, webos_dir)
    for name in overrides:
        log(f"webOS.tar member replaced from the overlay: {name}")
    overrides[os.path.basename(ROOTFS_MEMBER)] = new_rootfs
    rebuild_webos_tar(webos_dir, webos_tar, overrides=overrides)
    branding = ce_branding(args.overlay)
    if branding:
        log(f"branding the installer wrapper as {branding['version']} "
            f"(build {branding['config']['RomBuildNumber']})")
    else:
        log("no etc/palm-build-info in the overlay — OEM installer strings kept")
    rebuild_jar(args.jar, args.out, webos_tar, branding)

    log(f"DONE in {time.time()-t0:.0f}s -> {args.out} "
        f"({os.path.getsize(args.out)} bytes)")


# ---- CLI --------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="webOS CE Doctor Phase 0 repack harness")
    sub = ap.add_subparsers(dest="cmd", required=True)

    pe = sub.add_parser("extract", help="unpack JAR -> work/webos/")
    pe.add_argument("--jar", required=True)
    pe.add_argument("--work", required=True)

    pi = sub.add_parser("integcheck", help="faithful integcheck ipkg dry-run over a rootfs tar.gz")
    pi.add_argument("rootfs_tar")
    pi.add_argument("-q", "--quiet", action="store_true")

    pp = sub.add_parser("patch-flasher", help="patch/verify FlasherThread.class")
    pp.add_argument("class_path")
    pp.add_argument("--write", action="store_true")

    pb = sub.add_parser("build", help="full pipeline -> CE Doctor JAR")
    pb.add_argument("--jar", required=True, help="OEM Doctor JAR (repack base)")
    pb.add_argument("--out", required=True, help="output CE Doctor JAR")
    pb.add_argument("--work", required=True, help="work directory")
    pb.add_argument("--overlay", help="overlay dir (rootfs/ + changes.json)")
    pb.add_argument("--reextract", action="store_true")
    pb.add_argument("--allow-integcheck-fail", action="store_true")

    args = ap.parse_args()
    if args.cmd == "extract":
        cmd_extract(args.jar, args.work)
    elif args.cmd == "integcheck":
        sys.exit(cmd_integcheck(args.rootfs_tar, quiet=args.quiet))
    elif args.cmd == "patch-flasher":
        cmd_patch_flasher(args.class_path, write=args.write)
    elif args.cmd == "build":
        cmd_build(args)


if __name__ == "__main__":
    main()
