# Emoji in webOS CE: a fifth fallback font

**Target: CE 3.2.0.** This is the plan, and the recipe for building it. Nothing
here is baked yet. One part is proven on hardware: an emoji font in a WebKit
fallback slot renders every emoji the renderer can address. See §2.

## 1. What is possible, and what is not

webOS 3.0.5 web content goes through WebKit 534.6 (2010), which renders with
Palm's closed **`libPiranha`**. It does not use fontconfig. Three limits come from
that stack and none of them can be fixed:

| Limit | Evidence | Consequence |
|---|---|---|
| The text path is 16-bit | `PSoftContext2D::DrawText(unsigned short*, …)`, `PFTFont::Exists(unsigned short)`, `PFTFontContext::GetFallback(unsigned short)` | Emoji above U+FFFF (😀 👍 and every ZWJ sequence, roughly 3,600 of them) draw as two half-width boxes, one per surrogate |
| Glyphs are monochrome masks | `PFTCache<PSoftPixmap>::LoadMask`. There is no colour path, FreeType is 2.3.x-era, and there are no CBDT/sbix/COLR tables | Colour emoji are impossible |
| No usable webfonts | No `CachedFont`, `RemoteFontFace` or `FontCustomPlatformData` symbols. An `@font-face` test failed on hardware | A CSS font-stack fix is not available |

What *is* possible: the **170 emoji that sit inside the 16-bit range**, such as
☀ ☕ ✅ ❤ ⚡ ✈ ⭐ ☺. Of those, 60 display as emoji by default. They show as clean
monochrome glyphs, inline and at text size, in every web view.

This also fixes a visible bug in stock CE today. Modern phones send symbols
followed by the emoji variation selector U+FE0F. No device font has that
character, so ❤️ currently draws as "▯▯". The new font maps FE0F, FE0E and ZWJ
(U+200D) to empty glyphs.

Colour and astral emoji stay with the existing per-app approach: CE's Messaging
app swaps emoji for bundled EmojiOne PNGs (`utilities/utils.js`, `images/emoji/`).
That approach is unaffected by this work.

## 2. How fallback works, and the proof

`PGFallbackFonts::init()` in `libWebKitLuna.so` loads **four hard-coded fallback
fonts**, in this order. Any character missing from the primary font tries them in
turn:

```
HeiS_nb.ttf  →  HeiT_nb.ttf  →  Heisei_Kaku_Gothic_nb.ttf  →  Dotum_nb.ttf
(each from the font dir in PalmBrowserSettings, i.e. /usr/share/fonts/)
```

- There is one override range, U+3001–3002 (CJK punctuation).
- Each font is stored at `this+4+4*count`. The count only goes up when a load
  succeeds.
- The range count sits at `this+36`, so **the object has room for eight fonts and
  init fills four**.

**Hardware test (2026-10-04, TouchPad, CE 3.1.0).** A Noto Emoji subset was
bind-mounted over `Dotum_nb.ttf`, then `stop/start browserserver`. All 170
emoji rendered in the Browser, and the FE0F boxes disappeared. The test was
reverted afterwards: unmounted, and Dotum's md5 `868d6d98…` checked.

That test **replaced Korean**, so it is only proof that the glyphs reach the
screen. All four CJK slots are needed: Simplified Chinese, Traditional Chinese,
Japanese and Korean. **The shipped version must add a fifth slot.**

### Rejected alternatives

