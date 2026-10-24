import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PRACTICE_MODEL_ID,
  WHISPER_DTYPE_CANDIDATES,
  getWhisperPipelineOptions,
  getWhisperTranscribeOptions,
  isStreamingPracticeModel,
  migratePracticeModelId,
  PRACTICE_MODEL_OPTIONS,
} from "./practiceConfig";

const quranModelId = "eventhorizon0/tarteel-ai-onnx-whisper-base-ar-quran";
/* The generic family still exists as a choice; it is no longer the default. */
const genericModelId = "Xenova/whisper-tiny";

describe("practice model configuration", () => {
  it("keeps supported models and migrates missing, legacy, or unknown values", () => {
    expect(migratePracticeModelId(null)).toBe(DEFAULT_PRACTICE_MODEL_ID);
    expect(migratePracticeModelId(DEFAULT_PRACTICE_MODEL_ID)).toBe(
      DEFAULT_PRACTICE_MODEL_ID,
    );
    expect(migratePracticeModelId("onnx-community/whisper-small")).toBe(
      DEFAULT_PRACTICE_MODEL_ID,
    );
    expect(migratePracticeModelId("onnx-community/whisper-tiny")).toBe(
      DEFAULT_PRACTICE_MODEL_ID,
    );
    expect(migratePracticeModelId("onnx-community/whisper-base-ar-ONNX")).toBe(
      DEFAULT_PRACTICE_MODEL_ID,
    );
    expect(migratePracticeModelId("removed/model")).toBe(
      DEFAULT_PRACTICE_MODEL_ID,
    );
    // Retired from the picker, so a stored copy of it must move on.
    expect(migratePracticeModelId(quranModelId)).toBe(
      DEFAULT_PRACTICE_MODEL_ID,
    );
  });

  it("knows a Whisper from the streaming recogniser", () => {
    expect(isStreamingPracticeModel(genericModelId)).toBe(false);
  });
});

/*
 * The default is the streaming phoneme recogniser rather than any Whisper.
 * Measured on the same 32 clips: 3.08% phoneme error against Whisper tiny's
 * 27-73% word error, and it is the only one that can be followed word by word
 * while someone is still reciting. See scripts/tasmee.
 *
 * Stubbed rather than read from the machine running the tests, because in
 * development the answer now depends on whether the gated weights are on it.
 */
describe("development, with the gated weights on the machine", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const load = async (present: string | undefined) => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_PRACTICE_MODELS_PRESENT", present);
    vi.resetModules();
    return import("./practiceConfig");
  };

  it("defaults to the streaming recogniser, not a Whisper", async () => {
    const config = await load("true");

    expect(config.STREAMING_MODEL_AVAILABLE).toBe(true);
    expect(
      config.PRACTICE_MODEL_OPTIONS[config.DEFAULT_PRACTICE_MODEL_ID]?.group,
    ).toBe("streaming");
    expect(
      config.isStreamingPracticeModel(config.DEFAULT_PRACTICE_MODEL_ID),
    ).toBe(true);
  });

  /*
   * A fresh clone has no weights. Offering the model anyway asked the dev
   * server for a file it does not have, fell through to the SPA rewrite and
   * failed inside the ONNX parser on an index.html - after migrating the
   * contributor's stored preference onto the model that cannot load.
   */
  it("leaves a fresh clone on a model it can actually load", async () => {
    const config = await load(undefined);

    expect(config.STREAMING_MODEL_AVAILABLE).toBe(false);
    expect(
      config.isStreamingPracticeModel(config.DEFAULT_PRACTICE_MODEL_ID),
    ).toBe(false);
    expect(
      config.migratePracticeModelId("quran-lab/zipformer_p-arabic-v3.1"),
    ).toBe(config.DEFAULT_PRACTICE_MODEL_ID);
  });
});

/*
 * Only the dev server serves `/models/`. A production build that has not been
 * told where the streaming model is hosted would fetch index.html for it, so
 * it must neither offer it nor move anyone onto it.
 */
