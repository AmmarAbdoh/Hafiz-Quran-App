// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PRACTICE_MODEL_ID,
  PRACTICE_MODEL_STORAGE_KEY,
} from "@/features/recitation-practice/model/practiceConfig";
import {
  readPracticeModelPreference,
  usePracticeModel,
} from "./usePracticeModel";

describe("practice model preference", () => {
  afterEach(() => localStorage.clear());

  it("migrates the stored legacy value through safe storage", () => {
    localStorage.setItem(
      PRACTICE_MODEL_STORAGE_KEY,
      "onnx-community/whisper-tiny",
    );

    expect(readPracticeModelPreference()).toBe(DEFAULT_PRACTICE_MODEL_ID);
    expect(localStorage.getItem(PRACTICE_MODEL_STORAGE_KEY)).toBe(
      DEFAULT_PRACTICE_MODEL_ID,
    );
  });

  it("uses the same canonical reader in the settings hook", () => {
    const { result } = renderHook(() => usePracticeModel());
    expect(result.current.modelId).toBe(readPracticeModelPreference());
  });
});
