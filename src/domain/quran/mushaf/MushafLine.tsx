import type { MouseEvent, PointerEvent } from "react";
import type { MushafWord } from "../model";
import { MushafLineHighlight } from "./MushafLineHighlight";
import { MushafWordGlyph } from "./MushafWordGlyph";
import { cn } from "@/shared/lib/utils";

interface MushafLineProps {
  lineNumber: number;
  words: MushafWord[];
  spreadLayout: boolean;
  fontFamily: string;
  fontPalette?: string;
  fontReady: boolean;
  colored: boolean;
  verseTextByKey?: ReadonlyMap<string, string>;
  selectedWordLocation?: string | null;
  highlightVerseKey?: string | null;
  highlightPulse?: boolean;
  activeVerseKey?: string | null;
  activeWordLocation?: string | null;
  practiceMode?: boolean;
  hidePracticeWords?: boolean;
  revealedWordLocations?: ReadonlySet<string>;
  practiceTargetWordLocation?: string | null;
  incorrectWordLocation?: string | null;
  incorrectWordLabel?: string;
  bookmarkedVerseKeys?: ReadonlySet<string>;
  onWordActivate?: (
    word: MushafWord,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  onWordPointerDown?: (
    word: MushafWord,
    event: PointerEvent<HTMLButtonElement>,
  ) => void;
  onWordPointerUp?: () => void;
  onWordPointerCancel?: () => void;
}

function groupWordsIntoAyahRuns(words: MushafWord[]): MushafWord[][] {
  const runs: MushafWord[][] = [];

  for (const word of words) {
    const currentRun = runs[runs.length - 1];
    if (currentRun?.[0]?.verse_key === word.verse_key) {
      currentRun.push(word);
    } else {
      runs.push([word]);
    }
  }

  return runs;
}

function groupWordsForSpread(words: MushafWord[]): MushafWord[][] {
  const groups: MushafWord[][] = [];

  for (const word of words) {
    if (word.char_type === "end" && groups.length > 0) {
      groups[groups.length - 1]?.push(word);
    } else {
      groups.push([word]);
    }
  }

  return groups;
}

const EMPTY_LOCATIONS = new Set<string>();
const EMPTY_VERSE_TEXT = new Map<string, string>();

export function MushafLine({
  lineNumber,
  words,
  spreadLayout,
  fontFamily,
  fontPalette,
  fontReady,
  colored,
  verseTextByKey = EMPTY_VERSE_TEXT,
  selectedWordLocation = null,
  highlightVerseKey = null,
  highlightPulse = true,
  activeVerseKey = null,
  activeWordLocation = null,
  practiceMode = false,
  hidePracticeWords = false,
  revealedWordLocations = EMPTY_LOCATIONS,
  practiceTargetWordLocation = null,
  incorrectWordLocation = null,
  incorrectWordLabel,
  bookmarkedVerseKeys,
  onWordActivate,
  onWordPointerDown,
  onWordPointerUp,
  onWordPointerCancel,
}: MushafLineProps) {
  const highlightedVerseKey = highlightVerseKey ?? activeVerseKey;
  const lineHasHighlightedVerse =
    highlightedVerseKey !== null &&
    words.some((word) => word.verse_key === highlightedVerseKey);
  const lineHasActiveWord =
    activeWordLocation !== null &&
    words.some((word) => word.location === activeWordLocation);
  const showHighlight =
    fontReady && (lineHasHighlightedVerse || lineHasActiveWord);
  const wordZIndexes = new Map(
    words.map((word, index) => [word.location, words.length - index + 1]),
  );
  const verseInteractive = fontReady && Boolean(onWordActivate);

  const renderWord = (word: MushafWord) => {
    const hidden =
      practiceMode &&
      hidePracticeWords &&
      word.char_type !== "end" &&
      !revealedWordLocations.has(word.location);

    return (
      <MushafWordGlyph
        key={word.location}
        word={word}
        fontFamily={fontFamily}
        fontPalette={fontPalette}
        fontReady={fontReady}
        colored={colored}
        selected={selectedWordLocation === word.location}
        practiceTarget={
          practiceMode &&
          word.char_type !== "end" &&
          practiceTargetWordLocation === word.location
        }
        hidden={hidden}
        incorrect={practiceMode && incorrectWordLocation === word.location}
        incorrectLabel={incorrectWordLabel}
        bookmarked={
          word.char_type === "end" &&
          Boolean(bookmarkedVerseKeys?.has(word.verse_key))
        }
        wordZIndex={wordZIndexes.get(word.location)}
        onActivate={onWordActivate}
        onPointerDown={onWordPointerDown}
        onPointerUp={onWordPointerUp}
        onPointerCancel={onWordPointerCancel}
      />
    );
  };

  const renderAyahRun = (run: MushafWord[]) => {
    const verseKey = run[0]?.verse_key ?? "";
    const verseText = verseTextByKey.get(verseKey);
    const runKey = run.map((word) => word.location).join("-");

    const content = spreadLayout
      ? groupWordsForSpread(run).map((group) => (
          <span
            key={group.map((word) => word.location).join("-")}
            className="mushaf-word-group"
          >
            {group.map(renderWord)}
          </span>
        ))
      : run.map(renderWord);

    if (!verseText) {
      return (
        <span
          key={runKey}
          className="mushaf-ayah-run"
          data-verse-key={verseKey}
        >
          {content}
        </span>
      );
    }

    return (
      <span
        key={runKey}
        role="group"
        className="mushaf-ayah-run"
        data-verse-key={verseKey}
        aria-label={verseText}
        // Verse-level focus carries plain Arabic text for screen readers.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- intentional verse target
        tabIndex={verseInteractive ? 0 : undefined}
      >
        {content}
      </span>
    );
  };

  return (
    <div
      className={cn(
        "mushaf-line",
        spreadLayout && "mushaf-line--full mushaf-line--spread",
      )}
      data-line={lineNumber}
      style={spreadLayout ? { zIndex: 16 - lineNumber } : undefined}
      dir="rtl"
      lang="ar"
    >
      <div
        className={spreadLayout ? "mushaf-line__verse" : "mushaf-line__content"}
      >
        {showHighlight ? (
          <MushafLineHighlight
            verseKey={lineHasHighlightedVerse ? highlightedVerseKey : null}
            activeWordLocation={lineHasActiveWord ? activeWordLocation : null}
            pulse={
              highlightPulse &&
              highlightVerseKey !== null &&
              lineHasHighlightedVerse &&
              highlightVerseKey === highlightedVerseKey
            }
            enabled
          />
        ) : null}

        {groupWordsIntoAyahRuns(words).map(renderAyahRun)}
      </div>
    </div>
  );
}
