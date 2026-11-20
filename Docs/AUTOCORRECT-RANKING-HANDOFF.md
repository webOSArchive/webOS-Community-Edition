# Auto-correct ranking: hand-off for CE's SmartKey engine

Written 2026-11-20. For whoever takes up the ranking in `packages/smartkey` (CE's
auto-correct engine, `SmartKeyService`).

**What this is and is not.** The user typed "trest" on the HP 10 G2, which runs Lunacy's
keyboard, expected "treat" and got "rest"; and saw the space bar hang for seconds there.
I read Lunacy's `LunaKeyboard/Corrector.kt` and CE's engine, and tried a change to CE's
engine in a scratch copy. **Nothing was changed in LunaKeyboard, and nothing is changed in
this repo's engine**: Lunacy's working tree is clean, and the patch below is a proposal with
measurements, not a commit. Lunacy is not edited from this project.

## 1. The symptom in CE's engine

CE's engine ranks the same way round, but does not act on it:

| Typed | CE today (best first: cost, AOSP frequency, score) | Result |
|---|---|---|
| trest | rest (0.55, 145, 3.6), test (0.55, 135, 2.9), treat (0.60, 120, 1.5) | not auto-accepted (the margin is under 1.5), so the word stays; "rest" leads the bubble |

Two things make the shorter word win (`engine/SkCorrector.cpp`, `Params::Params()`):

1. **An extra tap next to a neighbour costs less than a slip onto a neighbour**:
   `insNear` 0.55 against `subNear` 0.60. So "one letter too many" beats "one letter wrong"
   whenever the shorter word is as common, and shorter words usually are more common.
2. **The first letter is only protected against substitution.** `firstLetter` (0.3) is added
   when the word's first letter differs from the typed one, but not when the typed first
   letter is treated as an extra tap (trest → rest), nor when the word has a first letter
   that was never typed. People rarely get the first letter wrong.

Score is `freq/16 - cost * costWeight` with `costWeight` 10, so 0.05 of cost is half a
point and 25 points of frequency are 1.6: frequency settles every near tie.

## 2. Proposed change (tried in a scratch copy only)

- Charge `firstLetter` for dropping the first typed letter and for a missed first letter.
- Raise `insNear` from 0.55 to 0.70, so an extra tap is not cheaper than a slip.
- **Needed with the first one:** keep a path alive in the trie walk when a swap of the
  first two letters can still complete. Without it "hte" stops reaching "the": the first
  row of "t…" now exceeds the 3-letter bound (1.0) and is pruned before the swap is seen.
  I hit this in the first version of the change.

```diff
--- a/packages/smartkey/engine/SkCorrector.cpp
+++ b/packages/smartkey/engine/SkCorrector.cpp
@@ -95,7 +95,7 @@
         // the word has c, the typed word doesn't: a missed tap
         float del = isApostrophe(c) ? p.delApostrophe
                   : (d > 0 && w.wch[d] == c) ? p.delDouble : p.delFar;
-        cur[0] = prev[0] + del;
+        cur[0] = prev[0] + del + ((dd == 1 && !isApostrophe(c)) ? p.firstLetter : 0.0f);
         float rowMin = cur[0];
         for (int j = 1; j <= n; ++j) {
             const cp_t s = w.in[j - 1];
@@ -111,6 +111,9 @@
                 v = std::min(v, pp[j - 2] + p.transpose);
             cur[j] = v;
             if (v < rowMin) rowMin = v;
+            // a swap that the next letter of the word can still complete keeps this path alive
+            if (j < n && w.in[j] == c && s != c && prev[j - 1] + p.transpose < rowMin)
+                rowMin = prev[j - 1] + p.transpose;
         }
         if (ch.freq && !(ch.flags & FLAG_NEVER) && cur[n] <= w.maxCost) {
             Candidate cd;
@@ -194,6 +197,7 @@
         bool near = (j > 1 && (low[j - 2] == s || m_kb.adjacent(low[j - 2], s))) ||
                     (j < w.n && (low[j] == s || m_kb.adjacent(low[j], s)));
         w.insCost[j] = isApostrophe(s) ? m_p.insApostrophe : near ? m_p.insNear : m_p.insFar;
+        if (j == 1 && !isApostrophe(s)) w.insCost[j] += m_p.firstLetter;
     }
     float* r0 = w.row(0);
     r0[0] = 0.0f;
```

