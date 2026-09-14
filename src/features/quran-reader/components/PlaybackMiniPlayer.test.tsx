// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/domain/quran", () => ({
  SURAH_AYAH_COUNTS: [7],
  useSurahNames: () => ({
    names: ["الفاتحة"],
    surahName: (surahNumber: number) =>
      surahNumber === 1 ? "الفاتحة" : String(surahNumber),
    language: "ar",
  }),
  getAyahAudioUrl: () => "ayah.mp3",
  getQuranComRecitationId: () => null,
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
  fetchSurahAudioMeta: vi.fn(),
  fetchVerseAudioData: vi.fn(),
  findActiveWordLocation: () => null,
  mergeWordSegments: (segments: unknown) => segments,
}));

import { LocaleProvider } from "@/app/i18n";
import {
  QuranPlaybackProvider,
  useQuranPlaybackActions,
  type QuranPlaybackActions,
} from "../context/QuranPlaybackContext";
import { PlaybackMiniPlayer } from "./PlaybackMiniPlayer";

class FakeAudio {
  currentTime = 0;
  duration = 1;
  paused = false;
  ended = false;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn(() => {
    this.paused = true;
  });
  removeAttribute = vi.fn();
  addEventListener() {}
  removeEventListener() {}

  constructor(public readonly src: string) {}
}

describe("PlaybackMiniPlayer", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("Audio", FakeAudio);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("keeps the recitation reachable outside the reader and returns to its ayah", async () => {
    let actions!: QuranPlaybackActions;
    let pathname = "";

    function ActionsProbe() {
      actions = useQuranPlaybackActions();
      pathname = useLocation().pathname;
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/"]}>
        <LocaleProvider>
          <QuranPlaybackProvider>
            <ActionsProbe />
            <PlaybackMiniPlayer />
          </QuranPlaybackProvider>
        </LocaleProvider>
      </MemoryRouter>,
    );

    // Nothing is playing yet, so the shell carries no extra chrome.
    expect(screen.queryByText("الفاتحة")).not.toBeInTheDocument();

    await act(async () => {
      await actions.startListening({
        playlist: [{ surah: 1, ayah: 3 }],
        repeatMode: "none",
        repeatCount: 1,
        repeatEachAyah: false,
        plan: {
          scope: "surah",
          surah: 1,
          ayah: 3,
          repeatMode: "none",
          repeatCount: 1,
        },
      });
    });

    expect(screen.getByText("الفاتحة")).toBeInTheDocument();
    expect(screen.getByText(/آية ٣/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "إيقاف التلاوة" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("انتقل إلى صفحة الآية الجارية"));
    expect(pathname).toBe("/quran/surah/1/ayah/3");

    act(() => actions.stop());
    expect(screen.queryByText("الفاتحة")).not.toBeInTheDocument();
  });
});
