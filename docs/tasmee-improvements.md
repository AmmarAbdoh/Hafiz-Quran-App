# Improving تسميع accuracy, speed and confidence

Companion to [tasmee-investigation.md](./tasmee-investigation.md), which
records how we got here. This one records where there is still to go.

## Context

تسميع now runs on `Quran-Lab/zipformer_p-arabic-v3.1`, a streaming CTC phoneme
recogniser, entirely in the browser. It replaced Whisper, which was measured at
27–73% word error against this model's 3.08% phoneme error on the same 32
fixtures, and it follows a recitation word by word while the reciter is still
speaking.

It works. It is not yet as good as it can be, and the gap to Tarteel is now
data and decoding, not architecture. This plan records every improvement
available to us, in priority order, so none of it is lost.

### Measured baseline

`node scripts/tasmee/evaluate.mjs --runner zipformer`, 32 fixtures:

```
FALSE ACCEPTS  1/12  (8.3%)   <- the number that decides it
false rejects  0/20  (0.0%)
overall        31/32 correct
by kind: as-recited 18/18, stopped-early 3/3, skipped-middle 3/3,
         wrong-ending 2/3, wrong-verse 3/3, hesitation 2/2
```

This says precisely where the headroom is. **False rejects are already zero** —
it never accuses a correct reciter. The single failure is a _false accept_: in
`wrong-ending-112_1` the model correctly heard `ءَمَدڇ` where the verse has
`ءَحَدڇ`, but one wrong unit in a ten-unit verse is 10%, under the 18%
threshold. The verdict is lost in the arithmetic, not in the recognition.

Two facts shape everything below:

1. **We decode freely and then compare.** `ctcGreedy.ts` takes the argmax of a
   251-way distribution per frame and throws the rest away. We then compare the
   resulting string to the expected one. We already know what the reciter is
   supposed to say, so this answers a harder question than we need — and the
   comparison is a blunt error _rate_, which is exactly what loses the short
   verse above.
2. **Ten constants were chosen by reasoning, not measurement** — six in
   `phonemeProgress.ts`, four in `speechGate.ts` — and tuned against 32 clips.

---

## Tier 1 — Constrained scoring (the real accuracy win)

Replace "decode, then compare" with "score the audio against what the page
expects", using the CTC forward algorithm over the expected phoneme sequence.

**Why this matters more than tuning:** a free decoder can produce a word that
was never said. A constrained scorer cannot — a word that wasn't recited simply
scores low. It also yields a calibrated per-word probability instead of a
hand-set error count, and exact forced-alignment timings for the cursor.
Quran-Lab's own `decode_with_confidence.py` makes the point: _"the model was
unsure" and "the reciter said something different" look identical in a plain
transcript_ — greedy decoding discards exactly what separates them.

**Design**

- New `src/features/recitation-practice/model/ctcAlign.ts`:
  - Build the CTC state sequence for the page's expected units (blank
    interleaved, `2L+1` states), reusing `SpokenWord.units` from
    `wordPhonemes.ts`.
  - Maintain forward variables `α` in log space, advanced **per frame** and
    persisted across chunks — the same carry-across-chunks discipline
    `ctcGreedy.ts` already uses for `previousId`.
  - Live cursor: the state holding the most mass is where the reciter is. This
    replaces the symbol matching in `phonemeProgress.ts`.
  - Verdict: when a phrase or ayah completes, run forward–backward over its
    span to get a true posterior per word.
- Keep from `phonemeProgress.ts`: the word-boundary model (`locations[]`, the
  merged phonological words) and the **resync** search. Those solve different
  problems and are already tested.
- Do the alignment **inside** `zipformer.worker.ts`, which already holds the
  log-probs; post word-level events out rather than 251 floats per frame.

**Files:** new `model/ctcAlign.ts` (+ test); `workers/zipformer.worker.ts`;
`model/phonemeProgress.ts` (scoring removed, boundaries and resync kept);
`hooks/RecitationPracticeContext.tsx` (consume scores, not symbols).

**Target:** false accepts 0/12 with false rejects still 0/20.

### Built and measured, 2026-10-20 — and it does not yet win

`model/ctcAlign.ts` (Viterbi forced alignment, per-word scores, exact frame
spans) and `scripts/tasmee/runners/zipformer-aligned.mjs` exist and are tested.
Four scoring rules were measured against the 32 fixtures:

| per-word score                                 | false accepts | false rejects |
| ---------------------------------------------- | ------------- | ------------- |
| free decode + edit distance (shipping today)   | **1/12**      | **0/20**      |
| mean probability over the word's frames        | 1/12          | 0/20          |
| weakest phoneme                                | **0/12**      | 8/20          |
| weakest phoneme, scored against its best rival | 0/12          | 8/20          |
| ...with length-collapsed identity classes      | 0/12          | 8/20          |
| second-weakest phoneme                         | 1/12          | 5/20          |

**Nothing beats the baseline.** Catching the last false accept costs five to
eight false rejects, which is the wrong trade: accusing a correct reciter is
the worst thing this feature can do.

The reason is visible in the alignment. CTC is peaky — in
`correct-alafasy-1_2` the word `لعَاالَمِۦۦۦۦن` spans 64 frames of audio but
owns only **8** of them, the rest being blanks. One of those eight going to a
rival drags the whole word to 0.07, in a recitation that is perfectly correct.
And the sets genuinely overlap: a correct Alafasy clip and the `wrong-ending`
clip both have exactly one word of four contradicted. No threshold separates
them.

**Conclusion: Tier 2 is a prerequisite for Tier 1, not a follow-up.** With
twelve mistakes in the set, one failure is 8.3% — the resolution is too coarse
to choose a rule, and every number above is within noise of the others. Build
the fixture set first, then pick the rule from the curve.

### Tier 2 done, and it reversed the conclusion above (2026-10-20)

`scripts/tasmee/build-word-fixtures.mjs` builds **663 clips from 48 ayat and
three reciters**, cutting at exact word boundaries using the per-word
timestamps quran.com returns. 357 correct, 306 mistakes, across six kinds:
words dropped, words swapped in from another ayah, recitations stopped
mid-verse, and - labelled _correct_, because stumbling is not a mistake -
words repeated and long pauses.

On that set, the small curated fixtures turn out to have been badly
flattering:

| rule                                         | false accepts    | false rejects     | overall |
| -------------------------------------------- | ---------------- | ----------------- | ------- |
| free decode + edit distance, on the 32 clips | 1/12 (8%)        | 0/20 (0%)         | 31/32   |
| free decode + edit distance, on the 663      | **68/306 (22%)** | **169/357 (47%)** | 426/663 |
| forced alignment, on the 663                 | 8/306 (2.6%)     | 219/357 (61%)     | 436/663 |

The aligner's _detection_ is excellent - word-dropped 104/111, word-swapped
107/108, stopped-early 87/87. What was wrong was the verdict rule, which
rejected 57% of clean recitations.

`scripts/tasmee/sweep.mjs` scores every clip once, caches it, and then tries
every rule in memory. The curve:

| threshold | weak words tolerated | missed mistakes | wrongly flagged |
| --------- | -------------------- | --------------- | --------------- |
| 0.5       | 0                    | 2.6%            | 61.3%           |
| 0.3       | 0                    | 3.3%            | 51.5%           |
| **0.5**   | **1**                | **27.1%**       | **3.9%**        |
| 0.3       | 1                    | 35.0%           | 2.2%            |
| 0.5       | 2                    | 67.3%           | 0.8%            |

**Chosen operating point: threshold 0.5, tolerating one weak word.** Against
what ships today that is 47.3% -> 3.9% wrongly flagged, for 22.2% -> 27.1%
missed; overall 64.3% -> 85.4%. Being wrongly told you erred is what makes
this feature unusable, so that is the right trade.

**The weakness that remains, stated plainly:** tolerating one weak word
forgives a genuine single-word error as readily as a spurious one, which is
most of the 27%. The jump from 61% to 3.9% wrongly flagged between tolerating
zero and one says that _most clean recitations contain exactly one weak word_ -
a per-word false-positive floor from CTC's peakiness. Beating 27% means
separating a spurious weak word from a real one: a two-tier rule, or scoring
each word against the median of its own clip, rather than a flat threshold.

