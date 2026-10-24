/** Xenova ONNX — classic quant format, works in browser ORT. */
const WHISPER_MODEL_GENERIC_SMALL = "Xenova/whisper-small";
const WHISPER_MODEL_GENERIC_TINY = "Xenova/whisper-tiny";

const WHISPER_MODEL_LEGACY_ONNX_SMALL = "onnx-community/whisper-small";
const WHISPER_MODEL_LEGACY_ONNX_TINY = "onnx-community/whisper-tiny";
/** Community ONNX export of tarteel-ai/whisper-base-ar-quran (transformers.js). */
const WHISPER_MODEL_TARTEEL_BASE_QURAN =
  "eventhorizon0/tarteel-ai-onnx-whisper-base-ar-quran";
/** Community ONNX export of Tarteel tiny Quran model. */
const WHISPER_MODEL_TARTEEL_TINY_QURAN =
  "omartariq612/tarteel-ai-whisper-tiny-ar-quran-onnx";
/*
 * Offered until it was measured, and it cannot work here.
 *
 * Its decoder is a newer export whose graph requires a `cache_position`
 * input, and the string `cache_position` does not appear anywhere in this
 * version of transformers.js - the runtime never sends it, so every phrase
 * fails with "Missing the following inputs: cache_position". It also ships no
 * q4 decoder, so the q4 attempt 404s and the fp32 fallback is what loads and
 * then dies at execution. It was listed as the thing to try when Tarteel Base
 * disappointed, which walked people straight into it.
 */
const WHISPER_MODEL_SOFTMILLS_BASE_QURAN =
  "softmills/whisper-base-ar-quran-onnx";
const WHISPER_MODEL_ARABIC_LEGACY = "onnx-community/whisper-base-ar-ONNX";

/*
 * A Qur'an-tuned model, not a generic one.
 *
 * The default was generic whisper-tiny - the smallest multilingual model
 * OpenAI shipped, on classical Arabic - so the configuration everybody tried
 * was the worst one available. Measured against 32 labelled clips
 * (scripts/tasmee), generic whisper-tiny with the old matcher rejected 18 of
 * 20 correct recitations; this model with word alignment got all 32 right,
 * and at a median 3.0s against the base model's 7.8s for the same score.
 */
/**
 * The streaming phoneme recogniser, and the reason the Whisper era is over.
 *
 * Measured on the same 32 fixtures as everything else: 3.08% phoneme error
 * against Whisper tiny's 27-73% word error, and it decodes 22x faster than
 * real time. It is also the only one of these that can be followed word by
 * word while someone is still speaking - Whisper has a fixed 30 second window
 * and is not frame synchronous, so it never could be.
 */
const PRACTICE_STREAMING_MODEL_ID = "quran-lab/zipformer_p-arabic-v3.1";

/*
 * Where the streaming phoneme recogniser's files live.
 *
 * The weights are gated on Hugging Face, so a browser cannot fetch them from
 * there and they are too large to commit. In development Vite serves them
 * from `.models/`; a production build has to be told where they are hosted,
 * with all three `VITE_PRACTICE_*_URL` variables - and `connect-src` in
 * vercel.json has to allow that origin.
 */
const configured = import.meta.env as Record<string, string | undefined>;

/**
 * Whether this build can reach the streaming model at all.
 *
 * The dev server serves `/models/` and nothing else does: in production that
 * path falls through to the SPA rewrite, which answers every file with
 * index.html and a 200. Defaulting to the model there broke تسميع for every
 * reader, including everyone the migration below moved onto it.
 */
export const STREAMING_MODEL_AVAILABLE =
  /*
   * In development, only when the gated weights are really on the machine.
   * `vite.config.ts` looks for them and answers here, because assuming they
   * were present broke تسميع by default on a fresh clone - and migrated the
   * contributor's stored model preference onto the one that cannot load.
   */
  (import.meta.env.DEV && configured.VITE_PRACTICE_MODELS_PRESENT === "true") ||
  /*
   * All three, because the engine needs all three.
   *
   * Checking only the weights let a build that set `VITE_PRACTICE_MODEL_URL`
   * alone turn streaming on and then fail on the tokens and the phoneme
   * table, which fall back to `/models/` and answer with index.html.
   */
  [
    configured.VITE_PRACTICE_MODEL_URL,
    configured.VITE_PRACTICE_TOKENS_URL,
    configured.VITE_PRACTICE_PHONEMES_URL,
  ].every((url) => Boolean(url));

