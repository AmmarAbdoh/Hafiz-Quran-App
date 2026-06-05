import { cn } from "@/shared/lib/utils";
import type { MushafWord as MushafWordType } from "@/shared/types/quran";

interface MushafWordProps {
  word: MushafWordType;
  fontFamily: string;
  fontPalette?: string;
  fontReady: boolean;
  colored: boolean;
  isAyahSelected: boolean;
  isWordSelected: boolean;
  isVerseHighlighted: boolean;
  isRecitingWord: boolean;
  wordZIndex?: number;
  onWordActivate?: (
    word: MushafWordType,
    event: React.MouseEvent<HTMLElement>,
  ) => void;
}

export function MushafWord({
  word,
  fontFamily,
  fontPalette,
  fontReady,
  colored,
  isAyahSelected,
  isWordSelected,
  isVerseHighlighted,
  isRecitingWord,
  wordZIndex,
  onWordActivate,
}: MushafWordProps) {
  const isEnd = word.char_type === "end";
  const isClickable = fontReady && Boolean(onWordActivate);

  return (
    <span
      data-location={word.location}
      data-verse-key={word.verse_key}
      data-char-type={word.char_type}
      className={cn(
        "mushaf-word",
        isEnd && "mushaf-word-end",
        !fontReady && "opacity-0",
        fontReady && !colored && "mushaf-word-plain",
        isClickable && "cursor-pointer transition-colors",
        isAyahSelected && "mushaf-word--ayah-selected",
        isWordSelected && "mushaf-word--word-selected",
        isVerseHighlighted && "mushaf-word-highlight rounded",
        isRecitingWord && "mushaf-word--reciting",
      )}
      style={
        fontReady
          ? {
              fontFamily,
              ...(fontPalette ? { fontPalette } : {}),
              ...(wordZIndex != null ? { zIndex: wordZIndex } : {}),
            }
          : undefined
      }
      dangerouslySetInnerHTML={{ __html: word.code_v2 }}
      onClick={
        isClickable
          ? (event) => {
              event.stopPropagation();
              onWordActivate!(word, event);
            }
          : undefined
      }
    />
  );
}
