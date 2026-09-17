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
