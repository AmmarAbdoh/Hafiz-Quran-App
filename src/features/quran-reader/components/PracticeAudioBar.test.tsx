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
import { STORAGE_KEYS } from "@/shared/storage";
import type {
  RecitationPracticeTelemetry,
  RecitationPracticeValue,
} from "@/features/recitation-practice/contract";
import {
  initialRecitationPracticeState,
  initialRecitationPracticeTelemetry,
} from "@/features/recitation-practice/model/practiceState";

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

vi.mock("@/features/recitation-practice", async () => {
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
  showDebug: false,
  toggleShowDebug: vi.fn(),
  hideAyat: true,
  stopOnMistake: false,
  toggleStopOnMistake: vi.fn(),
  revealHeldWord: vi.fn(),
  skipHeldWord: vi.fn(),
  saveRun: vi.fn().mockResolvedValue("recorded.wav"),
  toggleHideAyat: vi.fn(),
  startPractice: vi.fn().mockResolvedValue(undefined),
  stopPractice: vi.fn(),
  finishPractice: vi.fn(),
  togglePractice: vi.fn().mockResolvedValue(undefined),
  clearDownloadedModel: vi.fn().mockResolvedValue(undefined),
};

const failedToStart: RecitationPracticeValue = {
  ...activePractice,
  active: false,
  phase: "preparing",
  listening: false,
  error: "microphonePermission",
};

function PracticeRuntimeHarness({
  children,
  practice = activePractice,
}: {
  children: ReactNode;
  practice?: RecitationPracticeValue;
}) {
  const [telemetry, setTelemetry] = useState<RecitationPracticeTelemetry>({
    ...initialRecitationPracticeTelemetry,
  });
  runtimeMock.setTelemetry = setTelemetry;

  const PracticeContext = runtimeMock.practiceContext!;
  const TelemetryContext = runtimeMock.telemetryContext!;

  return (
    <PracticeContext.Provider value={practice}>
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
      runtimeMock.setTelemetry?.({
        ...initialRecitationPracticeTelemetry,
        micLevel: 0.8,
      });
    });

    expect(runtimeMock.practiceHookCalls).toBe(barRenderCount);
    expect(runtimeMock.telemetryHookCalls).toBe(telemetryRenderCount + 1);

    act(() => {
      runtimeMock.setTelemetry?.({
        ...initialRecitationPracticeTelemetry,
        isSpeaking: true,
        micLevel: 0.8,
      });
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

/*
 * The bug this guards: a failed start resets the run, the bar unmounted with
 * it, and the reader was left with a page that had simply gone quiet.
 */
describe("a recitation that could not start", () => {
  /*
   * English, said rather than inherited.
   *
   * These read English labels because an earlier case in this file switches
   * the locale and `LocaleProvider` remembers the choice - so they passed
   * only in file order, and any of them run alone failed. Reported by
   * review; the locale is now this block's own.
   */
  beforeEach(() => {
    window.localStorage.setItem(STORAGE_KEYS.locale, "en");
  });

  it("still says why, after the run it belonged to is gone", () => {
    render(
      <PracticeRuntimeHarness practice={failedToStart}>
        <LocaleProvider>
          <PracticeAudioBar />
        </LocaleProvider>
      </PracticeRuntimeHarness>,
    );

    // English: the locale this file switches to above and never leaves.
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Allow microphone access to start practice.",
    );
  });

  /* One translated sentence for the reader, the engine's own words beneath
     it, so a failure can actually be diagnosed. */
  it("shows what the speech engine said went wrong", () => {
    render(
      <PracticeRuntimeHarness
        practice={{
          ...failedToStart,
          error: "recognition",
          errorDetail: "no available backend found. ERR: [wasm]",
        }}
      >
        <LocaleProvider>
          <PracticeAudioBar />
        </LocaleProvider>
      </PracticeRuntimeHarness>,
    );

    expect(
      screen.getByText("no available backend found. ERR: [wasm]"),
    ).toBeInTheDocument();
  });

  /* A model copy that loads but cannot run is not recoverable from inside a
     run, so the way out has to be where the error is. */
  it("offers a fresh copy of the model when the engine failed", () => {
    const clearDownloadedModel = vi.fn().mockResolvedValue(undefined);
    render(
      <PracticeRuntimeHarness
        practice={{
          ...failedToStart,
          error: "recognition",
          errorDetail: "Missing the following inputs: cache_position",
          clearDownloadedModel,
        }}
      >
        <LocaleProvider>
          <PracticeAudioBar />
        </LocaleProvider>
      </PracticeRuntimeHarness>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Download the model again" }),
    );

    expect(clearDownloadedModel).toHaveBeenCalledOnce();
  });

  /*
   * Stopped at a word, which is what the reader asked for when they asked to
   * be stopped at a mistake. The word itself is deliberately not shown with
   * it - seeing it is a button, because being stopped used to reveal it in
   * the same breath and hand someone the answer they were remembering.
   */
  it("offers the word and a way past it when the run is stopped", () => {
    const revealHeldWord = vi.fn();
    const skipHeldWord = vi.fn();
    render(
      <PracticeRuntimeHarness
        practice={{
          ...activePractice,
          heldAtLocation: "1:1:1",
          revealHeldWord,
          skipHeldWord,
        }}
      >
        <LocaleProvider>
          <PracticeAudioBar />
        </LocaleProvider>
      </PracticeRuntimeHarness>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Say the word to carry on",
    );

    fireEvent.click(screen.getByRole("button", { name: "Show me the word" }));
    fireEvent.click(screen.getByRole("button", { name: "Move past it" }));

    expect(revealHeldWord).toHaveBeenCalledOnce();
    expect(skipHeldWord).toHaveBeenCalledOnce();
  });

  it("says nothing about a held word while the run is flowing", () => {
    render(
      <PracticeRuntimeHarness>
        <LocaleProvider>
          <PracticeAudioBar />
        </LocaleProvider>
      </PracticeRuntimeHarness>,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows nothing when there is neither a run nor a failure", () => {
    const { container } = render(
      <PracticeRuntimeHarness practice={{ ...failedToStart, error: null }}>
        <LocaleProvider>
          <PracticeAudioBar />
        </LocaleProvider>
      </PracticeRuntimeHarness>,
    );

    expect(container.querySelector(".mushaf-playback-bar")).toBeNull();
  });
});
