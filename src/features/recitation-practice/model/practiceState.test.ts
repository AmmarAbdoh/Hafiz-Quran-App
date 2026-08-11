import { describe, expect, it } from "vitest";
import {
  initialRecitationPracticeState,
  recitationPracticeReducer,
} from "./practiceState";

describe("recitationPracticeReducer", () => {
  it("moves through preparing, loading, listening, and completed", () => {
    const started = recitationPracticeReducer(initialRecitationPracticeState, {
      type: "start",
    });
    const loading = recitationPracticeReducer(started, {
      type: "expected-words-ready",
      totalWords: 2,
      currentWordLocation: "1:1:1",
    });
    const listening = recitationPracticeReducer(loading, { type: "listening" });
    const completed = recitationPracticeReducer(listening, {
      type: "progress-advanced",
      progressIndex: 2,
      revealedLocations: ["1:1:1", "1:1:2"],
      currentWordLocation: null,
      transcript: "بسم الله",
      completed: true,
    });

    expect(started).toMatchObject({ active: true, phase: "preparing" });
    expect(loading).toMatchObject({ loadingModel: true, totalWords: 2 });
    expect(listening).toMatchObject({ listening: true, modelProgress: 100 });
    expect(completed).toMatchObject({
      phase: "completed",
      completed: true,
      listening: false,
    });
  });

  it("resets all transient state and optionally preserves a reported error", () => {
    const dirtyState = {
      ...initialRecitationPracticeState,
      active: true,
      phase: "listening" as const,
      listening: true,
      wrongFlashLocation: "1:1:1",
      revealedLocations: ["1:1:1"],
      error: "recognition" as const,
    };

    expect(
      recitationPracticeReducer(dirtyState, {
        type: "reset",
        error: "microphonePermission",
      }),
    ).toEqual({
      ...initialRecitationPracticeState,
      error: "microphonePermission",
    });
    expect(recitationPracticeReducer(dirtyState, { type: "reset" })).toEqual(
      initialRecitationPracticeState,
    );
    expect(recitationPracticeReducer(dirtyState, { type: "start" })).toEqual({
      ...initialRecitationPracticeState,
      active: true,
    });
  });

  it("tracks model progress, transcripts, and a recoverable wrong attempt", () => {
    const ready = recitationPracticeReducer(initialRecitationPracticeState, {
      type: "expected-words-ready",
      totalWords: 3,
      currentWordLocation: "2:1:1",
    });
    const progressing = recitationPracticeReducer(ready, {
      type: "model-progress",
      progress: 42,
    });
    const analyzing = recitationPracticeReducer(progressing, {
      type: "analysis-started",
    });
    const transcript = recitationPracticeReducer(analyzing, {
      type: "transcript-observed",
      transcript: "observed words",
    });
    const wrong = recitationPracticeReducer(transcript, {
      type: "wrong-attempt",
      transcript: "wrong words",
      location: "2:1:1",
    });

    expect(progressing).toMatchObject({
      phase: "loading-model",
      loadingModel: true,
      modelProgress: 42,
    });
    expect(analyzing.isAnalyzing).toBe(true);
    expect(
      recitationPracticeReducer(analyzing, { type: "analysis-started" }),
    ).toBe(analyzing);
    expect(transcript.lastTranscript).toBe("observed words");
    expect(wrong).toMatchObject({
      isAnalyzing: false,
      lastTranscript: "wrong words",
      wrongFlashLocation: "2:1:1",
    });

    const cleared = recitationPracticeReducer(wrong, {
      type: "clear-wrong-flash",
    });
    expect(cleared.wrongFlashLocation).toBeNull();
    expect(
      recitationPracticeReducer(cleared, { type: "clear-wrong-flash" }),
    ).toBe(cleared);
  });

  it("continues listening after progress and surfaces recognition errors", () => {
    const listening = {
      ...initialRecitationPracticeState,
      active: true,
      phase: "listening" as const,
      listening: true,
      isAnalyzing: true,
    };
    const advanced = recitationPracticeReducer(listening, {
      type: "progress-advanced",
      progressIndex: 1,
      revealedLocations: ["1:1:1"],
      currentWordLocation: "1:1:2",
      transcript: "first word",
      completed: false,
    });

    expect(advanced).toMatchObject({
      phase: "listening",
      listening: true,
      completed: false,
      isAnalyzing: false,
      progressIndex: 1,
    });
    expect(
      recitationPracticeReducer(advanced, {
        type: "recognition-error",
        error: "workerUnavailable",
      }),
    ).toMatchObject({ isAnalyzing: false, error: "workerUnavailable" });
  });
});
