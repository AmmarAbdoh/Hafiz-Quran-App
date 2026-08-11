import {
  DEFAULT_PRACTICE_MODEL_ID,
  getWhisperDtypeCandidates,
  getWhisperPipelineOptions,
  getWhisperTranscribeOptions,
  migratePracticeModelId,
  PRACTICE_MODEL_OPTIONS,
} from "./practiceConfig";

const quranModelId = "eventhorizon0/tarteel-ai-onnx-whisper-base-ar-quran";

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
    expect(getWhisperPipelineOptions(DEFAULT_PRACTICE_MODEL_ID, "q8")).toEqual({
      dtype: "q8",
    });
  });

  it("uses Quran-aware transcription options", () => {
    expect(getWhisperTranscribeOptions(quranModelId)).toEqual({
      return_timestamps: false,
      task: "transcribe",
    });
    expect(getWhisperTranscribeOptions(DEFAULT_PRACTICE_MODEL_ID)).toEqual({
      return_timestamps: false,
      language: "arabic",
      task: "transcribe",
    });
  });
});