plus `insNear(0.7f)` in `Params::Params()`.

### What it did, on 40 words

Run with a small harness (no Hunspell callback, `en.skd` from `prebuilt/`). `!` means
auto-accepted.

| Typed | Today | With the change |
|---|---|---|
| trest | rest | treat (not auto: "test" is 0.1 behind) |
| treay | treat | treat! |
| yhe | he | the! |
| sthe | the! | the (no longer auto: "she" is close) |
| hte | the! | the! (he! without the pruning fix) |

Unchanged, all still auto-accepted where they were: teh, thw, wprld, tomorow, dont, im, rhe,
becuase, ttest, xthe, omorrow, wwhat, aand, coudl, thier, recieve, definately, pleasse,
freind, woudl, abotu, adn, taht, grest. Unchanged and not auto: helo (help), ecause
(because), wierd (wired), waht (what). Valid words stayed valid. The longest inputs I tried
took 4 to 6 ms on the build machine, as before.

"trest" still does not become "treat" by itself: it is a real three-way tie, and leaving
the word alone is defensible. What changes is which word the bubble offers first.

### Not done, and needed before this is committed

- **`tools/eval.py` was not run.** It needs `skcli`, which needs Hunspell's headers
  (`hunspell.hxx`), and this machine has none; it also needs the AOSP word list and the
  Wikipedia misspelling list, which are not in the repo. Forty hand-picked words are not an
  evaluation. The numbers that tuned the current parameters came from that tool: rerun it,
  and compare fixed / wrong / kept / damaged before and after.
- Only English was looked at. `qwertz` and `azerty` share the code path.
- A rebuild goes through `packages/smartkey/build.sh`, the result is copied into
  `prebuilt/`, and it reaches a device only with a bake, which needs the user's word.
- Nothing here was tried on a TouchPad.
- Do not add a suggestion bar. The engine stays behind `com.palm.smartKey`.

## 3. What I found in Lunacy's keyboard (for the Lunacy project; not changed)

`LunaKeyboard/src/main/java/org/webosarchive/keyboard/Corrector.kt`, read at `9ceea93`.

**"trest" → "rest".** A candidate's score is its log2 frequency minus `COST_WEIGHT` (4)
times its edit cost, and `correct()` takes the best one with no margin over the runner-up.
An extra letter beside a neighbour costs 0.7, a neighbouring key 0.6. So: rest 17 - 2.8 =
14.2, test 16 - 2.8 = 13.2, treat 15 - 2.4 = 12.6. Two points of frequency outweigh the
cheaper edit. CE leaves this word alone because of `autoMargin`; Lunacy has no such rule,
which is why it replaced the word. In order of effect:

1. Do not auto-correct when the runner-up is close (CE: best must lead by 1.5 points on a
   scale where one unit of cost is 10).
2. Charge more for an edit that touches the first letter.
3. Do not make an extra letter cheaper than, or as cheap as, a neighbouring key.

**The space bar hanging on the HP 10 G2.** When no word is one slip away and the typed
word has five letters or more, `nearest()` runs `edits()` again on every one-slip spelling,
into a `HashMap`. For a ten-letter word that is some hundreds of spellings, each producing
a few hundred more: on the order of a hundred thousand strings built and hashed, on
Android 5. **I did not profile it**; this is from reading the code, and whether it runs on
the UI thread I did not check. It only happens for words the dictionary has nothing near,
which fits "sometimes, for seconds". CE's engine does not have this cost: it walks the
dictionary trie once with a bounded edit-distance row per node, and never builds a
spelling that is not a prefix of a real word. That is the design to copy, or else: cap the
second pass, and take it off the UI thread.