### Tier 1 adopted, and the score swept too (2026-10-20)

Forced alignment is now what the app judges by, and both the rule and the
score behind it were chosen by measurement rather than reasoning.

**The rule shape is close to exhausted.** `scripts/tasmee/rules.mjs` tried
four families against the 663 clips - counting weak words, a two-tier rule
where one word far below fails outright, scoring each word against its own
clip's median, and a total-shortfall budget. The plain count won. The
hypothesis that a near-zero score means "confidently wrong" is false:
correct recitations produce them too.

**So the bottleneck was the number each word is reduced to.** That had been
"second weakest phoneme", which was a judgement. `scripts/tasmee/aggregate.mjs`
sweeps nine ways of reducing a word, now that the aligner keeps every
phoneme's support and the cache stores it:

| word score                   | missed    | wrongly flagged | overall   |
| ---------------------------- | --------- | --------------- | --------- |
| **lower quartile < 0.2**     | **22.2%** | 4.2%            | **87.5%** |
| mean < 0.7                   | 22.9%     | 4.5%            | 87.0%     |
| 2nd weakest < 0.6            | 24.5%     | 3.9%            | 86.6%     |
| 2nd weakest < 0.5 (previous) | 27.1%     | 3.9%            | 85.4%     |
| mean < 0.8                   | 11.8%     | 8.7%            | 89.9%     |

Adopted the lower quartile at 0.2: it discards the one or two unluckiest
phonemes, which is the CTC peakiness artefact, without discarding a word that
was genuinely wrong. `mean < 0.8` scores higher overall but flags 8.7% of
correct recitations - roughly once per ten-ayah page - and being wrongly
accused is the failure that makes this unusable.

Confirmed on the bench with the rule the app actually applies (one weak word
tolerated per ayah):

```
FALSE ACCEPTS  68/306  (22.2%)
false rejects  15/357  (4.2%)
overall        580/663
by kind: as-recited 132/135, stopped-early 87/87, word-repeated 106/111,
         hesitation 104/111, word-dropped 77/111, word-swapped 74/108
```

**Two cautions.** The best of 189 combinations on 663 clips is partly luck -
the top three are within one point. And the per-kind breakdown shows where
the remaining 22% sits: `word-dropped` 77/111 and `word-swapped` 74/108, both
single-word errors, which is exactly what tolerating one weak word per ayah
forgives. Beating that needs a signal that distinguishes the spurious weak
word from the real one; four rule families have now failed to find it in the
per-word scores, so the next place to look is the alignment itself - a word
that was never said should show up in its _timing_, not only its probability.

**What the aligner is already good for**, regardless of the verdict rule: exact
per-word frame spans for the cursor, and per-word scores for _localising_ which
word was wrong once the whole-clip verdict is made some other way.

---

### The cursor was never measured, and it was broken (2026-10-20)

Reported from real use, three complaints in one message: "when I recite I
don't see always the words appear", "it seem I can skip?", and "I try my best
to say الضالين right but it always gets it wrong".

All three were the same omission. Everything measured up to this point judged
the **verdict** — whether a mistake was caught at the end of a run. Nobody had
ever measured the **cursor**, which is the part a reciter actually watches.

#### Cause: the cursor demanded an exact madd length

`phonemeProgress.ts` compared the emitted symbol to the expected one with
`===`. The symbol table encodes length by repetition, so `ا`, `اا`,
`اااا` and `اااااا` are four different symbols for one sound. Counted
over the whole Quran:

|                                    |                               |
| ---------------------------------- | ----------------------------- |
| expected units that carry a length | **82,719 of 311,886 (26.5%)** |
| words containing at least one      | **51,736 of 67,264 (76.9%)**  |

So on three words in four, the cursor only moved if the reciter held every
madd for exactly the number of harakat the training labels happened to fix.
`الضالين` is the worst case on the opening page — the model
phonemises it `ضضَااااااللِےےےےن`, five units of which **four** encode a
length or a doubling, so it was close to unmatchable however well it was
recited. The reciter was right and the comparison was wrong.

The model's own card says this outright: duration grading "should be done from
forced-alignment timing, not from the emitted symbol run-length", because
reciters legitimately choose two, four or six harakat. `ctcAlign.ts` had
honoured that since Tier 1, through `identityClasses`. The live tracker beside
it never did.

#### The other two complaints followed from it

- **"I can skip."** A stalled cursor accumulates stray phonemes, and after
  six of them `findRun` searched the page for somewhere they fit. It took the
  **first** match scanning from the top of the page, not the nearest — so a
  reciter stuck in the last line could be thrown back to the first, and the
  words in between vanished from the cursor's account of the run.
- **"I don't see the words appear."** A resync jump added nothing to
  `revealedLocations`, and a word stays hidden until it is revealed. The
  cursor moved on and left _holes_ in the page behind it. This is the literal
  complaint, and it had nothing to do with recognition at all.

#### Fixed

1. **Compare identity, not length.** `phonemeIdentity` is now one definition
   shared by `identityClasses` and the tracker, and `createPhonemeTracker`
   reduces the page to identities once, up front.
2. **Deduplicate what the decoder cannot send twice.** Greedy CTC suppresses
   a class repeated on consecutive frames, so a doubled consonant arrives
   once. Collapsed, 0.18% of adjacent units inside a word become identical
   (`تَتَقُەن`) and **1.35% of word boundaries** share a sound across
   the join (`وَمِنَ نَااسِ`). Both are consumed by one emission.
   Without the second, a boundary doubling stranded the cursor and then
   reported the finished word as skipped — a false accusation the fix below
   would have acted on.
3. **Resync forward first, nearest first.** Recitation travels one way, and a
   repeated word sits behind the cursor as often as ahead of it.
4. **Reveal everything behind the cursor**, recited or jumped over. No holes.

#### And the skip became evidence

The cursor now reports the words it was carried past. That is first-hand
knowledge the aligner does not have — it sees probabilities, not whether a
word was ever reached — so `findMisreadWords` withdraws the one-weak-word
tolerance from any word the cursor watched the reciter skip. Two unrelated
things have then gone wrong with the same word, and a CTC wobble cannot
produce both. This is aimed squarely at the 22% of mistakes still missed,
which are concentrated in `word-dropped` and `word-swapped` — single-word
errors that the tolerance forgives by design.

The verdict rule moved out of the React callback into
`model/practiceVerdict.ts`, where it is unit-tested and shared with the bench
rather than reimplemented in it.

#### New bench pieces

- **`cursor.mjs`** — measures the cursor itself: words lit, end reached,
  stalls, skips. Caches the model's emissions, so sweeps are instant.
- **`skips.mjs`** — combines both caches to ask what the cursor's report is
  worth, and sweeps how strict to be about it. No model pass.
- **`stumbles.mjs`** — what the cursor's _stumble_ is worth: how often it
  fires on a recitation with nothing wrong with it, and what listing it
  catches. Also no model pass.
- **`runners/zipformer-app.mjs`** — judges with the alignment _and_ the
  cursor, which is what the app does. `zipformer-aligned.mjs` now calls the
  same `findMisreadWords` with the cursor blinded, so the gap between the two
  runners is exactly what the extra evidence buys.

#### Measured: the cursor, for the first time

`cursor.mjs` over all 663 clips, before and after. "All but last" leaves each
clip's final word out of both sides, because the clips are cut at quran.com's
word timestamps and those run **0.82s short on average, on 90% of clips** — the
final word cannot be recited in full however well the cursor follows, which is
also why "reached the end" is near zero and should be read as a property of
the fixtures, not of the tracker.

| on correct recitations   | before  | after     |
| ------------------------ | ------- | --------- |
| words lit (all but last) | 94.1%   | **98.2%** |
| words lit (raw)          | 83.3%   | 86.9%     |
| **spurious skips**       | **128** | **17**    |
| stalls                   | 3       | 3         |

