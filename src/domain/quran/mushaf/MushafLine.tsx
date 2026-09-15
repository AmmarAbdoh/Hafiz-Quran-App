import type { KeyboardEvent } from "react";
import type { MushafWord } from "../model";
import { MushafLineHighlight } from "./MushafLineHighlight";
import { MushafWordGlyph } from "./MushafWordGlyph";
import type {
  MushafWordActivateHandler,
  MushafWordPointerHandler,
} from "./wordActivation";
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
  onWordActivate?: MushafWordActivateHandler;
  onWordPointerDown?: MushafWordPointerHandler;
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
    /*
     * Any word of the run can stand in for it: the reader treats a keyboard
     * activation as ayah-level whichever one arrives, because an ayah running
     * over several lines carries its end marker only on the last of them.
     */
    const representativeWord = run[0];

    /*
     * On a full page the run itself is `display: contents` - it has to be, so
     * the word groups become flex items of the line and justify across the
     * whole measure - which leaves it with no box and makes it impossible to
     * focus. The ayah's first word group is a real box in the same place, so
     * that is what carries the keyboard affordance there.
     */
    const keyboardTarget =
      verseInteractive && verseText && representativeWord
        ? {
            role: "button" as const,
            "aria-label": verseText,
            "aria-haspopup": "dialog" as const,
            tabIndex: 0,
            onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onWordActivate?.(representativeWord, event);
            },
          }
        : null;

    const content = spreadLayout
      ? groupWordsForSpread(run).map((group, groupIndex) => (
          <span
            key={group.map((word) => word.location).join("-")}
            className={cn(
              "mushaf-word-group",
              groupIndex === 0 && keyboardTarget && "mushaf-word-group--ayah",
            )}
            {...(groupIndex === 0 ? keyboardTarget : null)}
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

    /*
     * The ayah is the only thing on the page a keyboard reaches: the glyphs are
     * aria-hidden and kept out of the tab order, because announcing a page one
     * glyph at a time would be unusable. Where the run has a box of its own it
     * carries the affordance; on a full page its first word group does, which
     * is why the run is left as a plain group there.
     */
    const wordGroupIsTheControl = spreadLayout && Boolean(keyboardTarget);

    return (
      <span
        key={runKey}
        role="group"
        className="mushaf-ayah-run"
        data-verse-key={verseKey}
        // The control carries the ayah text. Repeating it on the group that
        // wraps it would read every ayah out twice.
        aria-label={wordGroupIsTheControl ? undefined : verseText}
        {...(spreadLayout ? null : keyboardTarget)}
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
