import { useRef, type MouseEvent } from "react";
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
  selectedWordLocation?: string | null;
  highlightVerseKey?: string | null;
  activeVerseKey?: string | null;
  activeWordLocation?: string | null;
  practiceMode?: boolean;
  hidePracticeWords?: boolean;
  revealedWordLocations?: ReadonlySet<string>;
  practiceTargetWordLocation?: string | null;
  incorrectWordLocation?: string | null;
  incorrectWordLabel?: string;
  getWordActivationLabel?: (word: MushafWord) => string;
  onWordActivate?: (
    word: MushafWord,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
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

export function MushafLine({
  lineNumber,
  words,
  spreadLayout,
  fontFamily,
  fontPalette,
  fontReady,
  colored,
  selectedWordLocation = null,
  highlightVerseKey = null,
  activeVerseKey = null,
  activeWordLocation = null,
  practiceMode = false,
  hidePracticeWords = false,
  revealedWordLocations = EMPTY_LOCATIONS,
  practiceTargetWordLocation = null,
  incorrectWordLocation = null,
  incorrectWordLabel,
  getWordActivationLabel,
  onWordActivate,
}: MushafLineProps) {
  const lineContentRef = useRef<HTMLDivElement>(null);
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
        wordZIndex={wordZIndexes.get(word.location)}
        getActivationLabel={getWordActivationLabel}
        onActivate={onWordActivate}
      />
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
        ref={lineContentRef}
        className={spreadLayout ? "mushaf-line__verse" : "mushaf-line__content"}
      >
        {showHighlight ? (
          <MushafLineHighlight
            containerRef={lineContentRef}
            verseKey={lineHasHighlightedVerse ? highlightedVerseKey : null}
            activeWordLocation={lineHasActiveWord ? activeWordLocation : null}
            pulse={
              highlightVerseKey !== null &&
              lineHasHighlightedVerse &&
              highlightVerseKey === highlightedVerseKey
            }
            enabled
          />
        ) : null}

        {spreadLayout
          ? groupWordsIntoAyahRuns(words).map((run) => (
              <span
                key={run.map((word) => word.location).join("-")}
                className="mushaf-ayah-run"
                data-verse-key={run[0]?.verse_key ?? ""}
              >
                {groupWordsForSpread(run).map((group) => (
                  <span
                    key={group.map((word) => word.location).join("-")}
                    className="mushaf-word-group"
                  >
                    {group.map(renderWord)}
                  </span>
                ))}
              </span>
            ))
          : words.map(renderWord)}
      </div>
    </div>
  );
}
