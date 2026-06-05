import { MushafWord } from "@/features/quran-reader/components/MushafWord";
import { cn } from "@/shared/lib/utils";
import type { VerseSelection } from "@/features/quran-reader/types/selection";
import type { MushafWord as MushafWordType } from "@/shared/types/quran";

interface SpreadWordGroup {
  verseKey: string;
  words: MushafWordType[];
}

function buildSpreadWordGroups(words: MushafWordType[]): SpreadWordGroup[] {
  const groups: SpreadWordGroup[] = [];

  for (const word of words) {
    if (word.char_type === "end" && groups.length > 0) {
      groups[groups.length - 1]!.words.push(word);
      continue;
    }

    groups.push({ verseKey: word.verse_key, words: [word] });
  }

  return groups;
}

interface MushafLineProps {
  lineNumber: number;
  words: MushafWordType[];
  spreadLayout: boolean;
  fontFamily: string;
  fontPalette?: string;
  fontReady: boolean;
  colored: boolean;
  selection: VerseSelection | null;
  highlightVerseKey: string | null;
  recitationVerseKey: string | null;
  recitationWordLocation: string | null;
  onWordActivate?: (
    word: MushafWordType,
    event: React.MouseEvent<HTMLElement>,
  ) => void;
}

export function MushafLine({
  lineNumber,
  words,
  spreadLayout,
  fontFamily,
  fontPalette,
  fontReady,
  colored,
  selection,
  highlightVerseKey,
  recitationVerseKey,
  recitationWordLocation,
  onWordActivate,
}: MushafLineProps) {
  const wordZIndexByLocation = new Map(
    words.map((word, index) => [word.location, words.length - index]),
  );

  const renderWord = (word: MushafWordType) => {
    const isAyahSelected =
      selection?.mode === "ayah" && selection.verseKey === word.verse_key;
    const isWordSelected =
      selection?.mode === "word" &&
      selection.word.location === word.location;
    const isRecitingWord = recitationWordLocation === word.location;

    return (
      <MushafWord
        key={word.location}
        word={word}
        fontFamily={fontFamily}
        fontPalette={fontPalette}
        fontReady={fontReady}
        colored={colored}
        isAyahSelected={!spreadLayout && isAyahSelected}
        isWordSelected={isWordSelected}
        isVerseHighlighted={highlightVerseKey === word.verse_key}
        isRecitingWord={isRecitingWord}
        wordZIndex={wordZIndexByLocation.get(word.location)}
        onWordActivate={onWordActivate}
      />
    );
  };

  const spreadGroups = buildSpreadWordGroups(words);

  return (
    <div
      className={cn(
        "mushaf-line",
        spreadLayout && "mushaf-line--full mushaf-line--spread",
      )}
      data-line={lineNumber}
      style={spreadLayout ? { zIndex: 16 - lineNumber } : undefined}
    >
      {spreadLayout ? (
        <div className="mushaf-line__verse">
          {spreadGroups.map((group) => {
            const isRecitingAyah = recitationVerseKey === group.verseKey;
            const isAyahSelected =
              selection?.mode === "ayah" &&
              selection.verseKey === group.verseKey;

            return (
              <span
                key={group.words.map((word) => word.location).join("-")}
                className={cn(
                  "mushaf-word-group",
                  isRecitingAyah && "mushaf-word-group--reciting",
                  isAyahSelected && "mushaf-word-group--selected",
                )}
                data-verse-key={group.verseKey}
              >
                {group.words.map(renderWord)}
              </span>
            );
          })}
        </div>
      ) : (
        words.map(renderWord)
      )}
    </div>
  );
}
