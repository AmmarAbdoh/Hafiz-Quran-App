// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const playbackTestState = vi.hoisted(() => ({
  activeWord: null as string | null,
}));

vi.mock("@/domain/quran", () => ({
  SURAH_AYAH_COUNTS: [7],
  SURAH_NAMES: ["Al-Fatihah"],
  getAyahAudioUrl: () => "ayah.mp3",
  getQuranComRecitationId: () => 7,
  useReciter: () => ({
    reciter: {
      id: "ea-Alafasy_128kbps",
      nameAr: "القارئ",
      nameEn: "Reciter",
      category: "hafs",
      source: "everyayah",
      folder: "Alafasy_128kbps",
    },
  }),
  fetchSurahAudioMeta: vi.fn().mockResolvedValue({
    surahDurationMs: 1_000,
    ayahTimestamps: [
      {
        verseKey: "1:1",
        ayah: 1,
        startMs: 0,
        endMs: 1_000,
        durationMs: 1_000,
        chapterSegments: [],
      },
    ],
  }),
  fetchVerseAudioData: vi.fn().mockResolvedValue({
    audioUrl: "ayah.mp3",
    segments: [],
    wordsByPosition: new Map(),
  }),
  findActiveWordLocation: () => playbackTestState.activeWord,
  mergeWordSegments: (segments: unknown) => segments,
}));

import {
  QuranPlaybackProvider,
  useQuranPlaybackActions,
  useQuranPlaybackHighlight,
  useQuranPlaybackState,
  type QuranPlaybackActions,
} from "../context/QuranPlaybackContext";

const created: FakeAudio[] = [];

class FakeAudio {
  preload = "";
  currentTime = 0;
  duration = 1;
  paused = false;
  ended = false;
  listeners = new Map<string, Set<EventListener>>();
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  removeAttribute = vi.fn();

  constructor(public readonly src: string) {
    created.push(this);
  }

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }
}

describe("QuranPlaybackProvider render channels", () => {
  let nextFrameId = 0;
  let frames: Map<number, FrameRequestCallback>;

  beforeEach(() => {
    playbackTestState.activeWord = null;
    created.length = 0;
    frames = new Map();
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      nextFrameId += 1;
      frames.set(nextFrameId, callback);
      return nextFrameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("does not republish state or an unchanged active word on animation frames", async () => {
    let actions!: QuranPlaybackActions;
    let stateRenders = 0;
    let highlightRenders = 0;

    function StateProbe() {
      useQuranPlaybackState();
      stateRenders += 1;
      return null;
    }
    function HighlightProbe() {
      useQuranPlaybackHighlight();
      highlightRenders += 1;
      return null;
    }
    function ActionsProbe() {
      actions = useQuranPlaybackActions();
      return null;
    }
    const runFrame = () => {
      const entry = [...frames.entries()].at(-1);
      expect(entry).toBeDefined();
      frames.delete(entry![0]);
      entry![1](performance.now());
    };

    render(
      <QuranPlaybackProvider>
        <StateProbe />
        <HighlightProbe />
        <ActionsProbe />
      </QuranPlaybackProvider>,
    );

    await act(async () => {
      await actions.startListening({
        playlist: [{ surah: 1, ayah: 1 }],
        repeatMode: "none",
        repeatCount: 1,
        repeatEachAyah: false,
        plan: {
          scope: "ayah",
          surah: 1,
          ayah: 1,
          repeatMode: "none",
          repeatCount: 1,
        },
      });
    });
    const stateRendersAfterStart = stateRenders;
    const highlightRendersAfterStart = highlightRenders;

    playbackTestState.activeWord = "1:1:1";
    act(runFrame);
    expect(stateRenders).toBe(stateRendersAfterStart);
    expect(highlightRenders).toBe(highlightRendersAfterStart + 1);

    act(runFrame);
    expect(stateRenders).toBe(stateRendersAfterStart);
    expect(highlightRenders).toBe(highlightRendersAfterStart + 1);

    playbackTestState.activeWord = "1:1:2";
    act(runFrame);
    expect(stateRenders).toBe(stateRendersAfterStart);
    expect(highlightRenders).toBe(highlightRendersAfterStart + 2);
  });

  /*
   * "There is stoppage time in between, it kind of ruins the voice." Each
   * ayah is its own file, and the next was only asked for once the last had
   * ended - 240-290ms of silence measured on a fast connection.
   */
  it("has the next ayah loading before this one ends, and plays that", async () => {
    let actions!: QuranPlaybackActions;
    function ActionsProbe() {
      actions = useQuranPlaybackActions();
      return null;
    }
    const settle = () =>
      act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    render(
      <QuranPlaybackProvider>
        <ActionsProbe />
      </QuranPlaybackProvider>,
    );

    await act(async () => {
      await actions.startListening({
        playlist: [
          { surah: 1, ayah: 1 },
          { surah: 1, ayah: 2 },
        ],
        repeatMode: "none",
        repeatCount: 1,
        repeatEachAyah: false,
        plan: {
          scope: "surah",
          surah: 1,
          ayah: 1,
          repeatMode: "none",
          repeatCount: 1,
        },
      });
    });
    await settle();

    /* The second ayah is already loading while the first plays. */
    expect(created).toHaveLength(2);
    expect(created[1]?.preload).toBe("auto");

    const ended = [...created[0]!.listeners.get("ended")!][0]!;
    act(() => ended(new Event("ended")));
    await settle();

    /* And it is that element that plays, not a new one made only now. */
    expect(created).toHaveLength(2);
    expect(created[1]?.play).toHaveBeenCalled();
  });
});
