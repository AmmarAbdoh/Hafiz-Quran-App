import { cn } from "@/shared/lib/utils";
import type { MushafWord as MushafWordType } from "@/shared/types/quran";

interface MushafWordProps {
  word: MushafWordType;
  fontFamily: string;
  fontPalette?: string;
  fontReady: boolean;
  colored: boolean;
  isWordSelected: boolean;
  isPracticeTarget?: boolean;
  practiceHidden?: boolean;
  practiceWrongFlash?: boolean;
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
  isWordSelected,
  isPracticeTarget = false,
  practiceHidden = false,
  practiceWrongFlash = false,
  wordZIndex,
  onWordActivate,
}: MushafWordProps) {
  const isEnd = word.char_type === "end";
  const isClickable =
    fontReady && Boolean(onWordActivate) && !practiceHidden;

  const className = cn(
    "mushaf-word",
    isEnd && "mushaf-word-end",
    !fontReady && "opacity-0",
    fontReady && !colored && "mushaf-word-plain",
    isClickable && "cursor-pointer transition-colors",
    isWordSelected && "mushaf-word--word-selected",
    isPracticeTarget && "mushaf-word--reciting",
    practiceHidden && "mushaf-word--practice-hidden",
    practiceWrongFlash && "mushaf-word--practice-wrong",
  );

  const style = fontReady
    ? {
        fontFamily,
        ...(fontPalette ? { fontPalette } : {}),
        ...(wordZIndex != null ? { zIndex: wordZIndex } : {}),
      }
    : undefined;

  const sharedProps = {
    "data-location": word.location,
    "data-verse-key": word.verse_key,
    "data-char-type": word.char_type,
    className,
    style,
  };

  if (practiceWrongFlash) {
    return (
      <span
        {...sharedProps}
        dangerouslySetInnerHTML={{ __html: word.code_v2 }}
        aria-label="كلمة خاطئة"
      />
    );
  }

  if (practiceHidden) {
    return (
      <span
        {...sharedProps}
        className={cn(className, "mushaf-word--practice-placeholder")}
        aria-hidden
      >
        <span
          className="mushaf-word__glyph"
          style={style}
          dangerouslySetInnerHTML={{ __html: word.code_v2 }}
        />
      </span>
    );
  }

  return (
    <span
      {...sharedProps}
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
