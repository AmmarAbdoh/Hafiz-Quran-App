/** Xenova ONNX — classic quant format, works in browser ORT. */
export const WHISPER_MODEL_GENERIC_SMALL = "Xenova/whisper-small";
export const WHISPER_MODEL_GENERIC_TINY = "Xenova/whisper-tiny";

export const WHISPER_MODEL_LEGACY_ONNX_SMALL = "onnx-community/whisper-small";
export const WHISPER_MODEL_LEGACY_ONNX_TINY = "onnx-community/whisper-tiny";
/** Community ONNX export of tarteel-ai/whisper-base-ar-quran (transformers.js). */
export const WHISPER_MODEL_TARTEEL_BASE_QURAN =
  "eventhorizon0/tarteel-ai-onnx-whisper-base-ar-quran";
/** Community ONNX export of Tarteel tiny Quran model. */
export const WHISPER_MODEL_TARTEEL_TINY_QURAN =
  "omartariq612/tarteel-ai-whisper-tiny-ar-quran-onnx";
export const WHISPER_MODEL_SOFTMILLS_BASE_QURAN =
  "softmills/whisper-base-ar-quran-onnx";
export const WHISPER_MODEL_ARABIC_LEGACY =
  "onnx-community/whisper-base-ar-ONNX";

/** Tiny is faster for pause-based practice. */
export const DEFAULT_PRACTICE_MODEL_ID = WHISPER_MODEL_GENERIC_TINY;

export const PRACTICE_MODEL_OPTIONS: Record<
  string,
  { label: string; description: string; group: "generic" | "quran" }
> = {
  [WHISPER_MODEL_GENERIC_TINY]: {
    label: "عام — Whisper Tiny",
    description: "الأسرع — مناسب للتجربة السريعة",
    group: "generic",
  },
  [WHISPER_MODEL_GENERIC_SMALL]: {
    label: "عام — Whisper Small",
    description: "أدق من Tiny لكن أبطأ",
    group: "generic",
  },
  [WHISPER_MODEL_TARTEEL_TINY_QURAN]: {
    label: "قرآن — Tarteel Tiny (محلي)",
    description:
      "نموذج قرآن مُحوّل لـ ONNX — أدق للتلاوة، تحميل ~150MB. يحتاج إنترنت للتحميل الأول فقط",
    group: "quran",
  },
  [WHISPER_MODEL_TARTEEL_BASE_QURAN]: {
    label: "قرآن — Tarteel Base (محلي)",
    description:
      "أدق للقرآن لكن أثقل وأبطأ — تحميل ~400MB. مُوصى به إن كان الجهاز قوياً",
    group: "quran",
  },
  [WHISPER_MODEL_SOFTMILLS_BASE_QURAN]: {
    label: "قرآن — Whisper Base Quran",
    description: "بديل مجتمعي لنموذج قرآن — جرّبه إن لم يعمل Tarteel Base",
    group: "quran",
  },
};

export const PRACTICE_MODEL_STORAGE_KEY = "quran-practice-whisper-model";
/** When true, unrevealed ayat text is hidden (underline placeholders) during تسميع. */
export const PRACTICE_HIDE_AYAT_STORAGE_KEY = "quran-practice-hide-ayat";
export const PRACTICE_SAMPLE_RATE = 16000;
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

const LEGACY_MODEL_MIGRATION: Record<string, string> = {
  [WHISPER_MODEL_LEGACY_ONNX_SMALL]: WHISPER_MODEL_GENERIC_TINY,
  [WHISPER_MODEL_LEGACY_ONNX_TINY]: WHISPER_MODEL_GENERIC_TINY,
  [WHISPER_MODEL_ARABIC_LEGACY]: WHISPER_MODEL_GENERIC_TINY,
};

export function migratePracticeModelId(stored: string | null): string {
  if (!stored) return DEFAULT_PRACTICE_MODEL_ID;
  if (stored in PRACTICE_MODEL_OPTIONS) return stored;
  return LEGACY_MODEL_MIGRATION[stored] ?? DEFAULT_PRACTICE_MODEL_ID;
}

export function isQuranPracticeModel(modelId: string): boolean {
  return PRACTICE_MODEL_OPTIONS[modelId]?.group === "quran";
}

export function getWhisperDtypeCandidates(modelId: string): string[] {
  if (isQuranPracticeModel(modelId)) {
    return ["q4", "fp32"];
  }
  return ["q4", "fp32"];
}

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

export function getWhisperTranscribeOptions(modelId: string): {
  return_timestamps: false;
  language?: string;
  task: "transcribe";
} {
  if (isQuranPracticeModel(modelId)) {
    return {
      return_timestamps: false,
      task: "transcribe",
    };
  }

  return {
    return_timestamps: false,
    language: "arabic",
    task: "transcribe",
  };
}
