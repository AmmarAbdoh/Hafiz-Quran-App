# تسميع — investigation before rebuilding

**Written for:** the person deciding what to build, before any code is written.

This establishes what went wrong, reframes the problem, and narrows the field
to two candidates.

**Decided (2026-09-17):** no tajweed judging in v1 · a 150-400MB download is
acceptable, so on-device is on the table and audio never has to leave the
device · word-by-word highlighting is wanted, but may be deferred if it is
what makes this hard.

---

## 1. What is in the repo now, and why it disappointed

Four findings, all read from the code rather than remembered.

### 1.1 The default model is the weakest one available

`practiceConfig.ts:18`

```ts
export const DEFAULT_PRACTICE_MODEL_ID = WHISPER_MODEL_GENERIC_TINY; // Xenova/whisper-tiny
```

That is **generic multilingual Whisper tiny** — the smallest, most error-prone
model OpenAI shipped, on a language it handles poorly, reciting classical
Arabic with elongations and no punctuation.

Meanwhile `tarteel-ai/whisper-base-ar-quran`, already listed in the same file
as an option, reports **5.75% WER** on Quranic recitation. The Quran-specific
models are opt-in, described in a settings sheet, and 150–400MB.

So the feature everybody tried was the worst configuration it ships with.

### 1.2 The matcher is a bag of characters

`shared/lib/arabic-normalize.ts:39`

```ts
let matches = 0;
for (const char of shorter) {
  if (longer.includes(char)) matches += 1;
}
return matches / shorter.length >= 0.75;
```

This ignores order. `كتب` and `بتك` score 100%. Arabic words are built from
shared three-letter roots, so near-neighbours are everywhere in a page of
Quran. This accepts wrong recitation constantly, which is worse than
rejecting correct recitation — it silently teaches mistakes.

### 1.3 A general ASR actively hides the mistakes you are looking for

This is the deepest of the four, and it is not about accuracy.

Whisper is an encoder-decoder whose decoder carries a language model. Given
half-recognised audio of a famous verse, it emits the verse it _expects_ -
that is what makes it good at transcription and useless here. It silently
repairs the reciter's mistake before the matcher ever sees it, so the app
says "correct" precisely when the reciter most needed to be told otherwise.

A bigger Whisper is a _better_ repairer. Scaling the model up makes this
worse, not better.

The Quran-Lab model card names the principle directly: **"no language model,
anywhere"** - LM rescoring would mask recitation errors. Any model chosen for
tasmee' has to be judged on whether it will report what was actually said,
not what should have been said.

### 1.4 It throws away the one thing that makes this problem easy

The pipeline is: record → free transcription → normalise → fuzzy match.

**We already know, exactly, what the reciter is supposed to say.** Free
transcription asks the model to solve a far harder problem — _what words were
these, out of all Arabic_ — and then we try to repair its guess with string
distance. See §2.

### 1.5 It needs the network, per verse

`services/pageWordText.ts` fetches word-level text from `api.quran.com` for
every verse, at practice time. That breaks the offline promise of the PWA and
adds a round trip to a feature that is supposed to feel immediate.

The app already ships `aya_text_emlaey` on every verse in its own bundled
data — the standard (imlaei) orthography, which is the right form to match
speech against. Splitting that on whitespace gives the word list locally.

_(Worth knowing: the Uthmani script in the mushaf and the standard script an
ASR produces differ at byte level, concentrated in the superscript alef
U+0670. `normalizeArabicForMatch` already strips it, so this is handled — but
it is the classic way these systems break, and worth keeping a test on.)_

---

## 2. The reframe: this is alignment, not transcription

Tasmee' is **verification against a known text**. That is a different, much
easier problem than transcription, and the literature treats it separately —
it is called _forced alignment_.

|                             | free ASR (now)          | forced alignment                                     |
| --------------------------- | ----------------------- | ---------------------------------------------------- |
| question asked of the model | "what words are these?" | "where, if anywhere, does each expected word occur?" |
| search space                | all of Arabic           | ~10 known words                                      |
| failure mode                | invents plausible words | low confidence on the word actually missed           |
| model size needed           | large, to be accurate   | small — it never has to guess                        |
| gives you                   | a string to diff        | per-word timing **and confidence**                   |

Per-word confidence is exactly the product: _you skipped this word_, _you
hesitated here_, _this word was not what the page says_. A transcript diff
cannot tell hesitation from substitution; an alignment can.

CTC forced alignment is a standard, available primitive (`torchaudio.functional.forced_align`,
the MMS work behind it). The practical shape is an acoustic model emitting
frame-wise probabilities, then a constrained alignment of the known token
sequence against those frames.

**This change matters more than the model choice.** The same audio and the
same model gets dramatically more usable output when you stop asking it to
guess.

---

## 3. What actually exists — and it is better than expected

