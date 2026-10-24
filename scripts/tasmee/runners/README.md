# Runners

A runner is one candidate pipeline. `evaluate.mjs` knows nothing about models;
it hands each runner audio and the expected text, and records the verdict.

## Contract

```js
export const name = "short label for the report";

export async function createJudge() {
  // load the model once, here
  return async function judge({
    audio,
    expectedText,
    expectedWords,
    verseKey,
  }) {
    // audio: Float32Array, mono, 16kHz
    return {
      verdict: "correct" | "mistake",
      detail: "one line for the report",
      words: [{ text, ok, confidence }], // optional
    };
  };
}
```

`verdict` is the only field scored. Everything else is for reading.

## What is here

| runner                  | what it is                                                           |
| ----------------------- | -------------------------------------------------------------------- |
| `baseline.mjs`          | here to be beaten, not kept                                          |
| `dtw.mjs`               | template matching on MFCCs; no model                                 |
| `tarteel.mjs`           | the comparison target                                                |
| `zipformer.mjs`         | free decode, then an edit distance against the expected text         |
| `zipformer-aligned.mjs` | forced alignment only — the verdict with the cursor blinded          |
| `zipformer-app.mjs`     | **what the app does**: forced alignment plus the live cursor's skips |

`zipformer.mjs` is kept to show the difference the question makes: a free
decode asks "what did he say?" and then diffs, which is a blunt error rate
that loses a wrong ending in the arithmetic of a long verse. The aligned
runners ask "did he say _this_?" and get a calibrated probability per word.
See `docs/tasmee-investigation.md` §2.

`zipformer-aligned.mjs` and `zipformer-app.mjs` differ in one input, and both
call the app's own `findMisreadWords`, so the gap between them is exactly what
the cursor's evidence is worth — currently 22.2% of mistakes missed against
12.1%. `docs/tasmee-improvements.md` has the measurements.

Requirements for all three zipformer runners: the weights in `.models/`
(`TASMEE_ZIPFORMER_DIR` to move them) and Hugging Face gate acceptance to
fetch them in the first place. They run under `onnxruntime-node`, sharing the
app's own filterbank, symbol table and CTC code so the bench cannot drift
from what ships.
