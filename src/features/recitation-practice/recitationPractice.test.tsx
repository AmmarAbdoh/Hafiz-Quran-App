// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const practiceMocks = vi.hoisted(() => ({
  buildExpectedWords: vi.fn(),
  buildSpokenWords: vi.fn(),
  startZipformer: vi.fn(),
  startMic: vi.fn(),
}));

vi.mock("@/features/recitation-practice/services/pageWordText", () => ({
  buildPageExpectedWords: practiceMocks.buildExpectedWords,
}));
vi.mock("@/features/recitation-practice/services/spokenWords", () => ({
  buildPageSpokenWords: practiceMocks.buildSpokenWords,
}));
vi.mock("@/features/recitation-practice/services/zipformerEngine", () => ({
  startZipformer: practiceMocks.startZipformer,
}));
vi.mock("@/features/recitation-practice/services/micAudioCapture", () => ({
  startPhraseMicCapture: practiceMocks.startMic,
}));

import {
  PracticeSettings,
  RecitationPracticeProvider,
  useRecitationPractice,
} from "./index";
import type { RecitationPracticeValue } from "./contract";
import type { ZipformerCallbacks } from "./services/zipformerEngine";
import { VERDICT_TIMEOUT_MS } from "./model/practiceConfig";

function renderPractice() {
  const view = { current: null as unknown as RecitationPracticeValue };
  function Probe() {
    view.current = useRecitationPractice();
    return null;
  }
  render(
    <RecitationPracticeProvider>
      <Probe />
    </RecitationPracticeProvider>,
  );
  return view;
}

describe("the recitation practice runtime", () => {
  afterEach(() => {
    for (const mock of Object.values(practiceMocks)) mock.mockReset();
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
    const practice = renderPractice();

    let startRequest!: Promise<void>;
    act(() => {
      startRequest = practice.current.startPractice([]);
    });
    expect(practice.current.active).toBe(true);

    act(() => {
      practice.current.stopPractice();
    });
    resolveExpected([]);
    await act(async () => startRequest);

    expect(practice.current.active).toBe(false);
    expect(practice.current.error).toBeNull();
    expect(WorkerMock).not.toHaveBeenCalled();
  });

  it("exposes the model settings in the enabled runtime", () => {
    expect(PracticeSettings).toBeTypeOf("function");
  });
});

/*
 * The streaming path, against a recogniser that only does what it is told.
 * Al-Fatihah 1:1's first two words, in units small enough to say by hand.
 */