The field has moved. Purpose-built Qur'an CTC models are published, recent,
and in ONNX. Two are serious candidates; both are **exactly the architecture
§2 argues for**, and neither is a general ASR.

|                 | `Quran-Lab/zipformer_p-arabic-v3`                                             | `Muno459/fastconformer-quran`                        |
| --------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| params          | **65.5M**                                                                     | 114.6M                                               |
| architecture    | Zipformer2 + CTC                                                              | FastConformer Large + CTC                            |
| output          | phonemes — 251-symbol Qur'anic alphabet (madd, ghunna, qalqalah, ikhfaa)      | fully diacritized Arabic words                       |
| accuracy        | **PER 1.43%** studio · **3.65% real phone recordings** · 9.10% unseen reciter | **WER 5.41%**                                        |
| streaming       | **yes** — cache-aware chunks, 70x realtime on an iPhone 15 Pro                | offline; separate `-streaming` repo                  |
| error detection | forced alignment (model card recommends it over run-length)                   | `pronunciation_head.pt`, ~80% sensitivity at ~9% FPR |
| updated         | 2026-08-28                                                                    | 2026-08-15                                           |
| licence         | NPL-1.2                                                                       | NPL-1.1                                              |

For comparison, `fastconformer-quran` reports beating **Tarteel's production
model (9.56% WER)** and NVIDIA's own FastConformer (7.44%). The Tarteel model
this app currently offers as its "good" option is the weakest of the three.

**Both are small.** 65.5M parameters is _smaller than Whisper base_, and far
smaller than the 400MB download the current Tarteel option asks for. The
constraint you accepted turns out not to be needed.

### Three things this changes

1. **Word-by-word is not the hard part any more.** The zipformer is streaming
   and frame-synchronous by design — 6.8ms per chunk. The thing you were
   ready to defer is the thing this architecture does naturally. It was only
   hard because Whisper is the wrong shape for it.
2. **Phonemes are a better product than words.** A phoneme model can say
   _which sound_ was wrong inside a word. A word model can only say the word
   was wrong. Even with tajweed judging ruled out for v1, the tajweed-aware
   alphabet is there when you want it.
3. **The runtime has to change.** Neither runs under Transformers.js. They
   need **sherpa-onnx** (which ships browser WASM builds, with streaming
   Zipformer demos) or raw `onnxruntime-web`. See §4.

### The licence is a real decision

Both carry the **Quran-Lab No-Profit Licence**. Free to use, study and
redistribute; commercial use restricted.

The app already describes itself as _"a free, non-commercial app for reading,
memorization, and review"_, so this fits what Artqiy is today — but adopting
these models **forecloses ever charging for it**. That is a decision to make
deliberately now, not to discover later.

### Hosted, for completeness

| provider                      | cost/hour audio |
| ----------------------------- | --------------- |
| Groq (whisper-large-v3-turbo) | $0.04           |
| ElevenLabs Scribe v2 (batch)  | $0.22           |
| Deepgram Nova-3 (batch)       | ~$0.26          |

Now much less attractive: these are all general ASR, so §1.3 applies to every
one of them. They would transcribe beautifully and hide the mistakes.

### Training your own

**Recommended against, more strongly than before.** Two teams have published
Qur'an-specific CTC models in the last month, one at 1.43% PER. There is
nothing here for a solo developer to beat.

## 4. The real cost: the runtime, not the model

This is the honest price of the recommendation, and the main thing that could
make it a bad idea.

Today the worker calls one function and gets everything free:

```ts
pipeline("automatic-speech-recognition", modelId, { dtype });
```

Transformers.js does feature extraction, batching, decoding and tokenisation
behind that. **Neither candidate runs under it.** Going this way means owning,
in TypeScript:

- **feature extraction** — log-mel / fbank frames at 16kHz, matching exactly
  what the model was trained on (a mismatch here degrades silently, and is
  the classic way these integrations fail)
- **streaming cache management** — cache-aware chunks with the right left
  context, carried between chunks
- **CTC decoding** — greedy is enough; no beam search, no LM (§1.3)
- **forced alignment** — the expected tokens against the frame posteriors,
  plus per-word confidence
- **phoneme mapping** — for the zipformer, Uthmani text to its 251-symbol
  alphabet

Two ways to get it:

|                | sherpa-onnx WASM                             | `onnxruntime-web` directly   |
| -------------- | -------------------------------------------- | ---------------------------- |
| what you get   | features, streaming, CTC decoding, all of it | the tensors and nothing else |
| what you write | glue, plus alignment                         | everything in the list above |
| cost           | a WASM bundle alongside the model            | no extra bundle beyond ORT   |
| control        | its abstractions                             | complete                     |

**sherpa-onnx is the sane starting point** — it is the k2/icefall project's
own runtime, these models are published for it, and it has browser WASM
builds with streaming Zipformer demos already. Write alignment on top of its
output; do not reimplement fbank.

