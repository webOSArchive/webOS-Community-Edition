# Emoji and auto-correct: notes for Lunacy

webOS CE did two pieces of keyboard and text work on 2026-11-04 for CE 3.2.0. Both target the
TouchPad's own text stack. This page says what each does, what Lunacy can reuse, and what it
doesn't need. Lunacy facts come from reading its source on 2026-11-04 (Lunacy `35e73e2`).

**Short version: Lunacy has nothing it must pull.**

- **Emoji:** Chromium and Android already render colour emoji and the Android keyboard types
  them. Every CE emoji fix works around a TouchPad limit that Lunacy doesn't have. The only
  useful item for Lunacy is a short check list.
- **Auto-correct:** Lunacy uses Android's spell checking and has no `com.palm.smartKey`
  service. CE's engine is there if Lunacy ever needs that service. Nothing calls it today.

Repos:
[webOS Community Edition](https://github.com/webOSArchive/webOS-Community-Edition) (this repo) and
[LunaCE](https://github.com/webOSArchive/LunaCE).

## 1. Emoji

### What CE did, and why none of it applies to Lunacy

| CE piece | TouchPad problem it solves | Lunacy |
|---|---|---|
| A fifth WebKit fallback font, `CE-Emoji.ttf` (Noto Emoji, monochrome), loaded by a code cave in `libWebKitLuna.so` | WebKit 534's four fallback fonts are hard-coded CJK fonts; nothing covers emoji | Chromium uses Android's colour emoji font |
| A second cave in `WebCore::GlyphPage::fill` | The Palm port returned no glyph for any character above U+FFFF, so 😀 drew as a box. The fix uses each pair's trail surrogate as the glyph, and the font maps trail surrogates to emoji | Not an issue in Chromium |
| LunaCE `QtEmojiFallback.cpp`: a vtable-slot wrapper | HP's Qt plugin hard-codes the system UI's fallback fonts, so banners and card titles showed boxes | Lunacy's shell is Android views and `Paint`, which fall back to the system emoji font |
| LunaCE `WebPage::commitText`: astral text goes through the composition path | `insertStringAsKeyEvents` silently dropped anything above U+FFFF | Text comes from the Android keyboard |
| An emoji key on LunaCE's keyboard (OpenMoji images), replacing the language key | The TouchPad keyboard had no emoji input | The Android keyboard has its own |

All of it is monochrome on the TouchPad. Colour is impossible there; Lunacy already has colour.

Details: [Docs/EMOJI-FONT.md](https://github.com/webOSArchive/webOS-Community-Edition/blob/main/Docs/EMOJI-FONT.md)
§8–§9, and LunaCE commits `edc7408`, `1319c8b` and `67433cc`.

### Worth checking in Lunacy (not known problems)

1. **An emoji round trip through Lunacy's own code.** Send 😀 👍🏽 🇨🇦 👨‍👩‍👧 and a ❤️
   (with its U+FE0F selector) through Messaging and Memos and back. That covers the bus,
   db8 and a JS service, and checks nothing splits a surrogate pair or drops U+FE0F along the way.
   - On the TouchPad, Node 0.4 turned every astral character into U+FFFD.
   - Lunacy runs Node 12, so that particular bug shouldn't apply. Lunacy's own Kotlin bridges
     haven't been checked.
2. **The shell's Prelude text.** A banner or card title containing an emoji should still
   fall back to the system emoji font when drawn with a `Typeface` from an asset.
3. **Messaging's own emoji images.** CE's Messaging swaps emoji for EmojiOne PNGs (`emojify()`
   in `utilities/utils.js`), and Lunacy runs that app.
   - CE has picked **OpenMoji** as its one art set and plans to replace Messaging's EmojiOne
     later. That isn't done yet.
   - Lunacy could keep EmojiOne, follow CE to OpenMoji when CE ships it, or skip the swap and
     let Chromium draw native emoji. That's a look-and-feel decision, not a bug.

### Credit, if Lunacy mentions emoji

The work was inspired by achunt2143's
[webOS-Emoji](https://github.com/achunt2143/webOS-Emoji); no code was taken. The font is
Google's Noto Emoji (SIL OFL 1.1). The key images are OpenMoji (CC BY-SA 4.0).

## 2. Auto-correct (SmartKey)

### What CE built

A replacement for the TouchPad's `SmartKeyService` (`com.palm.smartKey`), which ran Nuance
XT9 from 2011. It's on CE `main` (merge `c08ceec`) in
[packages/smartkey](https://github.com/webOSArchive/webOS-Community-Edition/tree/main/packages/smartkey).
It isn't in a CE image yet: the dictionaries are 23 MB and need a smaller format first.

- **The service shell:** openwebos `smartkey-hun` (Apache-2.0), with all 17 methods of the
  stock API (`search`, `learn`, `processTaps`, user words, auto-replace, and so on).
- **The engine** (`engine/`, C++98, no dependencies):
  - a memory-mapped trie of word frequencies from Android's LatinIME word lists (Apache-2.0);
  - a weighted edit distance where neighbouring keys, a missed double letter or a missing
    apostrophe or accent cost less;
  - auto-accept only when one candidate clearly wins;
  - Hunspell only to answer "is this a real word".
- **Results on English** (`tools/eval.py`), against Hunspell-first, which is what plain
  `smartkey-hun` does:

  | | New | Hunspell-first |
  |---|---|---|
  | Touch typos fixed / turned into a different wrong word | 80% / 4% | 74% / 22% |
  | Correct words "fixed" anyway | 0.7% | 6.9% |

- **On a TouchPad** it beat XT9 on its worst habits, such as `Preware`→`Predate` and
  `jonwise`→`outside`, and the user found it good in use.

### For Lunacy

Nothing to pull today. Lunacy uses Android's spell checking. `Docs/architecture.md` notes that
the contacts linker's Just Type smartkey plugin is left out. Nothing Lunacy runs calls
`com.palm.smartKey`.

On the TouchPad the callers were:
- WebKit's in-field auto-correct (`search`): replaced by Android;
- LunaSysMgr's keyboard: replaced by Android;
- the **Text Assist** preferences app, `com.palm.app.textassist`, which manages user words
  and shortcuts.

If Lunacy ever bundles Text Assist or Just Type, it needs a `com.palm.smartKey` on its bus.
The simplest route is a Kotlin service over Android's spell checker plus a small user-word
store, using the reply shapes measured on the device:
- a misspelled word's `guesses` start with the typed word (`"sp": false`), then the
  auto-accepted correction;
- `i`→`I` and `im`→`I'm` come back as `spelledCorrectly: true` with `auto-replace`.

These are in `packages/smartkey/patches/smartkey-hun-ce.patch`
(`SmkyHunspellDatabase::correct`). CE's C++ engine would only be worth porting if Lunacy
wanted webOS-specific correction behaviour rather than Android's.
