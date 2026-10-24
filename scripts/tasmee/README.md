# تسميع — does the model actually catch mistakes?

A bench for judging recitation pipelines **outside the app**. It exists
because the last attempt went into the app first and was only found to be bad
by using it.

It answers one question:

> How often does it say "correct" when the recitation was wrong?

That is a **false accept**, and it is the number that decides whether tasmee'
can ship. A false accept teaches a mistake. A false reject is only annoying.

## Run it

```bash
node scripts/tasmee/build-fixtures.mjs        # ~1 min, needs ffmpeg + network
node scripts/tasmee/evaluate.mjs --runner baseline
```

For the pipeline the app actually runs, against the large set:

```bash
node scripts/tasmee/build-word-fixtures.mjs   # 663 clips from word timestamps
node scripts/tasmee/evaluate.mjs --runner zipformer-app   --fixtures scripts/tasmee/fixtures-large
```

Each script below caches its model pass, so only the first run costs ten
minutes and every question after it is answered in a second:

| script          | what it answers                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `sweep.mjs`     | per-word alignment scores, and the threshold curve over them                                       |
| `rules.mjs`     | whether a different shape of verdict rule does better                                              |
| `aggregate.mjs` | how a word's many phonemes should become one score                                                 |
| `cursor.mjs`    | whether the **live cursor** keeps up: words lit, stalls, spurious skips                            |
| `skips.mjs`     | what the cursor's report is worth to the verdict, and how strictly to believe it                   |
| `stumbles.mjs`  | what the cursor's stumble is worth: how often it fires on a clean run, and what listing it catches |
| `dropped.mjs`   | which sounds the model does not emit, per expected unit and per word-opening unit                  |

## Three fixture sets, and what each is for

| set              | clips | each clip     | what only it can show                               |
| ---------------- | ----- | ------------- | --------------------------------------------------- |
| `fixtures`       | 32    | one ayah      | the original curated mistakes; too small to tune on |
| `fixtures-large` | 663   | one ayah      | enough mistakes to choose a rule from               |
| `fixtures-page`  | 171   | 3.6 ayat avg. | everything that only goes wrong at page scale       |

`build-page-fixtures.mjs` makes the third from audio the second already
cached, so it downloads no recitation. It exists because two things the reader
does on every run are invisible on a single ayah:

- The cursor's **resync searches the whole passage**, so a false match gets
  likelier the longer the passage. A page offers roughly ten times as many
  places to go wrong as one ayah, and that is what "it seem I can skip" turned
  out to be. Three phonemes in common now only move it within eight words;
  further than that the whole six-phoneme stray run has to agree, and the
  nearest match wins in either direction so going back over a few words is
  followed back rather than carried ahead.
- The **one-weak-word tolerance is per ayah**, so a page spends that budget
  once per ayah. Whether a real mistake in the ninth ayah still stands out is
  not a question one ayah can answer.

It also carries two mistake kinds that cannot exist in a single ayah:
`ayah-dropped`, a whole verse missed out, and `ayah-repeated`, a verse recited
twice — which must **pass**, because going back over an ayah is how people
memorise.

`cursor.mjs`, `skips.mjs` and `stumbles.mjs` exist because everything else
here measures the verdict, and the cursor — the part a reciter watches — went
unmeasured until it was reported broken from real use.

`dropped.mjs` answers "is this sound the model's problem or this
microphone's". It was written because a learner was stopped for twenty-six
seconds at فَوَيلْ لِّلْمُصَلِّينَ having recited it correctly: the model
emitted every phoneme of it but the opening فَ, three attempts running, while
over the correct clips here that symbol is heard 99.2% of the time. Before
changing the cursor for one reciter, check what the model does for everyone.

`stumbles.mjs` measures the one mistake no pass over the audio can find. A
word said wrongly and then said correctly is in the recording twice; the
alignment places each label once and places it on the attempt that supports
it, so the word scores well and the run comes back clean. Only the live cursor
was there for the first attempt.

`build-fixtures.mjs` pulls per-ayah recitation from everyayah.com — the same
source the app already streams — and constructs mistakes from it. Per-ayah
files give exact verse boundaries, so a mistake can be built without the
word-level alignment we do not have yet.

## What is in the set

32 clips: 20 that should pass, 12 that should not.

| kind             | verdict     | what it is                                                            |
| ---------------- | ----------- | --------------------------------------------------------------------- |
| `as-recited`     | correct     | untouched, three reciters, so "correct" is not one voice              |
| `hesitation`     | **correct** | 2.5s pause mid-verse, every word right — must not be called a mistake |
| `stopped-early`  | mistake     | dries up partway                                                      |
| `skipped-middle` | mistake     | 25% cut out of the middle                                             |
| `wrong-ending`   | mistake     | slides into the neighbouring verse's ending                           |
| `wrong-verse`    | mistake     | recites a different ayah entirely                                     |

`wrong-ending` is the one that matters most: mixing up similar adjacent
verses is _the_ classic memorization failure. `hesitation` is the one that
separates a real system from a crude one — the words are all correct, so
pausing must not be punished.

## The baseline, measured

What the app ships today — generic `whisper-tiny` plus the bag-of-characters
matcher:

```
FALSE ACCEPTS  0/12  (0.0%)
false rejects  18/20 (90.0%)
overall        14/32
```

**It rejects 18 of 20 correct recitations.** It scores zero false accepts
only because it calls almost everything wrong — the degenerate case. This is
what "it was bad" measures as, and it is why both numbers are always
reported: either one alone can be gamed by a system that always answers the
same way.

## Adding your own voice

**The synthetic set can only reject a model, never approve one.** These are
professional reciters with clips spliced by ffmpeg; you are a learner making
real mistakes, and the zipformer's own card reports 3.65% PER on real phone
recordings against 1.43% in studio. Your voice is the test that counts.

1. Record clips as WAV, mono, 16kHz — phone mic, where it will really be used.
2. Put them in `scripts/tasmee/fixtures/recorded/`.
3. Add an entry per clip to `manifest.json`:

```json
{
  "id": "mine-2_255-skipped",
  "audio": "recorded/mine-2_255-skipped.wav",
  "verseKey": "2:255",
  "expectedText": "<the imlaei text of that verse>",
  "verdict": "mistake",
  "kind": "skipped-middle",
  "note": "dropped a word after الحي"
}
```

Aim for ~20: half correct, half with one deliberate mistake each. Record the
mistakes you actually make, not tidy ones.

## Adding a model

See `runners/README.md`. `baseline.mjs` is there to be beaten, and the
judgement in a real runner should be a **forced alignment** against the
expected words — never a diff of a free transcript. `docs/tasmee-investigation.md`
§2 is why.