describe("a streaming recitation", () => {
  const SPOKEN = [
    { locations: ["1:1:1"], units: ["بِ", "س", "مِ"], ids: [1, 2, 3] },
    { locations: ["1:1:2"], units: ["لَ", "اا", "هِ"], ids: [4, 5, 6] },
  ];

  /*
   * Long enough that opening partway down leaves more than the two words the
   * start of a page is allowed - see `UNRECITED_AT_START_TOLERATED` - and
   * that the words recited make a run the resync will believe.
   */
  const EIGHT_WORDS = [
    { locations: ["1:1:1"], units: ["بِ", "س", "مِ"], ids: [1, 2, 3] },
    { locations: ["1:1:2"], units: ["لَ", "اا", "هِ"], ids: [4, 5, 6] },
    { locations: ["1:1:3"], units: ["ءَر", "رَح"], ids: [7, 8] },
    { locations: ["1:1:4"], units: ["مَاا", "ن"], ids: [9, 10] },
    { locations: ["1:1:5"], units: ["رَ", "حِ"], ids: [11, 12] },
    { locations: ["1:1:6"], units: ["ۦۦ", "م"], ids: [13, 14] },
    { locations: ["1:1:7"], units: ["قُ", "ل"], ids: [15, 16] },
    { locations: ["1:1:8"], units: ["هُ", "وَ"], ids: [17, 18] },
  ];

  /* Long enough that stopping after the first word leaves more than the one
     unreached word a finished recitation is allowed. */
  const FOUR_WORDS = [
    ...SPOKEN,
    { locations: ["1:1:3"], units: ["ءَر", "رَح"], ids: [7, 8] },
    { locations: ["1:1:4"], units: ["مَاا", "ن"], ids: [9, 10] },
  ];

  afterEach(() => {
    for (const mock of Object.values(practiceMocks)) mock.mockReset();
    /* Here, not at the end of the test that stubs them: a failing assertion
       would leak the stub into every test after it. */
    vi.unstubAllGlobals();
    /* The practice toggles are stored, so one test's choice of them reached
       the next - and the run that turned off being stopped at a mistake left
       the test after it starting with it already off. */
    window.localStorage.clear();
  });

  const say = (symbols: string[]) =>
    symbols.map((symbol, index) => ({
      id: index,
      symbol,
      confidence: 0.95,
      seconds: index * 0.04,
    }));

  async function startRun(spoken: typeof SPOKEN = SPOKEN) {
    practiceMocks.buildExpectedWords.mockResolvedValue([
      {
        location: "1:1:1",
        verseKey: "1:1",
        text: "بِسْمِ",
        displayText: "بسم",
        normalized: "بسم",
      },
      {
        location: "1:1:2",
        verseKey: "1:1",
        text: "ٱللَّهِ",
        displayText: "الله",
        normalized: "الله",
      },
    ]);
    practiceMocks.buildSpokenWords.mockResolvedValue(spoken);
    const engine = {
      begin: vi.fn(),
      push: vi.fn(),
      score: vi.fn(),
      stop: vi.fn(),
      usable: true,
    };
    practiceMocks.startZipformer.mockResolvedValue(engine);
    practiceMocks.startMic.mockResolvedValue({
      stop: vi.fn(),
      /* Called when a mistake sounds, so that the app does not hear its own
         error tone - echo cancellation being off by design. */
      muteFor: vi.fn(),
    });

    const practice = renderPractice();
    await act(async () => practice.current.startPractice([]));
    const callbacks = () =>
      engine.begin.mock.calls.at(-1)![0] as ZipformerCallbacks;
    return { practice, engine, callbacks };
  }

  /*
   * A recogniser this run fetched and never took is not left running.
   *
   * Reported by review. The engine is started in parallel with the page's
   * phoneme table and only adopted after it - so a table that fails, or a
   * run stopped in that window, left the fetch to resolve into nothing,
   * keeping its worker and the model's 72MB for the life of the page.
   * Nothing else could reach it: `zipformerRef` was never assigned, so
   * `disposeEngine` had nothing to dispose, and every retry added another.
   */
  it("stops a recogniser it fetched but never used", async () => {
    practiceMocks.buildExpectedWords.mockResolvedValue([
      {
        location: "1:1:1",
        verseKey: "1:1",
        text: "بِسمِ",
        displayText: "بسم",
        normalized: "بسم",
      },
    ]);
    /* The phoneme table is what fails here; the model had already loaded. */
    practiceMocks.buildSpokenWords.mockRejectedValue(
      new Error("the phoneme table could not be read"),
    );
    const engine = {
      begin: vi.fn(),
      push: vi.fn(),
      score: vi.fn(),
      stop: vi.fn(),
      usable: true,
    };
    practiceMocks.startZipformer.mockResolvedValue(engine);
    practiceMocks.startMic.mockResolvedValue({
      stop: vi.fn(),
      muteFor: vi.fn(),
    });

    const practice = renderPractice();
    await act(async () => practice.current.startPractice([]));
    /* The abandon runs on the engine promise, so let it settle. */
    await act(async () => {
      await Promise.resolve();
    });

    /* The phoneme tables ship with the model, so failing to read them is
       reported as the model not being there - see `startStage`. */
    expect(practice.current.error).toBe("modelLoad");
    expect(engine.begin).not.toHaveBeenCalled();
    expect(engine.stop).toHaveBeenCalledOnce();
  });

  it("says nothing was heard, rather than calling an unheard run clean", async () => {
    const { practice, engine, callbacks } = await startRun();

    // Recited, but nothing the page was waiting for.
    act(() => callbacks().onUnits(say(["ق", "ط", "ب"])));
    act(() => practice.current.finishPractice());

    expect(engine.score).not.toHaveBeenCalled();
    expect(practice.current.completed).toBe(false);
    expect(practice.current.error).toBe("nothingHeard");
  });

  /*
   * The same unmatched state, reached without anyone speaking. Reporting a
   * failure for pressing stop made changing your mind look like a fault.
   */
  it("just stops when the reciter changes their mind before saying anything", async () => {
    const { practice, engine } = await startRun();

    act(() => practice.current.finishPractice());

    expect(engine.score).not.toHaveBeenCalled();
    expect(practice.current.completed).toBe(false);
    expect(practice.current.error).toBe(null);
    expect(practice.current.active).toBe(false);
  });

  it("asks only about the words recited, and counts page words", async () => {
    const { practice, engine, callbacks } = await startRun();
    expect(practice.current.totalWords).toBe(2);

    act(() => callbacks().onUnits(say(SPOKEN[0]!.units)));
    act(() => practice.current.finishPractice());

    expect(engine.score).toHaveBeenCalledWith({ from: 0, to: 1 });

    act(() => callbacks().onScores([0.9], [[]]));

    expect(practice.current.completed).toBe(true);
    expect(practice.current.misreadWords).toEqual([]);
    /*
     * The page's words, not the stretch that was judged.
     *
     * This asserted 1 - the judged span - which is what made every abandoned
     * run show as 100% and clean. Of a two-word page one was reached, and the
     * closing word is the one the cursor can least be relied on to complete,
     * so this is a finished recitation rather than a short one.
     */
    expect(practice.current.totalWords).toBe(2);
    expect(practice.current.progressIndex).toBe(1);
    expect(practice.current.stoppedShort).toBe(false);
  });

  /*
   * The failure the summary most has to avoid. Measured over 3,595 clips,
   * stopping early is how 501 of 1,698 mistakes present, and the app caught
   * 6 of them: `requestVerdict` replaced the page's total with the stretch it
   * had judged, so three words of a hundred and twenty read as a clean page.
   */
  it("says a run that stopped well short did not finish", async () => {
    const { practice, engine, callbacks } = await startRun(FOUR_WORDS);
    expect(practice.current.totalWords).toBe(4);

    act(() => callbacks().onUnits(say(FOUR_WORDS[0]!.units)));
    act(() => practice.current.finishPractice());

    expect(engine.score).toHaveBeenCalledWith({ from: 0, to: 1 });

    act(() => callbacks().onScores([0.9], [[]]));

    expect(practice.current.completed).toBe(true);
    expect(practice.current.misreadWords).toEqual([]);
    expect(practice.current.totalWords).toBe(4);
    expect(practice.current.progressIndex).toBe(1);
    expect(practice.current.stoppedShort).toBe(true);
  });

  /*
   * The other half of the page, which went unjudged for as long as the
   * summary existed.
   *
   * `stoppedShort` asked only whether the end was reached, so a reciter who
   * opened partway down and carried on to the last word reached it: the run
   * came back complete, the bar read 100%, and the words before they started
   * were never scored or mentioned. The mirror image of the abandoned page.
   */
  it("does not call a page begun partway down a complete one", async () => {
    const { practice, engine, callbacks } = await startRun(EIGHT_WORDS);

    /* Opens at the fifth word and carries on to the last. */
    act(() =>
      callbacks().onUnits(say(EIGHT_WORDS.slice(4).flatMap((w) => w.units))),
    );
    act(() => practice.current.finishPractice());

    /* Only what they recited is asked about, which is right, and is also why
       the rest has to be reported some other way. */
    expect(engine.score).toHaveBeenCalledWith({ from: 4, to: 8 });
    act(() => callbacks().onScores([0.9, 0.9, 0.9, 0.9], [[], [], [], []]));

    expect(practice.current.completed).toBe(true);
    expect(practice.current.stoppedShort).toBe(true);
    /* Four of eight recited, not eight of eight. */
    expect(practice.current.progressIndex).toBe(4);
    expect(practice.current.totalWords).toBe(8);
  });

  /*
   * "Sometimes it says I got no word wrong, but I did."
   *
   * This is why. A word said wrongly and then said correctly is in the audio
   * twice, the alignment places it on the correct attempt, and the word
   * scores well - so the verdict at the end of the run has nothing against
   * it. The cursor was there for the first attempt and nothing else was, so
   * what it saw has to outlive the moment it saw it.
   */
  it("lists a word that was fumbled and then recited correctly", async () => {
    const { practice, callbacks } = await startRun();

    /* Six confident phonemes belonging nowhere on the page: enough for the
       cursor to stop waiting and conclude something else was said. */
    act(() => callbacks().onUnits(say(["ق", "ط", "ب", "ز", "خ", "ص"])));
    // Then the page, correctly, from the top.
    act(() => callbacks().onUnits(say(SPOKEN[0]!.units)));
    act(() => callbacks().onUnits(say(SPOKEN[1]!.units)));
    act(() => callbacks().onScores([0.9, 0.9], [[], []]));

    expect(practice.current.completed).toBe(true);
    expect(practice.current.stoppedShort).toBe(false);
    expect(practice.current.misreadWords).toEqual([
      {
        location: "1:1:1",
        verseKey: "1:1",
        text: "بسم",
        /* What was heard in its place, written as letters. */
        heard: { kind: "stumble", letters: "قطبزخص" },
      },
    ]);
  });

  /*
   * And for a word the verdict does mark, what arrived where it should have
   * been. The word alone answers "which one" and leaves the question a
   * reciter actually has.
   */
  it("says what was heard in place of a word it marks", async () => {
    const { practice, callbacks } = await startRun();

    act(() => callbacks().onUnits(say(SPOKEN[0]!.units)));
    act(() => callbacks().onUnits(say(SPOKEN[1]!.units)));
    /*
     * Both words weak, with the recogniser's own reading of their frames.
     * An ayah is allowed one weak word before any of them is marked - see
     * `WEAK_WORDS_TOLERATED` - and these two are the whole of 1:1 here.
     */
    act(() =>
      callbacks().onScores(
        [0.01, 0.01],
        [
          ["بِ", "س"],
          ["لَ", "اا", "هِ"],
        ],
      ),
    );

    expect(practice.current.misreadWords[0]).toEqual({
      location: "1:1:1",
      verseKey: "1:1",
      text: "بسم",
      heard: { kind: "other", letters: "بِس" },
    });
    /* The second word's frames held exactly what it wanted, so there is
       nothing to show against it even though it was marked. */
    expect(practice.current.misreadWords[1]?.heard).toEqual({
      kind: "unclear",
    });
  });

  /*
   * "I want when I get a wrong word, it stops me until I figure it out."
   *
   * The cursor always waited at a word it had not heard - and then the
   * resync followed anyone who gave up and read on, reporting the word they
   * left as skipped. So "stop me at a mistake" sounded a tone and changed
   * nothing about where the run went. These four ask for the hold and for
   * both ways out of it.
   */
  describe("stopped at a wrong word", () => {
    /* Six confident phonemes belonging nowhere on the page: enough for the
       cursor to stop waiting and conclude something else was said. */
    const JUNK = ["ق", "ط", "ب", "ز", "خ", "ص"];

    it("will not move on while the reciter reads past it", async () => {
      const { practice, callbacks } = await startRun(FOUR_WORDS);

      act(() => callbacks().onUnits(say(JUNK)));
      expect(practice.current.heldAtLocation).toBe("1:1:1");

      /* Reading on, which without the hold is a confirmed run the cursor
         follows - leaving the word behind and marking it skipped. */
      act(() =>
        callbacks().onUnits(
          say([...FOUR_WORDS[1]!.units, ...FOUR_WORDS[2]!.units]),
        ),
      );

      expect(practice.current.heldAtLocation).toBe("1:1:1");
      expect(practice.current.currentWordLocation).toBe("1:1:1");
      expect(practice.current.progressIndex).toBe(0);
    });

    /*
     * Being stopped used to reveal the word in the same breath, which hands
     * someone the answer they are halfway through remembering. Seeing it is
     * the whole point of asking.
     */
    it("does not show the word until it is asked for", async () => {
      const { practice, callbacks } = await startRun(FOUR_WORDS);

      act(() => callbacks().onUnits(say(JUNK)));
      expect(practice.current.revealedLocations).not.toContain("1:1:1");

      act(() => practice.current.revealHeldWord());

      expect(practice.current.revealedLocations).toContain("1:1:1");
      /* Seeing it is not getting past it: the word still has to be recited. */
      expect(practice.current.heldAtLocation).toBe("1:1:1");
    });

    /* Reciting it is the way past that does not cost anything. */
    it("carries on once the word is actually said", async () => {
      const { practice, callbacks } = await startRun(FOUR_WORDS);

      act(() => callbacks().onUnits(say(JUNK)));
      act(() => callbacks().onUnits(say(FOUR_WORDS[0]!.units)));

      expect(practice.current.heldAtLocation).toBeNull();
      expect(practice.current.currentWordLocation).toBe("1:1:2");
    });

    /*
     * The escape hatch, and it has to exist: the recogniser does drop a
     * phoneme a learner really said, and without a way past, asking to be
     * stopped would make the run a trap whose only exit is abandoning the
     * page. What it costs is being told about it at the end.
     */
    it("lets the reciter give up on it, and says so afterwards", async () => {
      const { practice, engine, callbacks } = await startRun(FOUR_WORDS);

      act(() => callbacks().onUnits(say(JUNK)));
      act(() => practice.current.skipHeldWord());

      expect(practice.current.heldAtLocation).toBeNull();
      expect(practice.current.currentWordLocation).toBe("1:1:2");
      /* Shown, because the reciter has given up on remembering it. */
      expect(practice.current.revealedLocations).toContain("1:1:1");

      for (const word of FOUR_WORDS.slice(1)) {
        act(() => callbacks().onUnits(say(word.units)));
      }
      /* The judged stretch starts at the first word actually recited, so the
         word given up on is outside it - and still has to be reported. */
      expect(engine.score).toHaveBeenCalledWith({ from: 1, to: 4 });
      act(() => callbacks().onScores([0.9, 0.9, 0.9], [[], [], []]));

      expect(practice.current.misreadWords).toEqual([
        {
          location: "1:1:1",
          verseKey: "1:1",
          text: "بسم",
          heard: { kind: "gaveUp" },
        },
      ]);
    });

    /*
     * The switch that put them there has to get them out again. Otherwise
     * the only way on is the give-up button they had just said they did not
     * want to need.
     */
    it("lets the run go when the reader turns being stopped off", async () => {
      const { practice, callbacks } = await startRun(FOUR_WORDS);

      act(() => callbacks().onUnits(say(JUNK)));
      expect(practice.current.heldAtLocation).toBe("1:1:1");

      act(() => practice.current.toggleStopOnMistake());
      expect(practice.current.heldAtLocation).toBeNull();

      /*
       * And the cursor follows them again. Letting go drops the stray run
       * with the hold - it belonged to the word being left - so this takes a
       * fresh run of six phonemes to confirm, which is three words here.
       */
      act(() =>
        callbacks().onUnits(say(FOUR_WORDS.slice(1).flatMap((w) => w.units))),
      );
      expect(practice.current.currentWordLocation).not.toBe("1:1:1");
    });

    /*
     * The recogniser reports every 480ms, which is long enough to get a word
     * wrong and then right inside one report. Holding the run at a word the
     * reciter has already corrected is the original complaint by a new route.
     */
    it("does not stop at a word corrected inside the same report", async () => {
      const { practice, callbacks } = await startRun(FOUR_WORDS);

      /* Six strays, then the word itself, all in one batch. */
      act(() => callbacks().onUnits(say([...JUNK, ...FOUR_WORDS[0]!.units])));

      expect(practice.current.heldAtLocation).toBeNull();
      expect(practice.current.currentWordLocation).toBe("1:1:2");
    });

    /* Turned off, nothing holds: the run follows the reciter as before. */
    it("does not stop anyone who did not ask to be stopped", async () => {
      const { practice, callbacks } = await startRun(FOUR_WORDS);
      act(() => practice.current.toggleStopOnMistake());

      act(() => callbacks().onUnits(say(JUNK)));
      act(() =>
        callbacks().onUnits(
          say([...FOUR_WORDS[1]!.units, ...FOUR_WORDS[2]!.units]),
        ),
      );

      expect(practice.current.heldAtLocation).toBeNull();
      expect(practice.current.currentWordLocation).not.toBe("1:1:1");
    });
  });

  /*
   * A verdict that never arrives used to leave the run unendable.
   *
   * Reported by review. `completedRef` is set the moment scoring is asked
   * for, and from then on both stop buttons stand aside for the verdict - so
   * a recogniser that dies without answering takes the reader's only two
   * exits with it, and the bar says it is checking for good.
   */
  it("gives up on a verdict that never arrives", async () => {
    vi.useFakeTimers();
    try {
      const { practice, engine, callbacks } = await startRun();

      act(() => callbacks().onUnits(say(SPOKEN[0]!.units)));
      act(() => practice.current.finishPractice());
      expect(engine.score).toHaveBeenCalled();
      expect(practice.current.isAnalyzing).toBe(true);

      /* The worker says nothing, ever. */
      await act(async () => {
        await vi.advanceTimersByTimeAsync(VERDICT_TIMEOUT_MS + 1);
      });

      expect(practice.current.error).toBe("verdictFailed");
      expect(practice.current.active).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  /* And stops waiting once it does arrive, so the next run is not failed by
     the last one's timer. */
  it("does not fail a later run with an earlier verdict's timer", async () => {
    vi.useFakeTimers();
    try {
      const { practice, callbacks } = await startRun();

      act(() => callbacks().onUnits(say(SPOKEN[0]!.units)));
      act(() => practice.current.finishPractice());
      act(() => callbacks().onScores([0.9], [[]]));
      expect(practice.current.completed).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(VERDICT_TIMEOUT_MS + 1);
      });

      expect(practice.current.error).toBeNull();
      expect(practice.current.completed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not report a verdict that never arrived as a clean run", async () => {
    const { practice, callbacks } = await startRun();

    act(() => callbacks().onUnits(say(SPOKEN[0]!.units)));
    act(() => practice.current.finishPractice());
    act(() => callbacks().onScores([], []));

    expect(practice.current.completed).toBe(false);
    expect(practice.current.error).toBe("verdictFailed");
  });

  it("keeps a recogniser that died on screen, with what it said", async () => {
    const { practice, engine, callbacks } = await startRun();

    act(() => callbacks().onError("recogniser worker stopped", true));

    expect(practice.current.active).toBe(false);
    expect(practice.current.error).toBe("recognition");
    expect(practice.current.errorDetail).toBe("recogniser worker stopped");
    expect(engine.stop).toHaveBeenCalled();
  });

  it("reuses the loaded model for the next run", async () => {
    const { practice, engine } = await startRun();

    act(() => practice.current.stopPractice());
    await act(async () => practice.current.startPractice([]));

    expect(practiceMocks.startZipformer).toHaveBeenCalledOnce();
    expect(engine.begin).toHaveBeenCalledTimes(2);
  });

  it("fetches the model afresh after being asked to download it again", async () => {
    const { practice } = await startRun();
    vi.stubGlobal("caches", {
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
    });

    await act(async () => practice.current.clearDownloadedModel());
    await act(async () => practice.current.startPractice([]));

    expect(practiceMocks.startZipformer).toHaveBeenCalledTimes(2);
    expect(practiceMocks.startZipformer.mock.calls[1]![0]).toMatchObject({
      reload: true,
    });
    expect(practiceMocks.buildSpokenWords.mock.calls.at(-1)![1]).toEqual({
      reload: true,
    });
  });
});