The headline is the third row. Across 135 clean recitations the old cursor was
thrown off its place and jumped **128 times** — about once per recitation —
and every one of those jumps left a hole in the page. 17 now. The same holds
for hesitation (103 → 20) and for word-dropped, where the skips settle toward
the one real drop per clip (194 → 68, against 111 clips).

Three changes produced that: identity matching, resyncing forward-nearest
rather than first-on-the-page, and reporting a jump from where its confirming
run **began** rather than from where the cursor resumed. The last sounds like
a detail and was worth 27 of the 111: a run ending on a word's final unit
leaves the cursor at the next word, so charging the word whose ending we just
heard as unsaid accuses the reciter of dropping it.

That reduction is also what made the next part safe to attempt: a spurious
skip withdraws the tolerance, so 128 of them would have been 128 chances to
accuse someone who recited correctly.

#### And then the verdict improved, measurably

`skips.mjs` replays the cursor over the cached scores, so the two signals can
be combined and swept in a second rather than a twenty-minute model pass. It
first establishes exactly where the old 22.2% went:

```
weak words per clip (lower quartile < 0.2)
kind              clips     0      1      2     3+
as-recited         135     54     78      3      0
word-dropped       111      0     34     60     17
word-swapped       108      0     34     64     10
```

**68 = 34 + 34.** Every single missed mistake was a clip with exactly one weak
word — and 78 correct recitations have exactly one too. No function of the
scores can separate those groups, because in both of them the scores say the
same thing. That is why four rule families and nine aggregations all stalled
at the same number, and it is a complete explanation rather than a guess.

The tolerance curve says the same thing from the other side:

| weak words tolerated | missed mistakes | wrongly flagged |
| -------------------- | --------------- | --------------- |
| 0                    | **0.0%**        | 64.7%           |
| 1 (shipping)         | 22.2%           | 4.2%            |
| 2                    | 63.4%           | 0.3%            |

The alignment on its own catches **every** mistake in the set. The entire
22.2% is the price of not accusing two reciters in three. That reframes the
problem: the verdict rule is not a mistake detector that needs improving, it
is a politeness filter, and the only way through it is evidence that says
"this particular weak word really was never said".

The cursor's report is evidence from outside the scores, and it separates
them:

| rule                          | missed mistakes    | wrongly flagged   | overall   |
| ----------------------------- | ------------------ | ----------------- | --------- |
| alignment only (was shipping) | 68/306 (22.2%)     | 15/357 (4.2%)     | 87.5%     |
| take every skip at its word   | 38/306 (12.4%)     | 20/357 (5.6%)     | 91.3%     |
| **skip + score ≤ 0.02** (now) | **38/306 (12.4%)** | **15/357 (4.2%)** | **92.0%** |

**Missed mistakes nearly halved, and wrongly-flagged did not move at all.**
Thirty more mistakes caught for nothing: word-dropped 77→89/111, word-swapped
74→92/108, while every category that should pass is untouched — as-recited
132/135, hesitation 104/111, word-repeated 106/111, all exactly as before.

Believing every skip instead catches the same thirty and accuses five more
people, which this project holds to be the worse failure. The score gate gives
all five back. `SKIP_CONFIRMS_BELOW = 0.02` is on a plateau — every bound from
0 to 0.05 leaves wrongly-flagged at 4.2% — so it is not a fitted edge.

Cross-checked: `evaluate.mjs --runner zipformer-app` did a fresh model pass
and reproduced `skips.mjs` exactly, 37/306 and 24/357 per kind, for the code
as it stood mid-change. The caches are sound.

#### The regression the first fix caused, reported from use again

> "sometimes it does not show the word after I read it ... but it continues
> and at the end it says no mistakes"

Reporting a jump from where its confirming run **began** stopped the cursor
accusing a reciter of dropping a word it had just heard the end of — and left
that word in neither list. `skipped` covered the words before the run;
`state.wordIndex` moved to after it; the words the run itself covered were
reported by nothing. So nothing revealed them and nothing marked them: blank
on the page, clean in the summary. The exact pair of symptoms above, and
visible in the first fix's own numbers if anyone had looked — the skips fell
to 17 while words-lit sat at 95.5%, which does not add up.

Both halves have to be reported, and they are different claims:

| words                     | claim                      |
| ------------------------- | -------------------------- |
| before the confirming run | never reached — `skipped`  |
| covered by the run        | just recited — `completed` |

Words lit on correct recitations: **95.5% → 98.2%**. About one word in 37 was
being recited and never shown. The verdict did not move (12.4% / 4.2%), which
is the right outcome: these words were reclassified as recited, not as skips.

The tests now assert the invariant rather than the symptom — every word behind
the cursor appears in exactly one list — and that test fails against the
previous code. The lesson worth keeping: none of the 27 tracker tests caught
this, because they all asserted what the cursor _reports_ and never that its
reports _cover the page_. A bench that counts outcomes cannot see a word that
falls out of the accounting entirely.

#### One more blind spot, found and closed

The encoder only runs on a full 61-frame window, so when a reciter stops there
were up to 60 frames — 0.6s — still in the buffer, never seen by the model and
absent from the frames the verdict is computed over. On the last word of a page
that is most of the word. `score` now pads with tail silence first, as
sherpa-onnx does for a finished stream.

Worth noting it was **not** the cause of the الضالين complaint: on the complete
ayah audio every word of 1:7 scores 1.000 for both Husary and Alafasy,
الضالين included. The verdict side was never wrong about it. The cursor was.

#### Caveat, and it is a large one

On the 32 curated clips the identity fix moved words-lit from 87.0% to 88.4%.
That is small, and the reason matters: these are professional reciters, whose
durations are what the model was trained on. **They hit the labelled lengths;
a learner does not.** The fix is still demonstrably correct — `الضالين` cannot be
matched without it, which is a test now — but its size for the person using
the app is unmeasured, and cannot be measured without their voice. Tier 4 is
no longer the nice-to-have at the bottom of this plan; it is the only way to
size the thing that was just fixed.

#### Dead code this exposed, left in place deliberately

Nothing in the app reads the tracker's own per-word verdict any more — the
aligner supersedes it — so `WordOutcome`, `errors`, `WORD_ERROR_RATE` and
`MIN_ERRORS_TO_FAIL` feed an `outcome` field with no reader outside the tests.
The same is true of the whole non-waiting mode: `waitForWord: true` is passed
at the only call site, leaving `LOOKAHEAD_UNITS` and the lookahead branch
unreachable in the app. Both are proven unreferenced and both should go, but
not inside a bug fix — the deletion rewrites most of
`phonemeProgress.test.ts`, and mixing that into a behaviour change makes both
hard to review.

### The bench widened to 268 ayat and 11 voices (2026-10-22)

3,595 ayah clips over six kinds and eleven reciters, plus 177 clips at true
page length, measured by `measure.mjs` on eight workers: 42.4 and 14.3
minutes. Everything below is cache arithmetic over that one forward pass.

#### `skips.mjs` had been measuring nothing

`measure.mjs` caches a clip's ayat as `verseKeys`, an array, because a page
clip spans several. `skips.mjs` still read `heard.verseKey`, which is
`undefined` in every row, so `quran[undefined]` dropped all 3,595 clips at the
lookup and the step printed `0 clips` and a table of `NaN`. It now builds its
expected words the way `cursor.mjs` does, and takes `--fixtures` so it can be
pointed at the page cache.

This was the one step that could tell us what the cursor's skips are worth,
and it turns out to be the largest single thing the verdict has.

The first figures written here — 57.1% of mistakes missed falling to 24.6% —
were measured by a replay that diverged from the app in three ways, found by
review the same day. **See "The replay was not the app" below for the
corrected table.** The shape of the result survived and got stronger; the
absolute numbers were wrong and were flattering.

