/*
 * A Qur'an-tuned Whisper, with a matcher that uses the known text properly.
 *
 * Needs no permission: tarteel-ai/whisper-base-ar-quran is Apache-2.0 and
 * ungated, so this answers "is a Qur'an model actually good at this" without
 * waiting on anyone. It is the model the app already offers as its opt-in
 * "good" option, so it is also a measurement of what the app could do today.
 *
 * Two things differ from `baseline.mjs`, and the report separates them:
 *  - the model is Qur'an-tuned rather than generic whisper-tiny
 *  - the transcript is aligned to the expected words rather than walked with
 *    a bag-of-characters test
 *
 * It is still Whisper, so its decoder carries a language model and may repair
 * a reciter's mistake into the verse it expects - exactly the failure
 * docs/tasmee-investigation.md §1.3 predicts. That prediction is the thing
 * this run is really testing.
 */
import { pipeline } from "@huggingface/transformers";

/** Override to compare sizes: TASMEE_MODEL=... node scripts/tasmee/evaluate.mjs --runner tarteel */
const MODEL_ID =
  process.env.TASMEE_MODEL ??
  "eventhorizon0/tarteel-ai-onnx-whisper-base-ar-quran";
/** The encoder dominates the cost, so it is the one worth quantising. */
const ENCODER_DTYPE = process.env.TASMEE_ENCODER_DTYPE ?? "fp32";

export const name = `${MODEL_ID.split("/").pop()} (${ENCODER_DTYPE} encoder) + word alignment`;

/*
 * Placed in a gap, not fitted to a point.
 *
 * Measured over the 32 fixtures the word error rate came out 0.00-0.10 for
 * correct recitation and 0.25-2.00 for mistakes, with nothing in between -
 * 14 of the 20 correct clips scored exactly zero. Any threshold inside that
 * gap gives the same answer, which is a very different thing from a number
 * tuned until the score looked good.
 *
 * 32 clips of professional reciters is still a small, kind sample. A learner
 * on a phone microphone is the test that matters.
 */
const ERROR_RATE_THRESHOLD = 0.18;

const DIACRITICS_RE = /[ً-ٰٟۖ-ۭـ]/g;

function normalize(text) {
  return text
    .replace(DIACRITICS_RE, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Word-level edit distance between what was expected and what was heard.
 *
 * This is the honest way to use a transcript against a known text: line the
 * two sequences up and count what had to change. Unlike the bag-of-characters
 * test it respects order, so a transposition is a mistake rather than a match.
 */
function alignmentErrors(expected, spoken) {
  const rows = expected.length + 1;
  const cols = spoken.length + 1;
  const table = Array.from({ length: rows }, () => new Int32Array(cols));

  for (let i = 0; i < rows; i += 1) table[i][0] = i;
  for (let j = 0; j < cols; j += 1) table[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const substitution =
        table[i - 1][j - 1] + (expected[i - 1] === spoken[j - 1] ? 0 : 1);
      table[i][j] = Math.min(
        substitution,
        table[i - 1][j] + 1,
        table[i][j - 1] + 1,
      );
    }
  }
  return table[expected.length][spoken.length];
}

export async function createJudge() {
  const transcriber = await pipeline("automatic-speech-recognition", MODEL_ID, {
    dtype: { encoder_model: ENCODER_DTYPE, decoder_model_merged: "q4" },
  });

  return async function judge({ audio, expectedWords }) {
    const output = await transcriber(audio, {
      return_timestamps: false,
      // Some verses run past Whisper's 30s window; without chunking they are
      // silently truncated.
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    const spoken = normalize(output.text ?? "")
      .split(/\s+/)
      .filter(Boolean);
    const expected = expectedWords.map(normalize).filter(Boolean);

    const errors = alignmentErrors(expected, spoken);
    const rate = errors / Math.max(1, expected.length);

    return {
      verdict: rate > ERROR_RATE_THRESHOLD ? "mistake" : "correct",
      detail:
        `rate ${rate.toFixed(2)} (${errors}/${expected.length} words) — ` +
        `"${(output.text ?? "").trim().slice(0, 55)}"`,
    };
  };
}
