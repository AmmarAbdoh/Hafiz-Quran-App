// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  PracticePrivacyDisclosure,
  PracticeSettings,
  RECITATION_PRACTICE_AVAILABLE,
  useRecitationPractice,
  useRecitationPracticeTelemetry,
} from "./runtime.disabled";

describe("disabled recitation practice runtime", () => {
  it("exposes the public contract without activating media", async () => {
    const practice = renderHook(() => useRecitationPractice()).result.current;
    const telemetry = renderHook(() => useRecitationPracticeTelemetry()).result
      .current;

    await practice.startPractice([]);
    expect(RECITATION_PRACTICE_AVAILABLE).toBe(false);
    expect(practice.active).toBe(false);
    expect(telemetry).toEqual({ isSpeaking: false, micLevel: 0 });
    expect(PracticeSettings()).toBeNull();
    expect(PracticePrivacyDisclosure()).toBeNull();
  });
});