The 663-clip sweep called `SKIP_CONFIRMS_BELOW` a plateau flat from 0 to 0.05
and said the accusations did not move at all. Five times the data says both
claims are wrong: it is a smooth curve (0 → 28.6% missed, 0.02 → 14.2%,
0.05 → 13.3%, 0.2 → 11.4%, at 1.8% → 2.8% → 3.2% → 4.1% flagged), and 0.02 is
a chosen point on it. Loosening it keeps buying mistakes for accusations. The
comments in `practiceVerdict.ts` now carry the real numbers.

#### Pages, at real page length

8 false accepts of 105 and 7 false rejects of 72. Replaying the cache
reproduces the end-to-end run exactly, so the rule can now be iterated on in
seconds rather than fourteen minutes.

All eight missed mistakes are `word-dropped`, each one a clip whose single
dropped word was the only weak word in its ayah — the tolerance is per ayah,
so a nine-ayah passage forgives up to nine words.

#### Ten ways of scoring a word, and the present one still wins

The weak-word rate on correct recitations does not fall with word length
(0.0–2.4% at every length), so the lower quartile is not penalising short
words — that hypothesis is dead. Against interpolated percentiles, the
geometric mean, the median, the minimum and three "forgive the single worst
phoneme" variants, over both sets, the lower quartile is still best. Every
more forgiving statistic trades missed mistakes one for one or worse: the
trimmed ones buy 2.4 points of accusations for 9.4 points of missed mistakes,
because a word that was never said has no good phoneme either.

#### 4:11–12, and a gemination the model will not say

Six of the seven page false rejects are one passage, `4:11+2`, and the same
words fail for all three reciters. No aggregation fixes it — the false rejects
sit at 6/72 for every variant — because the words score 0.0000, not merely
low. In each one exactly one phoneme is unalignable and the rest score ~1.0.

The culprit is gemination. The dataset writes a shadda as a doubled letter,
and after `ال` assimilation that doubled letter starts the word: `السُّدُس` is
`سسُدُسُ`, `النِّصْف` is `ننننِصفُ`. The model frequently emits the single form
instead, and for `ثثُ` — `الثُّلُث`, `الثُّمُن` — it never emits the geminate at
all: expected nine times by a correct recitation in this set, produced zero
times in 3,772 clips, while `ثُ` was produced 95 times.

This is the same length-identity problem that broke `الضالين`, now on the
scoring side rather than the cursor's. It is _not_ an argument for collapsing
shadda generally: `إِيَّاكَ` uses `ييَ`, which the model emits 400 times and
genuinely distinguishes from `يَ`, so narrowing `HELD_SOUND_RUN` to madd and
ghunnah was right and a fix here must not undo it. Of 89 geminates the Quran
expects, 62 the model demonstrably produces and must stay distinct.

#### What is risk and what is proven

34 expected units were never emitted in 3,772 clips, and they occur in 270 of
6,236 ayat — 4.3% of the Quran, every one of them carrying a likely
accusation against a correct reciter. (The cause is not what it first looked
like; see "It is not gemination" below.) **But 26 of the 27 dead geminates were
never expected by any clip we measured**, so they look dead for want of an
opportunity, not on evidence. Only `ثثُ` is proven. Collapsing the other
twenty-six now would be fitting to absent data.

So the next data task is bounded and well defined: build fixtures for those
270 ayat and find out which of the 34 units the model will ever produce. That
converts 4.3% of the Quran from unknown to known. `ففِ`, emitted once in 3,772
clips but expected in 31 ayat, says any rule built on this will need a
frequency floor rather than a strict zero.

#### It is not gemination, and there is no identity fix to make

The reading above — that the model will not say a doubled letter, so a dead
geminate should be collapsed onto its single form — is wrong, and measuring it
properly says so. Aligning every correct recitation's expected units against
what was actually emitted, over 725 clips and 3,348 expected geminates:

| what sits where a geminate was expected | share |
| --------------------------------------- | ----- |
| the geminate itself                     | 98.8% |
| its single form                         | 0.4%  |
| the single form twice                   | 0.0%  |
| nothing at all                          | 0.1%  |
| something else                          | 0.7%  |

**The model produces geminates.** `ببِ`, the one in `بِرَبِّ`, comes back exactly
right 132 times out of 132, so the false flags seen there in a stricter shadda
rule have some other cause. Collapsing anything onto its single form would
forgive a distinction the recogniser is making perfectly well.

What `ثثُ` actually shows is a different failure. Where the dataset has it, the
model emits `سسُ` six times in nine, `تُ` twice and `لُ` once: ث heard as س, a
place-of-articulation confusion between two fricatives, with the gemination
itself intact. `الثُّلُث` comes back as `السُّلُس`. That is why 4:11–12 fails for
every reciter, and it is a limit of the model on a rare phoneme rather than
anything the tokenizer or the identity classes can repair.

Merging ث with س to hide it would make `ثلاثة` and `سلاسة` the same word, which
is exactly the kind of forgiveness that manufactures false accepts. So nothing
is changed here. The honest position is that a handful of ayat carrying `ثثُ`
will wrongly flag, and the 26 untested units stay untested until there are
fixtures for them.

#### The replay was not the app (corrected the same day)

Review found three ways the bench replay diverged from the running app. Two
turned out not to matter and one changed the headline.

1. **The app withdraws a skip when the reciter comes back to the word**
   (`RecitationPracticeContext.tsx:705`); the replay only ever added one.
   _No effect_ on these numbers: `advanceTracker`'s `furthest` guard already
   prevents charging a word twice, and manufactured mistakes do not stumble
   and return. It will matter for a real learner, which is Tier 4 again.
2. **The worker posts phonemes every 48 fbank frames — 480ms — not the 1.92s
   the replay batched**, which read 48 as encoder frames. _No effect_: the
   tracker is driven by the order of the phonemes, not by their arrival time.
3. **The app scores only `recitedSpan(tracker)`, the stretch the reciter
   actually covered**, while the replay aligned the whole passage. This one is
   decisive. Aligning the whole passage makes a reciter who stopped early
   trivial to catch — the unsaid tail scores nothing — by a route the app
   never uses for scoring. The app catches stopping early by the run not
   finishing, so those clips never belonged in this rule's score at all.

Counting only the dropped and swapped words, over the recited span:

|                   | missed mistakes  | wrongly flagged |
| ----------------- | ---------------- | --------------- |
| alignment alone   | 811/1197 (67.8%) | 34/1897 (1.8%)  |
| with cursor skips | 236/1197 (19.7%) | 53/1897 (2.8%)  |

On whole pages, 22.9% falling to 7.6%, with false rejects 8.3% → 9.7%. Pages
mostly reach their end, so restricting to the recited span barely moves them:
8/105 false accepts became 9/105 on the first corrected pass.

So the conclusion stands — without the cursor's skips the rule misses two
dropped or swapped words in three — while the absolute figures moved in both
directions from what was first reported: **19.7% of those words missed rather
than 24.6%, for 2.8% of correct recitations accused rather than 2.0%.**

The table above is already from the app-faithful cache, re-measured after the
correction; see "The cache is app-faithful now" below for how, and for what
the whole rule costs.

Nothing here touches the gemination findings above: those rest on which
symbols the recogniser emits, not on how the verdict is scored.

#### `zipformer-app.mjs` fixed, and it reproduces the baseline

The runner now does what the app does: 480ms batches, skips withdrawn when the
reciter comes back, and the alignment run over `recitedSpan` alone. Removing
the accidental help cost it the two kinds that were never the aligner's to
catch, so both are now answered the way the app answers them.

**Stopping early** is caught by not reaching the end, not by scoring words
nobody recited. The last word is forgiven, for the reason `cursor.mjs` already
documents: the fixtures are cut at quran.com's word timestamps and those run
short, so the closing word often cannot be completed however well the cursor
followed.

**Reciting a different passage** leaves no word of the page matched. The app
reports that as "no recitation was heard" — a failure, not a clean page — and
tells it apart from nobody-speaking by whether the recogniser emitted anything
at all. `finishPractice` now draws the same line, so pressing stop before
reciting is a cancel rather than an error.

