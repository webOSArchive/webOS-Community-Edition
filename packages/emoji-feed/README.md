# Emoji for webOS (feed ipk)

`org.webosarchive.emoji` is a standalone package. It's the rendering half of CE 3.2.0's
emoji work, for stock webOS 3.0.5 (TouchPad, TouchPad Go) and webOS CE 3.1.0.

The emoji keyboard isn't in it. That's part of CE 3.2.0's LunaSysMgr.

Build: `scripts/emoji-feed.sh` → `build/work/ipk/org.webosarchive.emoji_<VERSION>_armv7.ipk`.

## What it installs

- **`/usr/share/fonts/CE-Emoji.ttf`:** the same font the CE bake ships
  (`build/full-ce/emoji-font/make-font.py`).
- **The `libWebKitLuna.so` patch:** the same as the bake's
  (`webkit_fallback_patch.py`), shipped as four byte sites, each with its original
  and patched bytes.
  - The postinst patches only if every site holds the original bytes.
  - It patches a copy, checks every site, and renames the copy into place.
  - Running processes keep the old file until the restart Preware asks for.

The postinst records what it changed, and the prerm undoes only that. On a CE 3.2.0
image, where both are built in, installing changes nothing and removing leaves them
alone. On any other library the install fails with a message and changes nothing.

## Checked

Host simulation under busybox `sh`, with the real libraries:
- **stock 3.0.5:** patches; removal restores the exact original;
- **CE 3.1.0:** patches to exactly the library verified on a TouchPad (md5 `9c3a2e3e`);
  removal restores it;
- **CE 3.2.0 image:** no-op both ways;
- **3.0.4:** refused.

On a webOS CE 3.1.0 TouchPad (2026-11-04), going through ipkgservice's own
commands (`ipkg -o /media/cryptofs/apps install`, then the postinst; prerm, then
`ipkg remove`):
- install patched to `9c3a2e3e`; after the restart, emoji rendered in the Browser
  and CJK was unchanged;
- removal restored `0a44935b` exactly and removed the font and the state file;
- reinstalled after.

The stock 3.0.5 library differs from CE's only in strings: the build script asserts that
every site holds the same original bytes. But the patched stock library hasn't run on
hardware yet. The TouchPad Go's library isn't on hand; if it differs at any site, the
install refuses rather than patching.
