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

## Adding the zipformer

`baseline.mjs` is here to be beaten, not kept. The real comparison is against
`Quran-Lab/zipformer_p-arabic-v3`, which needs two things first:

1. **Accept the gate.** Sign in to Hugging Face, open the model page, accept
   the terms. It is auto-approved. The files cannot be downloaded otherwise.
2. **A runtime.** The model is Zipformer2 + CTC and does not run under
   Transformers.js. Use sherpa-onnx (it ships browser and Node WASM builds,
   with streaming Zipformer examples) rather than reimplementing fbank.

Then write `zipformer.mjs` against the contract above. The judgement should be
a **forced alignment** of `expectedWords` against the model's frame
posteriors — never a diff of free transcript against expected text. That
distinction is the whole point; see `docs/tasmee-investigation.md` §2.