Over the original 32 fixtures the corrected runner gives **1/12 false accepts
and 0/20 false rejects**, which is exactly the baseline this plan opened with —
now reached without the whole-passage alignment quietly doing the work. The
single miss is still `wrong-ending-112_1`, the `ءَمَدڇ` for `ءَحَدڇ` case.

#### The cache is app-faithful now

`clipWorker.mjs` decodes, replays the cursor in 480ms batches, takes
`recitedSpan` and aligns only that stretch — all inside the one forward pass
it already did, so the whole correction cost 56 minutes of re-measuring and
nothing else. `measure.mjs` carries `span` and `totalWords` into
`.scores.json`, and `sweep.mjs` and `skips.mjs` judge that slice and treat not
reaching the end as its own answer rather than relying on unreached words
scoring nothing.

The replay and the live runner now agree clip for clip: `skips.mjs` over the
page cache reports 8/105 false accepts and 7/72 false rejects with every
by-kind row identical to `evaluate.mjs --runner zipformer-app`. That agreement
is the point of the exercise. Before it the two disagreed, and nothing said
which of them was right.

What the verdict rule costs, over all 3,595 ayah clips:

| rule                        | missed mistakes  | wrongly flagged |
| --------------------------- | ---------------- | --------------- |
| mark every weak word        | 133/1698 (7.8%)  | 120/1897 (6.3%) |
| forgive one per ayah        | 816/1698 (48.1%) | 34/1897 (1.8%)  |
| forgive two per ayah        | 896/1698 (52.8%) | 23/1897 (1.2%)  |
| forgive one, + cursor skips | 241/1698 (14.2%) | 53/1897 (2.8%)  |

The last row is what ships. Read the first row against it: the pair of rules
costs 7.8% of mistakes missed becoming 14.2%, and buys 6.3% of correct
recitations accused becoming 2.8%. On the earlier whole-passage cache marking
every weak word accused 13.1% and was simply unusable; at 6.3% it is a real
alternative, and the choice between them is now a judgement rather than a
result. It goes this way because accusing a correct reciter is the worst thing
this feature can do, and 6.3% is one in sixteen — measured on professional
reciters, so a learner on a phone microphone will fare worse.

And over the 177 page-length clips, where the tolerance has a whole page of
ayat to spend:

| rule              | missed mistakes | wrongly flagged |
| ----------------- | --------------- | --------------- |
| alignment alone   | 24/105 (22.9%)  | 6/72 (8.3%)     |
| with cursor skips | 8/105 (7.6%)    | 7/72 (9.7%)     |

End to end that is **162/177 correct, 8/105 false accepts, 7/72 false
rejects**, at a median 5.2s and a worst case of 23s from the end of the
recitation to the verdict.

**Six of the seven false rejects are one page.** 4:11–12 fails for all three
reciters, in both its correct and its ayah-repeated form, which is the
`ث` → `س` confusion documented above and not the verdict rule's doing. The
seventh is 55:1–22 for Husary alone. Set that one page aside and page false
rejects are 1/72.

#### The app did not implement the rule the bench measured

Everything above counts a run that stopped early as caught, on the grounds
that the app cannot present an unfinished recitation as a clean page. Review
found that it could, and this was wrong for a day.

`requestVerdict` replaced `totalWords` with the stretch it had just judged, so
three words of a hundred and twenty dispatched `progressIndex: 3` of
`totalWords: 3`: the bar read 100%, `misreadWords` was empty, and the summary
said رتلاوة سليمة - recited correctly. Scored the way the reader actually saw
it, the figures were:

| mistakes caught        | as the bench counted it  | as the reader saw it |
| ---------------------- | ------------------------ | -------------------- |
| ayah set               | 1457/1698 (14.2% missed) | 677/1698 (60.1%)     |
| of which stopped-early | 496/501                  | **6/501**            |
| page set               | 97/105 (7.6% missed)     | 64/105 (39.0%)       |
| of which stopped-early | 36/36                    | **3/36**             |

So the app caught stopping early essentially never, and the bench's comment
asserting otherwise was something written rather than checked.

The rule was the right one; the app simply did not have it. `stoppedShort`
now lives beside `findMisreadWords`, the verdict keeps the page's total and
reports how far the reciter got, and the summary says so in both locales
rather than showing an empty list of misread words. The bench reads the rule
from the same function. The tables above therefore describe the shipped app,
which until this change they did not.

The eight remaining false accepts are all `word-dropped`, and all on long
pages: 2:255–257 for all three reciters, 18:1–9 and 67:1–8 for two each, 2:1–9
for one. A single dropped word among eighty is exactly the case the per-ayah
tolerance forgives, and on these the cursor either reported no skip at all or
reported one on a word that still scored above `SKIP_CONFIRMS_BELOW`.

#### The mistake the audio cannot be re-measured for

Reported from use, and the complaint is exact: _"sometimes it says you didn't
get any word wrong, but I did."_

A word said wrongly and then said correctly is in the recording twice. The
alignment is monotonic and places each label once, so it places the word on
the attempt that supports it — the good one — and the word scores well. The
verdict then has nothing against it, and a recitation that stopped and went
back three times comes back clean. **No pass over that audio can ever find
it**, this one or a later one: the evidence is not in the audio, it is in the
order the audio arrived in. Only the live cursor was there for the first
attempt, and only for the 480ms it took to notice.

So the cursor now reports what it saw — the word, and the phonemes that fitted
nowhere near it — and the summary lists it as a stumble rather than a misread.
Measured over the same 3,595 clips, the listing fires on:

| kind          | clips with a stumble |
| ------------- | -------------------: |
| as-recited    |         8/689 (1.2%) |
| word-repeated |        10/604 (1.7%) |
| hesitation    |        14/604 (2.3%) |
| stopped-early |         2/501 (0.4%) |
| word-dropped  |        25/604 (4.1%) |
| word-swapped  |  **320/593 (54.0%)** |

The last row is the surprise. Over half of every swapped word makes the cursor
stop and conclude that something else is being said, which is exactly what is
happening — so the stumble is not only something to show the reciter, it is
evidence. Folded into the verdict:

| rule              | missed mistakes  | wrongly flagged |
| ----------------- | ---------------- | --------------- |
| words marked      | 258/1698 (15.2%) | 44/1897 (2.3%)  |
| + stumbles listed | 197/1698 (11.6%) | 71/1897 (3.7%)  |

Sixty-one more mistakes caught for twenty-seven more correct recitations
questioned, nearly all of the gain in `word-swapped` (469/593 → 520/593). That
is a better trade than tightening the score tolerance, which is what strict
mode does: 3.6 points of missed mistakes for 1.4 points of accusations, where
strict mode pays 4.0 points for 7.4. It is also a softer failure — a stumble
row says the recitation went back over a word, not that the word was misread,
and it is labelled that way in both locales.

#### A review's findings, and what they were worth

Twenty-four, of which eleven are fixed here. Four were verified against the
code before anything was changed, because a review is a claim and two of these
were about work an hour old:

**Half a page counted as complete.** The worst of them, and reproduced:

```
started at word 3 of 4, recited to the end
  span: {from: 2, to: 4}   words judged: 2 of 4
  stoppedShort? false
  => the app reports 4 of 4 words done and FINISHED
```

`stoppedShort` asked whether the _end_ was reached, so a reciter who opened
partway down and carried on to the last word reached it: complete, clean, bar
at 100%, and the half they never recited never scored. The same failure as the
abandoned page documented above, in mirror image, and it had been there the
whole time.

It now asks about both ends, and the tolerances are asymmetric for a measured
reason. One word at the end, as before. **Two at the start**, because the
opening word fails for a reason the closing word does not - the model will not
always say a word's first phoneme, which the section above measures - and
because tajweed joins words, so one unmatched unit can cover two of the
page's. Swept over 3,595 clips:

| rule                  | missed mistakes  | wrongly flagged |
| --------------------- | ---------------- | --------------- |
| the end only (before) | 261/1698 (15.4%) | 41/1897 (2.2%)  |
| both ends, 1 at start | 240/1698 (14.1%) | 55/1897 (2.9%)  |
| both ends, 2 at start | 259/1698 (15.3%) | 44/1897 (2.3%)  |

