import type { CSSProperties, MouseEvent } from "react";
import type { MushafWord } from "../model";
import { cn } from "@/shared/lib/utils";

type MushafWordActivationHandler = (
  word: MushafWord,
  event: MouseEvent<HTMLButtonElement>,
) => void;

interface MushafWordGlyphProps {
  word: MushafWord;
  fontFamily: string;
  fontPalette?: string;
  fontReady?: boolean;
  colored?: boolean;
  selected?: boolean;
  practiceTarget?: boolean;
  hidden?: boolean;
  incorrect?: boolean;
  incorrectLabel?: string;
  wordZIndex?: number;
  getActivationLabel?: (word: MushafWord) => string;
  onActivate?: MushafWordActivationHandler;
}

type MushafGlyphStyle = CSSProperties & { fontPalette?: string };

export function MushafWordGlyph({
  word,
  fontFamily,
  fontPalette,
  fontReady = true,
  colored = false,
  selected = false,
  practiceTarget = false,
  hidden = false,
  incorrect = false,
  incorrectLabel,
  wordZIndex,
  getActivationLabel,
  onActivate,
}: MushafWordGlyphProps) {
  const interactive = fontReady && Boolean(onActivate) && !hidden && !incorrect;
  const className = cn(
    "mushaf-word",
    word.char_type === "end" && "mushaf-word-end",
    !fontReady && "opacity-0",
    fontReady && !colored && "mushaf-word-plain",
    interactive && "mushaf-word--interactive",
    selected && "mushaf-word--word-selected",
    practiceTarget && "mushaf-word--reciting",
    hidden && "mushaf-word--practice-hidden",
    incorrect && "mushaf-word--practice-wrong",
  );
  const style: MushafGlyphStyle | undefined = fontReady
    ? {
        fontFamily,
        ...(fontPalette ? { fontPalette } : {}),
        ...(wordZIndex !== undefined ? { zIndex: wordZIndex } : {}),
      }
    : undefined;
  const contentAttributes = {
    "data-location": word.location,
    "data-verse-key": word.verse_key,
    "data-char-type": word.char_type,
    className,
    style,
    dir: "rtl" as const,
    lang: "ar",
  };

  if (incorrect) {
    return (
      <span
        {...contentAttributes}
        aria-label={incorrectLabel ?? word.code_v2}
        role="status"
      >
        {word.code_v2}
      </span>
    );
  }

  if (hidden) {
    return (
      <span
        {...contentAttributes}
        className={cn(className, "mushaf-word--practice-placeholder")}
        aria-hidden
      >
        <span className="mushaf-word__glyph" style={style}>
          {word.code_v2}
        </span>
      </span>
    );
  }

  if (!interactive) {
    return <span {...contentAttributes}>{word.code_v2}</span>;
  }

  return (
    <button
      {...contentAttributes}
      type="button"
      aria-label={getActivationLabel?.(word) ?? word.code_v2}
      aria-pressed={selected || undefined}
      onClick={(event) => {
        event.stopPropagation();
        onActivate?.(word, event);
      }}
    >
      {word.code_v2}
    </button>
  );
}
