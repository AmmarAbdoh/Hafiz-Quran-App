/*
 * What the app does today, so there is a floor to measure against.
 *
 * Generic whisper-tiny, then the bag-of-characters matcher. This runner is
 * here to be beaten: if a candidate cannot beat it, the candidate is not
 * worth integrating, and if it barely beats it the problem is elsewhere.
 *
 * The two matching functions are copied from
 * `src/shared/lib/arabic-normalize.ts` rather than imported, because this
 * harness is plain ESM and the app is TypeScript. They are a snapshot of what
 * ships today; if that file changes, this does not, and that is fine - the
 * baseline is a fixed reference point, not a live mirror.
 */
import { pipeline } from "@huggingface/transformers";

export const name = "baseline: whisper-tiny + bag-of-characters";

const DIACRITICS_RE = /[ً-ٰٟۖ-ۭـ]/g;
const ARABIC_INDIC_DIGITS_RE = /[٠-٩]/g;

function normalizeArabicForMatch(text) {
  return text
    .replace(ARABIC_INDIC_DIGITS_RE, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(DIACRITICS_RE, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function arabicTokensSimilar(spoken, expected) {
  if (!spoken || !expected) return false;
  if (spoken === expected) return true;
  if (spoken.includes(expected) || expected.includes(spoken)) return true;

  const minLen = Math.min(spoken.length, expected.length);
  if (minLen < 2) return spoken === expected;

  let matches = 0;
  const shorter = spoken.length <= expected.length ? spoken : expected;
  const longer = spoken.length > expected.length ? spoken : expected;
  for (const char of shorter) {
    if (longer.includes(char)) matches += 1;
  }
  return matches / shorter.length >= 0.75;
}

export async function createJudge() {
  const transcriber = await pipeline(
    "automatic-speech-recognition",
    "Xenova/whisper-tiny",
    { dtype: "q8" },
  );

  return async function judge({ audio, expectedWords }) {
    const output = await transcriber(audio, {
      language: "arabic",
      task: "transcribe",
      return_timestamps: false,
      // Some verses run past Whisper's 30s window - 2:255 and 2:286 both do.
      // Without chunking they are silently truncated and the baseline is
      // handicapped rather than measured.
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    const spoken = normalizeArabicForMatch(output.text ?? "")
      .split(/\s+/)
      .filter(Boolean);
    const expected = expectedWords.map(normalizeArabicForMatch);

    /*
     * The app's aligner walks a pointer through the expected words and
     * advances it whenever a spoken token looks near enough. Reproduced here
     * so the baseline fails the way the app fails.
     */
    let pointer = 0;
    for (const token of spoken) {
      if (pointer >= expected.length) break;
      if (arabicTokensSimilar(token, expected[pointer])) pointer += 1;
    }

    const reached = pointer / Math.max(1, expected.length);
    return {
      verdict: reached >= 0.9 ? "correct" : "mistake",
      detail: `matched ${pointer}/${expected.length} words — "${(output.text ?? "").trim().slice(0, 60)}"`,
    };
  };
}