Tolerating one at each end catches 21 more mistakes for 14 more correct
recitations accused. Two at the start holds the old figures almost exactly, so
the correctness fix is free - and accusing someone who recited correctly is
the worse failure. Either setting catches the bug this exists for easily:
opening halfway down a page leaves tens of words unrecited, not two.

`progressIndex` now counts the recited span rather than everything from the
first word of the page, so the bar stops reading 100% for a page recited half
of.

**The hold was defeated by going back.** Mine, from the same day. The provider
kept its own copy of which word was held and dropped it whenever the cursor
left that word - which going back over the line before it does - so the hold
was released and the reciter could then read straight past the word that had
stopped them. The review's root-cause note is right: two owners trying to stay
in step.

The tracker owns it now, by word index rather than a flag, and lifts it only
when the cursor is genuinely _past_ the word. Backward jumps are still
followed, forward ones refused unless the confirming run covers the held word

- which means they recited it. `PhonemeProgress` reports the held word so no
  caller has to guess when it ended. Two more findings had the same shape and go
  with it: a tone sounding for a word corrected inside the same 480ms report,
  and both reader actions staying live while the verdict was being scored, where
  pressing one asked for a second verdict and landed an error on the summary.

**The "Heard:" line showed raw glyphs.** Also mine, and worse than reported.
The mapping translated U+06BB and U+06BE - RNOON and HEH DOACHASHMEE - where
the table uses U+06BA (ں) and U+06FE (۾), so both entries matched nothing and
both nasals reached the reader untranslated. A third, U+06EA, was never mapped
at all. Nothing threw; the line simply read as nonsense. This is the same slip
caught earlier in `HELD_SOUNDS` and then repeated in a new file, so the
mapping's comment now says the check: the table's character set is 42 code
points, and a `from` that is not one of them is a typo rather than a spare
rule.

**Dead state.** `wrongFlashRef` was only ever assigned `null` once the hold
replaced the streaming flash; the ref and its three readers are gone. The
legacy engine's timed flash is untouched.

Also fixed: the dev capture endpoint now refuses any request whose `Origin` is
not this server, where before any site open in the same browser could write
bounded files into the fixtures directory while `npm run dev` ran; the summary
clears its note and saved filename for each run instead of carrying the last
one's; clearing the downloaded models asks for the streaming reload before the
call that can throw, so a failed cache no longer makes the button a no-op for
everyone on the default model; and the reader-bar tests set their own locale
instead of inheriting it from whichever test ran first.

**One disagreement.** The review asks for a word given up on to stop being
reported once the reciter goes back and recites it. The first attempt at that
was unreachable code - `completed` is deliberately bounded below by the cursor,
so a word it has already passed is never re-credited - and on reflection the
behaviour is right as it stands: stopping and moving past a word is worth
revising whether or not the retry succeeded, which is exactly the argument the
stumble rows are built on. The copy says what happened and nothing more:
توقفت عندها وتجاوزتها.

**And one decision, which is not a bug.** The review objects that
stop-on-mistake is on by default and that nobody opted into the stronger
behaviour, since on the streaming model it now freezes the run rather than
sounding a tone. Kept on, deliberately: it is what was asked for in the words
_"I want when I get a wrong word, it stops me until I figure it out"_, and the
first-phoneme forgiveness above removed the trap that made it cost
twenty-six seconds. The measured risk is that a stumble fires on 1.2% of
correct professional clips, so a spurious hold is rare but not impossible, and
a learner will fare worse than that.

The objection is still right about everybody else. **Revisit this before the
app is used by anyone but its author** - a default that stops a stranger mid
page, on a recogniser that will not say some of their phonemes, is a different
proposition from one its owner asked for. The switch, the reveal and the way
past all exist; only the default is in question.

The rest were then worked through too, so twenty-two of the twenty-four are
closed. The three that failed _silently_ came first:

- **A recogniser the run never took stayed running.** The engine is started in
  parallel with the page's phoneme table and adopted only after it, so a table
  that failed - or a run stopped in that window - left the fetch to resolve
  into nothing, holding its worker and the model's 72MB for the life of the
  page. Nothing could reach it: `zipformerRef` was never assigned, so
  `disposeEngine` had nothing to dispose, and every retry added another.
- **A verdict that never arrived left the run unendable.** `completedRef` is
  set the moment scoring is asked for, and from then on both stop buttons
  stand aside for the verdict - so a recogniser that died without answering
  took the reader's only two exits with it, and the bar said it was checking
  for good. `VERDICT_TIMEOUT_MS` is sixty seconds against a measured 5.2s
  median and 23s worst case: a way out rather than a budget.
- **The speech gate still learned a different reciter on each browser.** Its
  own comment says the rates are scaled so they mean the same thing wherever
  they run; the decay and the rise cap were, the rise itself was not. Two
  seconds of one steady voice reached a level **7.4% apart** between Chrome's
  256ms blocks and Firefox's 85ms ones, now **1.7%** - the remainder being
  `MAX_RISE_PER_BLOCK` binding at different points in the climb.

Two more were plain wrong answers. The error shown when nothing matched told
the reader to check the microphone, which is the least likely cause: it only
fires once the recogniser has emitted phonemes, so something _was_ heard and
they were on a different page or had moved past every word. And in surah view
`hideAyat` blanked every mounted page while only the page being recited can
ever be revealed, so the pages around it stayed blank for the whole run with
nothing able to bring them back; each page now hides only itself, and only
while the cursor is on it.

Three cleanups, one of which mattered beyond tidiness: **the audio path
converted every block three times.** `createPracticeResampler` returned a
`number[]`, boxing every sample into a JS array, and the level meter and the
recogniser each converted it back to a `Float32Array` - on a path that runs
several times a second for the length of a page. It returns a `Float32Array`
written into a reused scratch buffer now, so a block is written once and
copied once; the anti-aliasing and block-boundary tests pass unchanged, which
is what says the filter itself did not move. `resampleToPracticeRate` went
with it - a wrapper whose only caller was the test that existed to cover it,
so the test now drives the resampler the microphone really uses. And the store
behind a stored preference, written out three times for the model, strict mode
and tajweed colour, is `createStoredPreference`: deliberately not a hook, so
`useSyncExternalStore` stays in the `useX` function beside each preference
where the rules of hooks can still be checked.

**Two are left open, with reasons.** The onnxruntime pin is real - an
`overrides` forces `@huggingface/transformers@4.3.1` onto
`onnxruntime-web@1.26.0-dev` where it asks for `1.31.0-dev`, which is the kind
of mismatch that produces exactly the `Missing the following inputs:
cache_position` failure this feature has already seen. But transformers is
imported by `whisper.worker.ts` and nothing else, while the streaming worker
imports `onnxruntime-web/wasm` directly: bumping the pin would change the
runtime under the engine that matters to fix the one scheduled for deletion.
The answer is Tier 5, retiring Whisper, which removes transformers, the
override, `ortRuntime.ts` and about 24MB together - and takes the Whisper
summary's "not clearly enough" labelling with it.

The last one needs the bench rather than a judgement: after a long forward
jump there can be too little audio left to score the words that were skipped,
so the reader is told the recitation could not be checked instead of being
shown the words they dropped. Whether to score the reachable part or say
plainly that a jump that large cannot be judged depends on how often it
happens, which `measure.mjs` can answer and guessing cannot.

#### The first recording, and a sound the model will not say

The first run captured from the person using this, reciting al-Ma'un, and the
report that came with it: _"I got stopped at فويل, I said it right but it
keeps giving wrong — also maybe cuz I try to say two words fast together?
فويل للمصلين?"_

The recording settles it. **The cursor stood on that one word for 26.2
seconds**, against 0.4–2.8s for every other word on the page, and the reason
is one phoneme:

|           |                                     |
| --------- | ----------------------------------- |
| expected  | `فَ وَ ي لُ للِ ل مُ صَ للِ ۦۦۦۦ ن` |
| attempt 1 | `وَ ي لُ لَ`                        |
| attempt 2 | `وَ وَ ي لُ وَ ي لُ`                |
| attempt 3 | `وَ ي لُ للِ ل مُ صَ للِ ۦۦ`        |

