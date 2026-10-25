// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface PlaybackDouble {
  state: {
    active: boolean;
    activeVerseKey: string | null;
    autoFollowPages: boolean;
  };
  highlight: { activeWordLocation: string | null };
}

const playback = vi.hoisted(
  (): PlaybackDouble => ({
    state: { active: true, activeVerseKey: "2:10", autoFollowPages: true },
    highlight: { activeWordLocation: "2:10:3" },
  }),
);

vi.mock("@/features/quran-reader/context/QuranPlaybackContext", () => ({
  useQuranPlaybackState: () => playback.state,
  useQuranPlaybackHighlight: () => playback.highlight,
}));

import { PlaybackScrollFollower } from "./PlaybackScrollFollower";

/*
 * jsdom lays nothing out, so the page is given its geometry by hand: a stage
 * 800px tall at the top of the screen holding a page that scrolls 1,000px,
 * as page 3 does at 1.3x text.
 */
const STAGE = { top: 0, bottom: 800 };

function placeOnScreen(
  element: HTMLElement,
  box: { top: number; bottom: number },
) {
  element.getBoundingClientRect = () => ({
    ...box,
    left: 0,
    right: 100,
    width: 100,
    height: box.bottom - box.top,
    x: 0,
    y: box.top,
    toJSON: () => box,
  });
}

function mountStage() {
  const stage = document.createElement("div");
  stage.className = "mushaf-stage";
  Object.defineProperty(stage, "scrollHeight", { value: 1_800 });
  Object.defineProperty(stage, "clientHeight", { value: 800 });
  stage.scrollTop = 0;
  const scrollTo = vi.fn<(options: ScrollToOptions) => void>();
  stage.scrollTo = scrollTo as unknown as typeof stage.scrollTo;
  placeOnScreen(stage, STAGE);
  document.body.append(stage);
  return { stage, scrollTo };
}

function addWord(
  stage: HTMLElement,
  location: string,
  box: { top: number; bottom: number },
) {
  const word = document.createElement("span");
  word.dataset.location = location;
  word.dataset.verseKey = location.split(":").slice(0, 2).join(":");
  placeOnScreen(word, box);
  stage.append(word);
  return word;
}

describe("following the recitation down a page that scrolls", () => {
  let frames: FrameRequestCallback[];
  const runFrames = (count = 1) =>
    act(() => {
      for (let i = 0; i < count; i += 1) {
        const pending = frames;
        frames = [];
        for (const frame of pending) frame(performance.now());
      }
    });

  beforeEach(() => {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    playback.state = {
      active: true,
      activeVerseKey: "2:10",
      autoFollowPages: true,
    };
    playback.highlight = { activeWordLocation: "2:10:3" };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("scrolls the word being recited back into view once it has gone below", () => {
    const { stage, scrollTo } = mountStage();
    addWord(stage, "2:10:3", { top: 900, bottom: 950 });

    render(<PlaybackScrollFollower page={3} />);
    runFrames();

    expect(scrollTo).toHaveBeenCalledOnce();
    const top = scrollTo.mock.calls[0]![0].top ?? 0;
    /* A third of the way down, so what comes next is visible below it. */
    expect(top).toBeGreaterThan(0);
    expect(900 - top).toBeGreaterThan(STAGE.bottom * 0.2);
    expect(900 - top).toBeLessThan(STAGE.bottom * 0.4);
  });

  it("leaves the page alone while the word is comfortably in view", () => {
    const { stage, scrollTo } = mountStage();
    addWord(stage, "2:10:3", { top: 300, bottom: 350 });

    render(<PlaybackScrollFollower page={3} />);
    runFrames();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  /*
   * After a page turn the new page lays out a moment after the route
   * changes, and the ayah it is following does not exist until it does.
   */
  it("waits for the next page to be laid out, then brings the ayah into view", () => {
    const { stage, scrollTo } = mountStage();
    playback.highlight = { activeWordLocation: null };
    playback.state = { ...playback.state, activeVerseKey: "2:17" };

    render(<PlaybackScrollFollower page={4} />);
    runFrames(3);
    expect(scrollTo).not.toHaveBeenCalled();

    addWord(stage, "2:17:1", { top: 1_400, bottom: 1_450 });
    runFrames();

    expect(scrollTo).toHaveBeenCalledOnce();
  });

  it("does not pull back a reader who scrolled away themselves", () => {
    const { stage, scrollTo } = mountStage();
    addWord(stage, "2:10:3", { top: 900, bottom: 950 });
    playback.state = { ...playback.state, autoFollowPages: false };

    render(<PlaybackScrollFollower page={3} />);
    runFrames();

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