### Still ruled out

- **Training from scratch** — see §3.
- **Free transcription + string distance** — §1.3 and §1.4.
- **Whisper for word-by-word** — wrong shape. The rolling-window constants
  in `practiceConfig.ts` (`PRACTICE_ROLLING_CHUNK_MS = 550`,
  `PRACTICE_ROLLING_WINDOW_MS = 2200`) are a workaround for that, and they go
  away with a frame-synchronous model.

---

## 5. Recommended path

**Model:** `Quran-Lab/zipformer_p-arabic-v3`. Smallest, most accurate,
streaming by design, phoneme-level, explicitly built not to hide errors, and
it ships a `decode_with_confidence.py` to read alongside.
**Runtime:** sherpa-onnx WASM.
**Judgement:** forced alignment of the expected phonemes against the model's
frame posteriors — never a transcript diff.

`Muno459/fastconformer-quran` is the fallback: bigger and offline-only, but
it emits words rather than phonemes, which is a shorter path to something
working, and its `pronunciation_head` is purpose-built for mispronunciation.

### Before writing app code — one day, outside the app

The fixture set is still the first deliverable, and it is still the only
thing that answers "is this actually good".

1. **Fixtures.** The repo ships three demo clips; the app already streams
   professional recitation, which gives _correct_ examples cheaply. Build the
   _wrong_ ones by splicing: a dropped word, a word swapped from elsewhere in
   the page, a long hesitation, a wrong verse ending. Label the verdict each
   should get.
   **Then add your own voice** — a learner does not sound like Alafasy, and
   the 9.10% unseen-reciter figure is the honest warning about that.

2. **Score two pipelines** (a node script, not the app):
   - zipformer + forced alignment
   - today's whisper-tiny + bag-of-characters, as the baseline you already
     know is bad

3. **Report false accepts and false rejects**, not WER. A false accept
   teaches a mistake; that is the number that decides whether this ships.

If the zipformer path clears that bar on your own voice, the app work is
integration with a known-good pipeline instead of a hope.

---

## 6. The one question left

1. **Is audio leaving the device acceptable to you?** For recitation of
   Quran, in an app you built for yourself, this may be a hard no — and if it
   is, that settles hosted vs on-device before any benchmark.
2. **Is tasmee' allowed to require a 150–400MB download?** If yes, on-device
   is viable. If it must work on a cheap phone on mobile data, it is not.
3. **What counts as a mistake?** Skipping a word, obviously. But a
   mispronounced letter? A tajweed error? Ruling tajweed _out_ for v1 makes
   this tractable; ruling it in makes it a research project.
4. **Live or after the fact?** Word-by-word highlighting while reciting is a
   much harder engineering problem than "recite an ayah, then get told how it
   went." The second is genuinely useful and far cheaper to build well.

---

## Sources

- [Quran-Lab/zipformer_p-arabic-v3](https://huggingface.co/Quran-Lab/zipformer_p-arabic-v3) — 65.5M params, PER 1.43%, streaming, "no language model, anywhere"
- [Muno459/fastconformer-quran](https://huggingface.co/Muno459/fastconformer-quran) — 114.6M params, WER 5.41%, pronunciation head
- [Muno459/fastconformer-quran-streaming](https://huggingface.co/Muno459/fastconformer-quran-streaming) — cache-aware streaming variant
- [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) — browser WASM builds, streaming Zipformer

- [tarteel-ai/whisper-base-ar-quran](https://huggingface.co/tarteel-ai/whisper-base-ar-quran) — 5.75% WER
- [tarteel-ai on Hugging Face](https://huggingface.co/tarteel-ai) — models and the `everyayah` dataset
- [CTC forced alignment API tutorial (torchaudio)](https://docs.pytorch.org/audio/2.7.0/tutorials/ctc_forced_alignment_api_tutorial.html)
- [Towards a Unified Benchmark for Arabic Pronunciation Assessment: Quranic Recitation as Case Study](https://arxiv.org/pdf/2506.07722)
- [What Counts as a Mistake? Annotating Recitation Events in Quran Memorization Transcripts](https://arxiv.org/html/2609.12085)
- [A Corpus-Aligned Uthmani-to-Standard Quranic Word Mapping and a Deterministic Recitation Validator](https://arxiv.org/html/2609.14967)
- [Speech-to-Text APIs in 2026: Benchmarks, Pricing](https://futureagi.com/blog/speech-to-text-apis-in-2026-benchmarks-pricing-developer-s-decision-guide/)
- [Groq Speech-to-Text pricing](https://apio.sh/apis/groq-speech-to-text)
- [Real-time Whisper WebGPU (Xenova)](https://huggingface.co/spaces/Xenova/realtime-whisper-webgpu)