Attempt three is the whole word, correctly, **minus only its opening فَ** — and
the two words run together, which he suspected, came through perfectly: the
idghaam `لُ للِ ل مُ` is exactly what the page wanted. Across 123 emissions
the run contains **no symbol with a ف in it at all**, where two were expected
(فَذَٰلِكَ lost its فَ as well, and survived only because its stray run
happened to match from the second phoneme and the resync credited the word).

Three things were ruled out by measurement rather than reasoning:

- **Not the model in general.** `dropped.mjs`, new, counts how often each
  expected unit is heard over the 1,897 correct clips: `فَ` is heard **99.2%**
  of the time, and 98.8% when it opens a word, over 411 such cases. It is not
  in the worst twenty-five units; `ن` is, at 77.3%.
- **Not the streaming path.** Replayed through the model in one pass, the way
  the bench scores a clip, the same audio gives 122 phonemes and the same zero
  ف. Full context does not recover it.
- **Not the speech gate**, which was the best hypothesis: `acceptSpeech`
  decides what reaches the recogniser at all, so a block holding a quiet
  fricative could have been dropped outright. The waveform around the third
  attempt is continuous at 0.02–0.04 RMS with no clipped onset. Cut out and fed
  on its own, though, the فذلك slice _does_ decode as `فَ ذَ اا لِ`, so the
  sound is in the audio and the encoder's context is what loses it.

So his ف is too light for this model in running speech, and nothing in this
repository will change that. What was ours to fix is that **a phoneme missing
from a word's first position was unforgivable**, where mid-word it had been
forgiven since the stall before this one. The cursor could only wait, and with
the hold above now real, waiting means trapped.

Two guards make it affordable, and both were needed — the first attempt at
this lost five of the cursor's own tests:

- **Only on a clean arrival** (`state.stray.length === 0`). Without it any
  stray phoneme that happened to equal the word's second sound was swallowed
  as that sound and cleared the run with it, so the resync never reached its
  six: reciting 1:2 from its third word left the cursor stuck on the first.
- **Never on an ambiguous sound**, one that could equally be this word's
  second phoneme or the next word's first. That is what a reciter who dropped
  the word sounds like, and it is the hazard the old `unitIndex > 0` guard was
  written for. Measured, it costs one clip of 3,595 — kept anyway, because its
  absence is the thing the original author feared.

| over 3,595 clips  | missed mistakes   | wrongly flagged |
| ----------------- | ----------------- | --------------- |
| before            | 258/1698 (15.2%)  | 44/1897 (2.3%)  |
| after             | 261/1698 (15.4%)  | 41/1897 (2.2%)  |
| with the stumbles | 197 → 200 (11.8%) | 71 → 69 (3.6%)  |

Three more mistakes missed for three fewer correct recitations accused, and
91.6% overall either way. `MIN_UNITS_TO_FORGIVE_FIRST` was swept: demanding
three more phonemes instead of two reproduces the old figures exactly, so the
whole change is available for nothing, and two is chosen over three only
because it covers more words and trades in the direction this feature cares
about.

Replayed against his own emissions, the page no longer stalls at فويل at all.
It is still marked, which is right: the audio really is missing its first
sound, and his first attempt trailed off after four phonemes.

**One flaw in the capture this exposed.** `capturedAudioRef` is filled inside
`onAudioBlock`, which the mic calls only for blocks the gate admitted — so a
recording holds what the recogniser heard, not what the microphone did. The
gate hypothesis above had to be tested against the waveform and an isolated
re-decode instead of against the audio that was actually rejected. Capturing
the resampled block before the gate decides would make the next recording able
to answer it, and is the one thing that would have made this investigation
shorter.

#### "Stop me" never stopped anybody

Reported from use, third in the same sitting: _"I want when I get a wrong
word, it stops me until I figure it out, with an option to see it."_

The toggle for this has existed since the feature did, under the storage key
`quran-practice-stop-on-mistake`, and its own contract comment said the cursor
"always waits for the word". It does wait — and then `RESYNC_AFTER_STRAY_UNITS`
fires six phonemes later, `findRun` finds the reciter further down the page,
and the cursor follows them, reporting the word they abandoned as skipped. So
what the switch actually bought was a tone and a reveal. Anyone who gave up and
read on was carried along exactly as if it were off.

The hold is now real: `holdAtWord` refuses the resync's **forward** jumps, so
the only ways past a word are to recite it, or to say you cannot. Backward
jumps are still followed, because going back over the words before the one you
are stuck on is how people find it, and the cursor has to come back with them.

Two things had to change alongside it.

**The word is no longer revealed with the tone.** It used to be shown in the
same breath as being stopped, which hands someone the answer they are halfway
through remembering — the whole point of reciting from memory. Seeing it is now
`revealHeldWord`, a button, and pressing it does not release the hold: the word
still has to be said.

**There is a way out.** `skipHeldWord` exists because the recogniser does drop
a phoneme a learner really said — one Fatihah into a real microphone stalled
five times on a م that every professional reciter in the bench says clearly —
and without it, asking to be stopped would make the run a trap whose only exit
is abandoning the page. What it costs is a line in the summary: `gaveUp`, the
fifth reason a word can be listed and the only one the reader reports
themselves, which makes it the surest entry in the list. It is kept even when
the word falls outside the judged span, which it usually does — giving up on
the first word of a page means the span starts at the second.

Turning the switch off while stopped also lets the run go, because otherwise
the switch that put someone there could not get them out.

None of this touches the bench: `holdAtWord` is never called from
`scripts/tasmee`, so `state.held` is false throughout and the replay is
unchanged — 15.2% missed at 2.3% wrongly flagged, 854 skips, verified after the
change. It is also the first part of this feature the bench cannot speak to at
all. A fixture cannot be stopped and asked whether it figured the word out.

#### And what was heard in its place

The same report found the other half of it: _"it shows me the right word, it
should show the word I said wrong in red in its place."_ A mark answers "which
word" and leaves the question the reciter actually has, which is why a correct
word marked red reads as the feature being broken rather than as something to
work on.

The frames are already there. `alignToExpected` reports `startFrame` and
`endFrame` per word and nothing read them, so `decodeFrames` now takes the
argmax over that window — one more pass over frames the Viterbi has just
walked, against a states-by-frames lattice to find them — and the worker posts
what was heard alongside each score. For a stumble it is the stray run
instead, because the aligner will have used the good attempt.

Those phonemes are unreadable as they stand: the table writes length by
repetition, a shadda by doubling, and has letters of its own for sounds no
keyboard has, so ٱلضَّآلِّينَ arrives as `ضضَااااااللِۦۦۦۦن`.
`phonemesAsLetters` reads each convention back — a held sound once, a doubling
as a shadda, ۥ and ۦ as و and ي, ڇ as a sukoon — giving `ضَّالِّين`.
It is an approximation of the sounds and not a word from the Quran, so it is
labelled as heard, shown in the colour of a mistake, and never presented as
text to read. A length difference is reported as no difference at all, the
model's own card being explicit that duration belongs to alignment timing
rather than to the emitted symbol.

---

## Tier 2 — A bench big enough to tune against

32 clips cannot justify a threshold. Build thousands, with labels.

**The enabler:** the quran.com audio API returns **per-word timestamps**
(`segments=true`, already parsed in `src/domain/quran/audio/quranComAudio.ts`).
That means mistakes can be _manufactured_ at exact word boundaries rather than
collected.

- Extend `scripts/tasmee/build-fixtures.mjs` (it already downloads, cuts and
  concatenates via `lib/audio.mjs`) to generate, per ayah and reciter:
  - correct recitation
  - one word dropped
  - one word replaced with a word from elsewhere
  - stopped early, repeated word, long hesitation
  - the existing `kind` / `verdict` manifest fields already describe these
- `scripts/tasmee/evaluate.mjs` **already** separates false accepts from false
  rejects and breaks results down by `kind`; it needs no changes. Only the
  fixture set has to grow.
