// @vitest-environment jsdom

import { useRef, type MouseEvent as ReactMouseEvent } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VerseActionsPopover } from "@/features/quran-reader/components/VerseActionsPopover";
import type { MushafWord } from "@/domain/quran";
import { useMushafVerseInteractions } from "./useMushafVerseInteractions";

const playback = vi.hoisted(() => ({
  startAyahPlayback: vi.fn(() => Promise.resolve()),
  stop: vi.fn(),
}));

const audio = vi.hoisted(() => ({
  play: vi.fn(() => Promise.resolve()),
  stop: vi.fn(),
}));

vi.mock("@/features/quran-reader/context/QuranPlaybackContext", () => ({
  useQuranPlaybackActions: () => playback,
  useQuranPlaybackState: () => ({ active: false }),
}));

vi.mock("@/features/quran-reader/hooks/useQuranAudio", () => ({
  useQuranAudio: () => ({ ...audio, playing: false }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const fallbackWord: MushafWord = {
  verse_key: "1:1",
  sura: 1,
  aya: 1,
  word: 1,
  location: "1:1:1",
  line: 1,
  page: 1,
  code_v2: "fallback",
  char_type: "word",
};

const overlappingWord: MushafWord = {
  ...fallbackWord,
  word: 2,
  location: "1:1:2",
  code_v2: "overlapping",
};

function makeRect(left: number, top: number, width: number, height: number) {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function setClientRect(element: HTMLElement, rect: DOMRect) {
  const rects = Object.assign([rect], {
    item: (index: number) => (index === 0 ? rect : null),
  }) as DOMRectList;

  Object.defineProperty(element, "getClientRects", {
    configurable: true,
    value: () => rects,
  });
}

function InteractionHarness() {
  const mushafRef = useRef<HTMLDivElement>(null);
  const interactions = useMushafVerseInteractions({
    mushafRef,
    mushafData: [],
    wordsByLocation: new Map([
      [fallbackWord.location, fallbackWord],
      [overlappingWord.location, overlappingWord],
    ]),
  });
  const activateFallback = (event: ReactMouseEvent<HTMLButtonElement>) => {
    interactions.activateWord(fallbackWord, event);
  };

  return (
    <>
      <div ref={mushafRef}>
        <div className="mushaf-line">
          <button
            type="button"
            className="mushaf-word"
            data-location={fallbackWord.location}
            onClick={activateFallback}
          >
            Fallback word
          </button>
          <button
            type="button"
            className="mushaf-word"
            data-location={overlappingWord.location}
          >
            Overlapping word
          </button>
        </div>
      </div>

      <output data-testid="selected-word">
        {interactions.selection?.word.location ?? "none"}
      </output>

      {interactions.selection && interactions.anchorRect ? (
        <VerseActionsPopover
          verseKey={interactions.selection.verseKey}
          wordLocation={interactions.selection.word.location}
          mode={interactions.selection.mode}
          anchor={interactions.anchorRect}
          playingTarget={null}
          onListenAyah={vi.fn()}
          onTafseer={vi.fn()}
          onClose={interactions.clearSelection}
          popoverRef={interactions.popoverRef}
        />
      ) : null}
    </>
  );
}

function prepareOverlappingWords() {
  render(<InteractionHarness />);
  const fallback = screen.getByRole("button", { name: "Fallback word" });
  const overlapping = screen.getByRole("button", {
    name: "Overlapping word",
  });

  setClientRect(fallback, makeRect(10, 10, 10, 10));
  setClientRect(overlapping, makeRect(0, 0, 5, 5));

  return { fallback };
}

describe("useMushafVerseInteractions", () => {
  it("uses the activated word for keyboard clicks and hit-tests pointer clicks", async () => {
    const { fallback } = prepareOverlappingWords();

    fireEvent.click(fallback, { detail: 0, clientX: 0, clientY: 0 });
    expect(screen.getByTestId("selected-word")).toHaveTextContent("1:1:1");

    fireEvent.click(fallback, { detail: 1, clientX: 2, clientY: 2 });
    expect(screen.getByTestId("selected-word")).toHaveTextContent("1:1:2");

    await screen.findByRole("dialog");
  });

  it.each(["close button", "Escape"])(
    "restores focus to the originating word after %s",
    async (closeMethod) => {
      const { fallback } = prepareOverlappingWords();
      fallback.focus();

      fireEvent.click(fallback, { detail: 0, clientX: 0, clientY: 0 });
      const closeButton = await screen.findByRole("button", {
        name: "actions.close",
      });
      await waitFor(() => expect(closeButton).toHaveFocus());

      if (closeMethod === "Escape") {
        fireEvent.keyDown(document, { key: "Escape" });
      } else {
        fireEvent.click(closeButton);
      }

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(fallback).toHaveFocus();
      });
    },
  );
});
