import type { CSSProperties } from "react";
import type { MushafWord } from "../model";
import { cn } from "@/shared/lib/utils";
import type {
  MushafWordActivateHandler,
  MushafWordPointerHandler,
} from "./wordActivation";

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
  bookmarked?: boolean;
  incorrectLabel?: string;
  wordZIndex?: number;
  onActivate?: MushafWordActivateHandler;
  onPointerDown?: MushafWordPointerHandler;
  onPointerUp?: () => void;
  onPointerCancel?: () => void;
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
  bookmarked = false,
  wordZIndex,
  onActivate,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: MushafWordGlyphProps) {
  const interactive = fontReady && Boolean(onActivate) && !hidden && !incorrect;
  const className = cn(
    "mushaf-word",
    word.char_type === "end" && "mushaf-word-end",
    bookmarked && word.char_type === "end" && "mushaf-word--bookmarked",
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

  /*
   * A span, not a button. The glyph is hidden from assistive technology and
   * kept out of the tab order - a page announced one glyph at a time would be
   * unusable - so it was never a control in any sense that reached a screen
   * reader; it existed only to catch pointer events, which a span catches just
   * as well. As a button it also nested inside the ayah's own control, which
   * axe rightly rejects: a negative tabindex inside an interactive element
   * does not stop assistive technology reaching it.
   */
  return (
    <span
      {...contentAttributes}
      aria-hidden
      data-selected={selected || undefined}
      onClick={(event) => {
        event.stopPropagation();
        onActivate?.(word, event);
      }}
      onPointerDown={(event) => {
        onPointerDown?.(word, event);
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {word.code_v2}
    </span>
  );
}