- Then tune the thresholds against the curve, not against judgement. With 12
  mistakes in the set, one failure is 8.3% — far too coarse to tune on.

**Caveat to hold onto:** reciters measure the ceiling, not the real case. This
is for regression safety and threshold calibration.

---

## Tier 3 — Variables we can simply measure

Each is a bench run against Tier 2, an hour or two apiece. We hold the
Hugging Face token, so the extra model files can be fetched on demand.

| question                             | note                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| v3 vs v3.1                           | we run v3.1, the madd fine-tune; their README says to evaluate on your own material before switching |
| int8 vs fp32                         | 69MB vs 250MB — is quantisation costing accuracy?                                                    |
| `left_context_probe/` 64 / 128 / 256 | the export bakes in 256,128,64,32,64,128                                                             |
| noise suppression and AGC off        | changed on reasoning; never measured                                                                 |
| speech gate constants                | `RELATIVE_FLOOR`, `DECAY_PER_BLOCK` against real room recordings                                     |

**One architectural idea from their README:** on out-of-domain audio, full
context is ~2 PER better than streaming chunks. A learner on a phone mic is
out-of-domain. So: **stream for the live cursor, re-score the finished phrase
with full context for the verdict.** Live feel, better judgement.

---

## Tier 4 — The recording that matters

Everything above is tuned on professional reciters. The one irreplaceable
dataset is the user's own voice.

- A debug-only capture mode that writes the mic audio plus the expected text
  into `scripts/tasmee/fixtures/` with a label.
- Record several pages: correct, with deliberate mistakes, at different paces,
  in a noisy room, with someone else talking nearby.
- Re-run every Tier 3 comparison against it.

---

## Tier 5 — Product and cleanup

- **Retire Whisper.** Removes ~24MB of ONNX runtime plus transformers.js,
  deletes the second engine branch in `RecitationPracticeContext.tsx`, the
  model picker, `clearWhisperModelCache` and the dtype helpers. Do it once the
  streaming engine is confirmed in real use. Drops `MAX_DIST_BYTES` back from
  75MB toward 50MB.
- **Model download progress.** The bar sits at ٠٪ during the 69MB fetch
  because the streaming path never reports progress. Stream the fetch and
  dispatch `model-progress`.
- **First-word false misread.** A reciter who starts mid-page accumulates
  errors on word 1 until the resync fires. Suppress marking until the first
  confident match.
- **Hosting.** A browser cannot authenticate to a gated repo, so shipping to
  anyone else needs Quran-Lab's agreement to serve the 69MB from Artqiy's
  domain. NPL-1.2 permits copying and a free hosted service; ask anyway.
- **Licence obligations** when it ships: the app must state that automatic
  feedback can be wrong and does not replace a qualified teacher, and must
  never charge for anything the model powers.

---

## Later: a strict mode, for reciters who want their madd graded

Parked deliberately, with the evidence, because today's fix removed something
a strong reciter might actually want back - and the obvious way to give it
back is the wrong way.

### What today's work proved about professional reciters

The cursor used to demand the exact labelled symbol, and that is precisely
what a professional produces. Husary reciting `الضالين` emits

```
ضضَ   اااااا   للِ   ےےےے   ن
```

**exactly as the table labels it** - a six-harakat alef where the label says
six. So the strict comparison was not broken for him; it was only broken for
everyone else. That is why the fix measures as +1.4% words-lit on the 32
curated clips and +1.4% on the 663 (94.1% to 95.5%): the clips are reciters,
and reciters were never the ones it failed.

It also means the strict reading carries real information. Someone who wants
to be told "that madd was four, it should have been six" is asking for a
judgement the loose comparison deliberately throws away.

### Why not simply offer the old behaviour as a toggle

Because the model's own card forbids reading length off the emitted symbol:
duration grading "should be done from forced-alignment timing, not from the
emitted symbol run-length". The run-length is what the acoustic model guessed
among four symbols that differ only by repetition - it is not a measurement.
A toggle would be selling the reciter an unreliable number as tajweed
feedback, which is worse than silence.

### The mechanism that is already there, and unused

`alignToExpected` computes a Viterbi path and already returns `startFrame`
and `endFrame` per word. **Nothing in the app reads either.** One encoder
frame is 40ms, and the signal is plainly present - the aligner's own spans for
the end of al-Fatihah, on the full ayah audio:

| word      | Husary | Alafasy |
| --------- | ------ | ------- |
| `وَلَ`    | 0.24s  | 0.20s   |
| `الضالين` | 5.64s  | 5.24s   |

That is a real duration, measured from the audio, at a resolution fine enough
to separate two, four and six harakat.

### What it would take

1. **Per-label timings, not just per-word.** The word span above covers
   `ضَ` + madd + `لِ` + madd + `ن` together, so it cannot say which madd was
   short. `alignToExpected` walks the path per label already (`labelCounts`);
   it would return a first and last frame per label instead of per span. Small
   and local.
2. **A reference length.** Harakat are relative to the reciter's own pace, not
   absolute, so a madd has to be judged against the short vowels around it in
   the same recitation - which the same per-label timings give for free. No
   calibration step and no per-user setup.
3. **Keep it out of the verdict.** A short madd is not a wrong word. It
   belongs in the summary as separate, quieter feedback, and it must stay off
   by default: `stopOnMistake` exists because being buzzed at is not
   everyone's way of learning, and this is far more true of tajweed.

### The line not to cross

The authors are explicit that the model must **never** be used to judge
ikhfaa, idghaam or similar quality contrasts - it has no information about
them. Madd length is the one duration contrast the timings genuinely support.
Anything beyond it is invention, and inventing tajweed corrections for someone
memorising the Qur'an is the worst thing this feature could do.

---

## Not recommended: fine-tuning the model

Permitted by NPL-1.2 (derivatives allowed, share-alike applies) and we have a
large reciter library — but it needs k2/icefall, GPUs, and above all _learner_
audio, which is the data we lack and Tarteel has years of. Revisit only if
Tiers 1–4 are exhausted and the accuracy still isn't enough.

Also out of our control, and documented by the authors: children score 2–3×
worse, and the model must never judge ikhfaa or similar quality contrasts.

---

## Verification

- `npx vitest run src/features/recitation-practice` after each model change.
- Bench, against the 663-clip set and the runner the app matches:

  ```bash
  node scripts/tasmee/evaluate.mjs --runner zipformer-app     --fixtures scripts/tasmee/fixtures-large
  ```

  Must hold at or beat **38/306 false accepts (12.4%) and 15/357 false
  rejects (4.2%)**. False rejects rising is the regression that matters most:
  accusing a correct reciter is the worst thing this feature can do, and it is
  the reason `SKIP_CONFIRMS_BELOW` exists rather than simply believing the
  cursor.

- Cursor, which the verdict bench cannot see:

  ```bash
  node scripts/tasmee/cursor.mjs && node scripts/tasmee/skips.mjs
  node scripts/tasmee/stumbles.mjs
  ```

  Must hold at or beat **98.2% of words lit** on correct recitations (all but
  each clip's last) and **17 spurious skips**. Every word the cursor leaves
  behind must be reported in exactly one of `completed` or `skipped`; the
  tracker's tests assert that invariant directly, because the one bug the
  bench could not see was a word in neither. Spurious skips are now load-
  bearing: each one is a chance to accuse someone who recited correctly.

  `stumbles.mjs` must hold at or beat **8/689 (1.2%) of `as-recited` clips
  reporting a stumble** and **197/1698 (11.6%) of mistakes missed once the
  stumbles are listed**. The first is the new way to accuse a correct reciter
  and the one to watch; the second is what listing them buys.

- Browser, against the dev server with `.models/` served at `/models/`: start
  تسميع on page 1, confirm the page hides, the cursor advances word by word,
  and misreads mark. Use a looping `MediaStreamDestination` fed from a fixture
  clip as a synthetic microphone, with `AudioContext.resume()` — a context
  created after the model load starts suspended.
- `npm run check` must exit 0 before handoff.