describe("a production build with nowhere to fetch the streaming model from", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /* All three URLs, because the engine needs all three to load. */
  const load = async (
    urls: { model?: string; tokens?: string; phonemes?: string } = {},
  ) => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_PRACTICE_MODEL_URL", urls.model);
    vi.stubEnv("VITE_PRACTICE_TOKENS_URL", urls.tokens);
    vi.stubEnv("VITE_PRACTICE_PHONEMES_URL", urls.phonemes);
    vi.resetModules();
    return import("./practiceConfig");
  };

  const hostedEverywhere = {
    model: "https://models.example/zipformer.onnx",
    tokens: "https://models.example/tokens.txt",
    phonemes: "https://models.example/phonemes.json",
  };

  it("defaults to the Qur'an-tuned Whisper and does not offer the streaming one", async () => {
    const config = await load();

    expect(config.STREAMING_MODEL_AVAILABLE).toBe(false);
    expect(
      config.isStreamingPracticeModel(config.DEFAULT_PRACTICE_MODEL_ID),
    ).toBe(false);
    expect(
      config.PRACTICE_MODEL_OPTIONS[config.DEFAULT_PRACTICE_MODEL_ID]?.group,
    ).toBe("quran");
    expect(
      Object.keys(config.PRACTICE_MODEL_OPTIONS).some(
        config.isStreamingPracticeModel,
      ),
    ).toBe(false);
  });

  it("keeps a reader on it rather than migrating them onto a model it cannot load", async () => {
    const config = await load();

    expect(
      config.migratePracticeModelId(config.DEFAULT_PRACTICE_MODEL_ID),
    ).toBe(config.DEFAULT_PRACTICE_MODEL_ID);
    expect(
      config.migratePracticeModelId("quran-lab/zipformer_p-arabic-v3.1"),
    ).toBe(config.DEFAULT_PRACTICE_MODEL_ID);
  });

  it("uses the streaming model once it is told where it is hosted", async () => {
    const config = await load(hostedEverywhere);

    expect(config.STREAMING_MODEL_AVAILABLE).toBe(true);
    expect(
      config.isStreamingPracticeModel(config.DEFAULT_PRACTICE_MODEL_ID),
    ).toBe(true);
  });

  /*
   * The weights alone used to be enough to switch streaming on, and then the
   * tokens and the phoneme table fell through to `/models/`, where the SPA
   * rewrite answers every path with index.html and a 200.
   */
  it("is not satisfied by the weights alone", async () => {
    const config = await load({ model: hostedEverywhere.model });

    expect(config.STREAMING_MODEL_AVAILABLE).toBe(false);
  });

  it("is not satisfied with the phoneme table missing", async () => {
    const config = await load({
      model: hostedEverywhere.model,
      tokens: hostedEverywhere.tokens,
    });

    expect(config.STREAMING_MODEL_AVAILABLE).toBe(false);
  });
});

describe("practice model decoder options", () => {
  it("offers browser-compatible dtype fallbacks for both model families", () => {
    expect(WHISPER_DTYPE_CANDIDATES).toEqual(["q4", "fp32"]);
  });

  it("builds split Quran model dtype options", () => {
    expect(getWhisperPipelineOptions(quranModelId, "q4")).toEqual({
      dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
    });
    expect(getWhisperPipelineOptions(quranModelId, "fp32")).toEqual({
      dtype: { encoder_model: "fp32", decoder_model_merged: "fp32" },
    });
  });

  it("passes generic model dtypes through", () => {
    expect(getWhisperPipelineOptions(genericModelId, "q8")).toEqual({
      dtype: "q8",
    });
  });

  /*
   * The encoder stays fp32 even on the small model: quantising it to q8 was
   * measured at barely any gain and cost a correct recitation.
   */
  it("keeps the encoder unquantised on a Qur'an-tuned Whisper", () => {
    expect(getWhisperPipelineOptions(quranModelId, "q4")).toEqual({
      dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
    });
  });

  /*
   * The defect this replaces: several community ONNX exports of the Qur'an
   * models carry a generation config that declares a single language, and
   * then asking for a task is a hard error - "Cannot specify task or language
   * for an English-only model" - which failed every phrase of a run.
   */
  it("asks a Quran-tuned model for nothing it might refuse", () => {
    expect(getWhisperTranscribeOptions(quranModelId)).toEqual({
      return_timestamps: false,
    });
  });

  /* A generic Whisper is multilingual and will read Arabic as English if it
     is not told otherwise, so that one still has to be told. */
  it("still names the language for a generic model", () => {
    expect(getWhisperTranscribeOptions(genericModelId)).toEqual({
      return_timestamps: false,
      language: "arabic",
      task: "transcribe",
    });
  });
});

/*
 * Measured against the published files: the softmills decoder's graph asks
 * for a `cache_position` input, and the string does not occur anywhere in
 * this version of transformers.js, so it can never be supplied. Anyone who
 * picked it had a run that failed on every phrase.
 */
describe("a model that cannot run here", () => {
  const softmills = "softmills/whisper-base-ar-quran-onnx";

  it("is no longer offered", () => {
    expect(PRACTICE_MODEL_OPTIONS[softmills]).toBeUndefined();
  });

  it("carries anyone already on it back to the default", () => {
    expect(migratePracticeModelId(softmills)).toBe(DEFAULT_PRACTICE_MODEL_ID);
  });
});
