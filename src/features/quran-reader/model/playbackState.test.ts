import { describe, expect, it } from "vitest";
import {
  initialQuranPlaybackState,
  quranPlaybackReducer,
} from "./playbackState";
import { MediaOperationController } from "@/features/quran-reader/services/mediaOperationController";

describe("quranPlaybackReducer", () => {
  it("publishes semantic item and status changes", () => {
    const ready = quranPlaybackReducer(initialQuranPlaybackState, {
      type: "item-ready",
      item: {
        surah: 2,
        surahName: "البقرة",
        ayah: 255,
        reciterName: "قارئ",
        supportsWordHighlight: true,
        scopePlan: {
          scope: "ayah",
          surah: 2,
          ayah: 255,
          repeatMode: "none",
          repeatCount: 1,
        },
        playlistIndex: 1,
        playlistTotal: 3,
        repeatMode: "none",
        repeatCount: 1,
        repeatEachAyah: false,
        repeatIteration: 1,
      },
    });

    expect(ready).toMatchObject({
      active: true,
      playing: false,
      activeVerseKey: "2:255",
      currentAyah: 255,
    });

    const playing = quranPlaybackReducer(ready, {
      type: "playback-changed",
      playing: true,
      error: null,
    });
    expect(playing.playing).toBe(true);
    expect(
      quranPlaybackReducer(playing, {
        type: "playback-changed",
        playing: true,
        error: null,
      }),
    ).toBe(playing);
  });
});

describe("MediaOperationController", () => {
  it("aborts and invalidates replaced operations", () => {
    const controller = new MediaOperationController();
    const first = controller.begin();
    const second = controller.begin();

    expect(first.signal.aborted).toBe(true);
    expect(controller.isCurrent(first)).toBe(false);
    expect(controller.isCurrent(second)).toBe(true);

    controller.cancel();
    expect(second.signal.aborted).toBe(true);
    expect(controller.isCurrent(second)).toBe(false);
  });
});