/*
 * Until it is hosted, the best of the Whisper models: Qur'an-tuned, and it
 * got all 32 of the original fixtures right at a median 3.0s. Offered only
 * then, which is also what keeps its decoder options below in use.
 */
export const DEFAULT_PRACTICE_MODEL_ID = STREAMING_MODEL_AVAILABLE
  ? PRACTICE_STREAMING_MODEL_ID
  : WHISPER_MODEL_TARTEEL_TINY_QURAN;

export function isStreamingPracticeModel(modelId: string): boolean {
  return modelId === PRACTICE_STREAMING_MODEL_ID;
}

/**
 * The models a reader can choose between.
 *
 * `key` names the `settings:practice.models.*` entry that labels it. The
 * labels used to be written here in Arabic, which an English reader saw
 * untranslated; the group is structure and stays.
 */
export const PRACTICE_MODEL_OPTIONS: Record<
  string,
  {
    /* A literal union, so the i18n key it builds is checked. */
    key: "streaming" | "tarteelTiny" | "genericTiny" | "genericSmall";
    group: "generic" | "quran" | "streaming";
  }
> = {
  ...(STREAMING_MODEL_AVAILABLE
    ? {
        [PRACTICE_STREAMING_MODEL_ID]: {
          key: "streaming",
          group: "streaming" as const,
        },
      }
    : {
        [WHISPER_MODEL_TARTEEL_TINY_QURAN]: {
          key: "tarteelTiny",
          group: "quran" as const,
        },
      }),
  [WHISPER_MODEL_GENERIC_TINY]: {
    key: "genericTiny",
    group: "generic",
  },
  [WHISPER_MODEL_GENERIC_SMALL]: {
    key: "genericSmall",
    group: "generic",
  },
};

/*
 * `||`, not `??`: an env file with `VITE_PRACTICE_MODEL_URL=` and nothing
 * after it gives an empty string, and `??` kept it. `fetch("")` resolves to
 * the page's own URL, which answers with HTML and fails inside the ONNX
 * parser instead of here. `STREAMING_MODEL_AVAILABLE` tests the same three
 * values for truthiness, so the two have to agree on what "unset" means.
 */
export const PRACTICE_MODEL_URL =
  configured.VITE_PRACTICE_MODEL_URL ||
  "/models/zipformer/zipformer_p_arabic_v3.1.int8.onnx";
export const PRACTICE_TOKENS_URL =
  configured.VITE_PRACTICE_TOKENS_URL || "/models/zipformer/tokens.txt";
export const PRACTICE_PHONEMES_URL =
  configured.VITE_PRACTICE_PHONEMES_URL ||
  "/models/zipformer/ordered_quran_phonemes.json";

export const PRACTICE_MODEL_STORAGE_KEY = "quran-practice-whisper-model";
/** When true, every weak word is marked; see `STRICT_WEAK_WORDS_TOLERATED`. */
export const PRACTICE_STRICT_STORAGE_KEY = "quran-practice-strict";
/** When true, a wrong word stops the run, sounds, and shows what it should be. */
export const PRACTICE_STOP_ON_MISTAKE_STORAGE_KEY =
  "quran-practice-stop-on-mistake";
/** When true, unrevealed ayat text is hidden (underline placeholders) during تسميع. */
export const PRACTICE_HIDE_AYAT_STORAGE_KEY = "quran-practice-hide-ayat";
/** Diagnostics panel: what was heard, and what the microphone is doing. */
export const PRACTICE_DEBUG_STORAGE_KEY = "quran-practice-debug";
export const PRACTICE_SAMPLE_RATE = 16000;
/**
 * How long to wait for the verdict before calling it failed.
 *
 * Sixty seconds, against a measured 5.2s median and 23s worst case for a
 * whole page - so no real run is ever cut off by it. It is not a performance
 * budget but a way out: once scoring has begun both stop buttons stand aside
 * for the verdict, so a recogniser that dies without answering takes the
 * reader's only two exits with it and leaves the bar checking for good.
 */
export const VERDICT_TIMEOUT_MS = 60_000;
/** Pause after speech before final phrase check. */
export const PRACTICE_SILENCE_MS = 400;
export const PRACTICE_MIN_SPEECH_MS = 250;
export const PRACTICE_MAX_PHRASE_MS = 8000;
/** Emit rolling audio for live STT while the user is still speaking. */
export const PRACTICE_ROLLING_CHUNK_MS = 550;
export const PRACTICE_ROLLING_WINDOW_MS = 2200;
export const PRACTICE_MIN_ROLLING_MS = 350;
export const PRACTICE_SPEECH_RMS_THRESHOLD = 0.012;
export const PRACTICE_WRONG_FLASH_MS = 700;

