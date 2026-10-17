import {
  DEFAULT_PRACTICE_MODEL_ID,
  getWhisperDtypeCandidates,
  getWhisperPipelineOptions,
  getWhisperTranscribeOptions,
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
    expect(PRACTICE_MODEL_OPTIONS[quranModelId]?.group).toBe("quran");
  });

  /*
   * The default is Qur'an-tuned rather than generic. Measured over 32
   * labelled clips, generic whisper-tiny with the old matcher rejected 18 of
   * 20 correct recitations; the Qur'an tiny model with word alignment got all
   * 32 right. See scripts/tasmee.
   */
  it("defaults to a Qur'an-tuned model, not a generic one", () => {
    expect(PRACTICE_MODEL_OPTIONS[DEFAULT_PRACTICE_MODEL_ID]?.group).toBe(
      "quran",
    );
  });

  it("offers browser-compatible dtype fallbacks for both model families", () => {
    expect(getWhisperDtypeCandidates(DEFAULT_PRACTICE_MODEL_ID)).toEqual([
      "q4",
      "fp32",
    ]);
    expect(getWhisperDtypeCandidates(quranModelId)).toEqual(["q4", "fp32"]);
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
  it("keeps the encoder unquantised for the default", () => {
    expect(getWhisperPipelineOptions(DEFAULT_PRACTICE_MODEL_ID, "q4")).toEqual({
      dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
    });
  });

  it("uses Quran-aware transcription options", () => {
    expect(getWhisperTranscribeOptions(quranModelId)).toEqual({
      return_timestamps: false,
      task: "transcribe",
    });
    expect(getWhisperTranscribeOptions(DEFAULT_PRACTICE_MODEL_ID)).toEqual({
      return_timestamps: false,
      task: "transcribe",
    });
    expect(getWhisperTranscribeOptions(genericModelId)).toEqual({
      return_timestamps: false,
      language: "arabic",
      task: "transcribe",
    });
  });
});
