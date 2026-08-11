// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  useState,
  type Context,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type * as ReactModule from "react";
import { LocaleProvider, useLocale } from "@/app/i18n";
import type {
  RecitationPracticeTelemetry,
  RecitationPracticeValue,
} from "@/features/recitation-practice/contract";
import { initialRecitationPracticeState } from "@/features/recitation-practice/model/practiceState";

const runtimeMock = vi.hoisted(() => ({
  practiceContext: undefined as
    | Context<RecitationPracticeValue | null>
    | undefined,
  telemetryContext: undefined as
    | Context<RecitationPracticeTelemetry | null>
    | undefined,
  setTelemetry: undefined as
    | Dispatch<SetStateAction<RecitationPracticeTelemetry>>
    | undefined,
  practiceHookCalls: 0,
  telemetryHookCalls: 0,
}));

vi.mock("@practice/runtime", async () => {
  const React = await vi.importActual<typeof ReactModule>("react");
  runtimeMock.practiceContext =
    React.createContext<RecitationPracticeValue | null>(null);
  runtimeMock.telemetryContext =
    React.createContext<RecitationPracticeTelemetry | null>(null);

  return {
    useRecitationPractice() {
      runtimeMock.practiceHookCalls += 1;
      return React.useContext(runtimeMock.practiceContext!);
    },
    useRecitationPracticeTelemetry() {
      runtimeMock.telemetryHookCalls += 1;
      return React.useContext(runtimeMock.telemetryContext!);
    },
  };
});

import { PracticeAudioBar } from "./PracticeAudioBar";

const activePractice: RecitationPracticeValue = {
  ...initialRecitationPracticeState,
  active: true,
  phase: "listening",
  listening: true,
  progressIndex: 2,
  totalWords: 10,
  hideAyat: true,
  toggleHideAyat: vi.fn(),
  startPractice: vi.fn().mockResolvedValue(undefined),
  stopPractice: vi.fn(),
  togglePractice: vi.fn().mockResolvedValue(undefined),
};

function PracticeRuntimeHarness({ children }: { children: ReactNode }) {
  const [telemetry, setTelemetry] = useState<RecitationPracticeTelemetry>({
    isSpeaking: false,
    micLevel: 0,
  });
  runtimeMock.setTelemetry = setTelemetry;

  const PracticeContext = runtimeMock.practiceContext!;
  const TelemetryContext = runtimeMock.telemetryContext!;

  return (
    <PracticeContext.Provider value={activePractice}>
      <TelemetryContext.Provider value={telemetry}>
        {children}
      </TelemetryContext.Provider>
    </PracticeContext.Provider>
  );
}

function EnglishLocaleButton() {
  const { setLocale } = useLocale();
  return (
    <button type="button" onClick={() => setLocale("en")}>
      Use English
    </button>
  );
}

describe("PracticeAudioBar telemetry isolation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    runtimeMock.practiceHookCalls = 0;
    runtimeMock.telemetryHookCalls = 0;
    runtimeMock.setTelemetry = undefined;
  });

  it("rerenders the mic status without rerendering the bar controls", async () => {
    render(
      <PracticeRuntimeHarness>
        <LocaleProvider>
          <EnglishLocaleButton />
          <PracticeAudioBar />
        </LocaleProvider>
      </PracticeRuntimeHarness>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Use English" }));
    const stopButton = await screen.findByRole("button", {
      name: "Stop practice",
    });
    const barRenderCount = runtimeMock.practiceHookCalls;
    const telemetryRenderCount = runtimeMock.telemetryHookCalls;

    act(() => {
      runtimeMock.setTelemetry?.({ isSpeaking: false, micLevel: 0.8 });
    });

    expect(runtimeMock.practiceHookCalls).toBe(barRenderCount);
    expect(runtimeMock.telemetryHookCalls).toBe(telemetryRenderCount + 1);

    act(() => {
      runtimeMock.setTelemetry?.({ isSpeaking: true, micLevel: 0.8 });
    });

    expect(runtimeMock.practiceHookCalls).toBe(barRenderCount);
    expect(runtimeMock.telemetryHookCalls).toBe(telemetryRenderCount + 2);
    expect(screen.getByRole("button", { name: "Stop practice" })).toBe(
      stopButton,
    );
    expect(screen.getByText(/Listening/)).toBeInTheDocument();
    expect(screen.queryByText("What you said:")).not.toBeInTheDocument();
  });
});