/*
 * Carried onto the current default rather than onto generic tiny.
 *
 * Anyone holding one of these ids tried the feature when it did not work.
 * Leaving them on a generic model would leave them there; the point of the
 * migration is to move them to the one that does.
 */
const LEGACY_MODEL_MIGRATION: Record<string, string> = {
  [WHISPER_MODEL_LEGACY_ONNX_SMALL]: DEFAULT_PRACTICE_MODEL_ID,
  [WHISPER_MODEL_LEGACY_ONNX_TINY]: DEFAULT_PRACTICE_MODEL_ID,
  [WHISPER_MODEL_ARABIC_LEGACY]: DEFAULT_PRACTICE_MODEL_ID,
  [WHISPER_MODEL_SOFTMILLS_BASE_QURAN]: DEFAULT_PRACTICE_MODEL_ID,
  /*
   * Both worked, neither well enough; everyone moves to the streaming model
   * wherever it is hosted. Where it is not, Tarteel Tiny is the default and
   * maps to itself.
   */
  [WHISPER_MODEL_TARTEEL_TINY_QURAN]: DEFAULT_PRACTICE_MODEL_ID,
  [WHISPER_MODEL_TARTEEL_BASE_QURAN]: DEFAULT_PRACTICE_MODEL_ID,
};

export function migratePracticeModelId(stored: string | null): string {
  if (!stored) return DEFAULT_PRACTICE_MODEL_ID;
  // Legacy first: some ids are still offered elsewhere but must not be kept.
  const migrated = LEGACY_MODEL_MIGRATION[stored];
  if (migrated) return migrated;
  if (stored in PRACTICE_MODEL_OPTIONS) return stored;
  return DEFAULT_PRACTICE_MODEL_ID;
}

/*
 * The Qur'an-tuned Whisper exports. Only Tarteel Tiny is still offered, and
 * only by a build that cannot reach the streaming model, but a stored
 * preference can still name any of them on its way through the migration,
 * and they need their own decoder options.
 */
const QURAN_WHISPER_MODELS: ReadonlySet<string> = new Set([
  WHISPER_MODEL_TARTEEL_TINY_QURAN,
  WHISPER_MODEL_TARTEEL_BASE_QURAN,
  WHISPER_MODEL_SOFTMILLS_BASE_QURAN,
]);

function isQuranPracticeModel(modelId: string): boolean {
  return QURAN_WHISPER_MODELS.has(modelId);
}

/** Quantised first, full precision as the fallback. */
export const WHISPER_DTYPE_CANDIDATES: readonly string[] = ["q4", "fp32"];

type WhisperDtypeOption =
  | "fp32"
  | "q4"
  | "q8"
  | { encoder_model: "fp32"; decoder_model_merged: "fp32" | "q4" };

export function getWhisperPipelineOptions(
  modelId: string,
  dtype: string,
): { dtype: WhisperDtypeOption } {
  if (isQuranPracticeModel(modelId)) {
    return {
      dtype: {
        encoder_model: "fp32",
        decoder_model_merged: dtype === "fp32" ? "fp32" : "q4",
      },
    };
  }

  return {
    dtype: dtype as "fp32" | "q4" | "q8",
  };
}

/**
 * What to ask the decoder for.
 *
 * A generic Whisper is multilingual and will happily decode classical Arabic
 * as English, so it has to be told. A Qur'an-tuned model does one thing and
 * needs telling nothing - and several of the community ONNX exports carry a
 * generation config that declares them single-language, which makes passing
 * `task` or `language` a hard error: "Cannot specify task or language for an
 * English-only model". That killed every phrase of a run, so the model-tuned
 * branch now asks for nothing. Measured on the Tarteel tiny export, the
 * transcript is identical either way.
 */
export function getWhisperTranscribeOptions(modelId: string): {
  return_timestamps: false;
  language?: string;
  task?: "transcribe";
} {
  if (isQuranPracticeModel(modelId)) {
    return {
      return_timestamps: false,
    };
  }

  return {
    return_timestamps: false,
    language: "arabic",
    task: "transcribe",
  };
}
