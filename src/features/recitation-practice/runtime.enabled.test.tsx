// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const practiceMocks = vi.hoisted(() => ({
  buildExpectedWords: vi.fn(),
}));

vi.mock("@/features/recitation-practice/services/pageWordText", () => ({
  buildPageExpectedWords: practiceMocks.buildExpectedWords,
}));

import {
  PracticeSettings,
  RecitationPracticeProvider,
  useRecitationPractice,
} from "./runtime.enabled";
import type { RecitationPracticeValue } from "./contract";

describe("enabled recitation practice runtime", () => {
  afterEach(() => {
    practiceMocks.buildExpectedWords.mockReset();
    vi.unstubAllGlobals();
  });

  it("does not continue startup after practice is stopped", async () => {
    let resolveExpected!: (words: []) => void;
    const expectedPromise = new Promise<[]>((resolve) => {
      resolveExpected = resolve;
    });
    practiceMocks.buildExpectedWords.mockReturnValue(expectedPromise);
    const WorkerMock = vi.fn();
    vi.stubGlobal("Worker", WorkerMock);
    let practice!: RecitationPracticeValue;

    function Probe() {
      practice = useRecitationPractice();
      return null;
    }
    render(
      <RecitationPracticeProvider>
        <Probe />
      </RecitationPracticeProvider>,
    );

    let startRequest!: Promise<void>;
    act(() => {
      startRequest = practice.startPractice([]);
    });
    expect(practice.active).toBe(true);

    act(() => {
      practice.stopPractice();
    });
    resolveExpected([]);
    await act(async () => startRequest);

    expect(practice.active).toBe(false);
    expect(practice.error).toBeNull();
    expect(WorkerMock).not.toHaveBeenCalled();
  });

  it("exposes the model settings in the enabled runtime", () => {
    expect(PracticeSettings).toBeTypeOf("function");
  });
});
