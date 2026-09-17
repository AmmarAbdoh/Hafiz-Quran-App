# تسميع — investigation before rebuilding

**Written for:** the person deciding what to build, before any code is written.

This does not recommend a model. It establishes what went wrong, reframes the
problem, prices the options, and proposes one cheap experiment that settles
the question with evidence instead of opinion.

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

### 1.3 It throws away the one thing that makes this problem easy

The pipeline is: record → free transcription → normalise → fuzzy match.

**We already know, exactly, what the reciter is supposed to say.** Free
transcription asks the model to solve a far harder problem — _what words were
these, out of all Arabic_ — and then we try to repair its guess with string
distance. See §2.

### 1.4 It needs the network, per verse

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

## 3. The options, with real numbers

### On-device

| option                                   | download | notes                                             |
| ---------------------------------------- | -------- | ------------------------------------------------- |
| generic whisper-tiny _(today's default)_ | ~40MB    | fast, unusable accuracy for this                  |
| Tarteel tiny (Quran) ONNX                | ~150MB   | Quran-tuned, already wired up as an option        |
| Tarteel base (Quran) ONNX                | ~400MB   | **5.75% WER** reported; heavy first load          |
| CTC acoustic model + alignment           | smaller  | no free-decoding, so a smaller model goes further |

WebGPU gives roughly **5–10× over WASM** for this class of model, needs
~1–1.5GB VRAM for a ~400MB model, and is reliable on Chromium; Firefox's ONNX
WebGPU path is flaky. Transformers.js falls back to WASM automatically —
which is where a phone without WebGPU lands, and where "it was slow" comes
from.

**On-device buys:** offline, zero cost, no recitation audio leaving the
device — which matters more here than in most apps.
**On-device costs:** a 150–400MB first download, and the worst devices get
the worst experience.

### Hosted

| provider                      | cost/hour audio |
| ----------------------------- | --------------- |
| Groq (whisper-large-v3-turbo) | **$0.04**       |
| ElevenLabs Scribe v2 (batch)  | $0.22           |
| Deepgram Nova-3 (batch)       | ~$0.26          |
| Deepgram (streaming)          | ~$0.46          |

At Groq's rate, 30 minutes of recitation a day is about **$0.60 per user per
month**. Trivial for personal use; a real line item if this is ever shared
widely and free.

**Hosted buys:** a large accurate model with no download, same on every
device.
**Hosted costs:** a backend and API keys the app does not currently have,
latency on every phrase, no offline, and recitation audio going to a third
party.

### Training your own

**Recommended against.** Tarteel fine-tuned Whisper on their `everyayah`
dataset and published 5.75% WER. Matching that needs comparable labelled
recitation data and is a months-long detour from a memorization app. The
honest version of "train my own" here is _fine-tune an existing Quran model
on my own voice_ — worth considering **only** if §5 shows a general model
fails specifically on your recitation.

---

## 4. What I would rule out now

- **Training from scratch.** See above.
- **Keeping free transcription + string distance.** Even with a perfect
  model this cannot distinguish hesitation from substitution.
- **Whisper for live word-by-word tracking.** Whisper is a sequence model
  over 30-second windows; it is the wrong shape for "highlight the word as
  it is recited". The current rolling-window hack (`PRACTICE_ROLLING_CHUNK_MS
= 550`, `PRACTICE_ROLLING_WINDOW_MS = 2200`) is fighting the architecture.
  Streaming word tracking wants a frame-synchronous CTC model.

---

## 5. The experiment to run before building anything

**Do not pick an architecture from this document. Measure, on your own voice,
in a day.**

1. **Record a fixture set.** 20–30 clips of yourself reciting known pages.
   Deliberately include: a skipped word, a substituted word, a long
   hesitation, a wrong verse ending, and several _correct_ recitations.
   Label what each one should be judged as. This fixture set is the real
   deliverable — every option below gets scored against the same clips, and
   it stays useful forever.

2. **Score four pipelines offline** (a script, not the app):
   - today's: generic whisper-tiny + bag-of-characters
   - Tarteel base ONNX + the same matcher _(isolates the model)_
   - Tarteel base ONNX + proper alignment _(isolates the matcher)_
   - a hosted API + proper alignment _(the ceiling)_

3. **Report two numbers that matter**, not WER:
   - **false accepts** — recited wrong, app said fine _(the one that makes it
     worthless — it teaches mistakes)_
   - **false rejects** — recited right, app complained _(the one that makes it
     infuriating)_

   plus latency from end-of-word to feedback on a real phone.

The gap between rows 1 and 2 tells you whether the model was the problem. The
gap between 2 and 3 tells you whether the matcher was. The gap between 3 and
4 tells you whether on-device is good enough. **That is the whole decision,
and it is one day of work.**

---

## 6. Questions only you can answer

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

- [tarteel-ai/whisper-base-ar-quran](https://huggingface.co/tarteel-ai/whisper-base-ar-quran) — 5.75% WER
- [tarteel-ai on Hugging Face](https://huggingface.co/tarteel-ai) — models and the `everyayah` dataset
- [CTC forced alignment API tutorial (torchaudio)](https://docs.pytorch.org/audio/2.7.0/tutorials/ctc_forced_alignment_api_tutorial.html)
- [Towards a Unified Benchmark for Arabic Pronunciation Assessment: Quranic Recitation as Case Study](https://arxiv.org/pdf/2506.07722)
- [What Counts as a Mistake? Annotating Recitation Events in Quran Memorization Transcripts](https://arxiv.org/html/2609.12085)
- [A Corpus-Aligned Uthmani-to-Standard Quranic Word Mapping and a Deterministic Recitation Validator](https://arxiv.org/html/2609.14967)
- [Speech-to-Text APIs in 2026: Benchmarks, Pricing](https://futureagi.com/blog/speech-to-text-apis-in-2026-benchmarks-pricing-developer-s-decision-guide/)
- [Groq Speech-to-Text pricing](https://apio.sh/apis/groq-speech-to-text)
- [Real-time Whisper WebGPU (Xenova)](https://huggingface.co/spaces/Xenova/realtime-whisper-webgpu)