- **Merging the glyphs into Dotum (or another slot font).** This would be the
  simplest technically. But Noto Emoji is OFL, and the OFL requires a modified
  font to stay OFL; HP's Dotum isn't ours to relicense or alter. Glyphs under a
  merge-permitting licence (DejaVu's Vera licence) would still mean modifying
  Dotum, and DejaVu only covers 105 of the 170 in a text style.
- **Renaming a slot** (patching `"Dotum_nb.ttf"` to point at our font). Every slot
  is a needed CJK font.
- **CSS `@font-face` or a font-family stack.** Webfonts are not compiled in; see
  §1.

## 3. The font: `CE-Emoji.ttf`

Source: Google's Noto Emoji, monochrome. It is SIL OFL 1.1 with no Reserved Font
Name, published as a variable font at
`https://raw.githubusercontent.com/google/fonts/main/ofl/notoemoji/NotoEmoji%5Bwght%5D.ttf`.
FreeType 2.3 cannot read variable fonts, so the build pins the weight and
subsets the font:

```js
// build/full-ce/emoji-font/make-font.js   (node; npm i subset-font)
const subset = require('subset-font'), fs = require('fs');
const cps = [];
for (let u = 0x80; u <= 0xFFFF; u++) {            // the BMP emoji set (170 at Unicode 15/16)
  if (u >= 0xD800 && u <= 0xDFFF) continue;
  if (/\p{Emoji}/u.test(String.fromCharCode(u))) cps.push(u);
}
const text = cps.map(u => String.fromCharCode(u)).join('') + '️︎‍';
subset(fs.readFileSync('NotoEmoji[wght].ttf'), text,
       {targetFormat: 'truetype', variationAxes: {wght: 400}})
  .then(buf => fs.writeFileSync('CE-Emoji.ttf', buf));
```

Checks the bake must enforce:

- Result about 58 KB, 175 glyphs, `glyf`/`loca` outlines.
- **No `fvar`/`gvar`**: a variable font loads as garbage or not at all.
- cmap (3,1) format 4 present.
- All 170 code points mapped, plus FE0F/FE0E/200D mapped to glyphs with zero
  advance.

Ship `OFL.txt` beside it as `/usr/share/fonts/CE-Emoji-OFL.txt`. Commit the
source VF and `OFL.txt` under `build/full-ce/emoji-font/`, so the bake is
offline and reproducible, as with every other input.

Glyphs Prelude already has (© ® ™ ‼) keep Prelude's text style. Some symbols in
HeiS (♠ ♣ ♥ ♦ ☎ ♨ and the arrows) keep HeiS's style, because the new slot comes
last.

## 4. The patch: a fifth `createFromFile` in `PGFallbackFonts::init`

A code-cave patch to `/usr/lib/libWebKitLuna.so`. This binary is already
byte-patched twice by the bake (the version prefix in tier 19b, and the Synergy
webm MIME patch), so this is a third patch in the same tier style: locate by
symbol, assert exact bytes, refuse on any mismatch.

**Where (CE 3.1.0 binary, md5 `0a44935b…`; locate by symbol, never by fixed
address):**

| What | Value |
|---|---|
| `PGFallbackFonts::init()` | `nm -D` → `0x5bedf4` |
| Insertion point | `init+0x28c` = `0x5bf080`, `bl PGContext::create@plt` (`0xebeb2237`). At this point all four slots are loaded and `r7 = this`, `r9 = the per-font flag` are live |
| Cave | file offset `0x89ac30`: the end of the R+X `PT_LOAD`. There are **976 zero bytes** before the RW segment at `0x89b000`. `.eh_frame` ends exactly there |

**Edits:**

1. Grow `PT_LOAD[1]` `p_filesz` and `p_memsz` by the cave size, rounded to 4.
   Section headers stay as they are.
2. Write the cave at `0x89ac30`:
   ```asm
   cave:   push  {r4, lr}
           adr   r0, path                 @ "/usr/share/fonts/CE-Emoji.ttf"
           mov   r1, #12                  @ same args the four stock loads pass
           mov   r2, #0
           bl    PGFont::createFromFile@plt
           cmp   r0, #0
           beq   1f
           strb  r9, [r0, #52]            @ the flag init sets on every loaded font
           ldr   r1, [r7]                 @ count
           add   r2, r7, r1, lsl #2
           str   r0, [r2, #4]             @ fonts[count]
           add   r1, r1, #1
           str   r1, [r7]                 @ count++
   1:      pop   {r4, lr}
           b     PGContext::create@plt    @ the instruction we displaced
   path:   .asciz "/usr/share/fonts/CE-Emoji.ttf"
   ```
3. Replace the word at `0x5bf080` with `bl cave`.

**Why it is safe to fail:**

- If the font file is missing, `createFromFile` returns NULL and nothing changes.
  That gives a kill switch (delete the font) and makes the patch inert on any
  image without the file.
- The count can reach at most 5, against capacity 8.

**Bake assertions** (in the style of `patch_version_prefix`):

- The `init` symbol resolves.
- The word at `init+0x28c` is a `bl` whose target is `PGContext::create@plt`.
- The cave region is all zero.
- `PT_LOAD[1]` ends at the cave.
- The patched file passes `arm-linux-gnueabi-objdump` with the cave decoding as
  above.

### On-device test before baking (no rootfs writes)

Build a **bench variant** of the patched lib whose cave path is
`/tmp/CE-Emoji.ttf`, the same length as the real path or shorter. Then nothing on
`/` is written, and a bind mount needs no new file there:

```sh
novacom put file:///tmp/libWebKitLuna.so < bench/libWebKitLuna.so
novacom put file:///tmp/CE-Emoji.ttf     < CE-Emoji.ttf
# on the device:
mount --bind /tmp/libWebKitLuna.so /usr/lib/libWebKitLuna.so
stop browserserver; start browserserver      # Browser picks it up
killall -HUP LunaSysMgr                       # WebAppMgr (Enyo/Mojo apps) loads it at Luna start
```

Recovery from a crashing patch: `umount` both, then restart the browserserver or
Luna, or reboot.

Pass criteria:

- The §2 test page shows all 170 emoji.
- Korean (한국어), Japanese (漢字・かな), Simplified and Traditional Chinese
  still render from their own fonts: **five slots, not a replacement**.
- U+3001/3002 punctuation is unchanged.
- The Browser, an Enyo app and a Mojo app all render emoji.
- No BrowserServer or WebAppMgr crash over a reboot and a Luna restart.

## 5. Not covered by this patch: the system UI

LunaSysMgr's own UI renders with **Qt 4.8 for embedded Linux (QWS)**, not WebKit:
notification banners, card titles, the status bar and the virtual keyboard. Qt's
font database scans `/usr/share/fonts`, so dropping `CE-Emoji.ttf` there *may*
give Qt per-glyph fallback for free. **Untested.** Test it after §4 lands, by
sending a notification whose text contains ☀ and ❤️.

If Qt doesn't pick it up, that fix belongs in LunaCE, whose source we have, not
in this patch.

## 6. Bake and release wiring

- **Tier**: a new emoji tier next to 19b, which already handles
  `libWebKitLuna`.
  1. Build `CE-Emoji.ttf` from the committed source VF.
  2. Write it to `usr/share/fonts/CE-Emoji.ttf` (0644), with the OFL text beside
     it.
  3. Apply the §4 patch to the overlay's `libWebKitLuna.so`. 19b's output is the
     input, so order the tiers.
- **Size**: about 60 KB of rootfs; the root has 119 MB free.
- **`ce-test-full.sh`**:
  - the font exists and is the right md5;
  - the patched lib's md5 is in the allow-list;
  - the cave bytes are present at the cave offset.
  - Rendering stays a manual check (TEST-PLAN).
- **OTA**: both files are ordinary rootfs content, so they ride the 3.1.0 → 3.2.0
  diff (`OTA-PLAN.md` §2.1). `libWebKitLuna` is held open by BrowserServer and
  WebAppMgr, which is fine on the armed-flash path: the ramdisk writes while
  nothing runs.
- **RELEASE-NOTES**: "170 symbol emoji (☀ ☕ ✅ ❤ …) now display, and the stray
  box after emoji sent from modern phones is gone. Colour emoji and most face and
  people emoji (U+1F000 and up) remain unsupported outside Messaging."
