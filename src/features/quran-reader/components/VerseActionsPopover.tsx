import { createPortal } from "react-dom";
import { BookOpen, Volume2, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

const POPOVER_GAP = 10;
const VIEWPORT_PADDING = 8;
const HEADER_SAFE_ZONE = 72;

interface VerseActionsPopoverProps {
  verseKey: string;
  wordLocation?: string;
  mode: "word" | "ayah";
  anchor: DOMRect;
  playingTarget: "word" | "ayah" | null;
  onListenWord?: () => void;
  onListenAyah: () => void;
  onTafseer: () => void;
  onClose: () => void;
  popoverRef?: React.Ref<HTMLDivElement>;
}

function getPopoverPosition(anchor: DOMRect) {
  const centerX = anchor.left + anchor.width / 2;
  const placeBelow = anchor.top < HEADER_SAFE_ZONE + 80;

  const top = placeBelow
    ? anchor.bottom + POPOVER_GAP
    : anchor.top - POPOVER_GAP;

  const transform = placeBelow
    ? "translate(-50%, 0)"
    : "translate(-50%, -100%)";

  const clampedX = Math.min(
    window.innerWidth - VIEWPORT_PADDING,
    Math.max(VIEWPORT_PADDING, centerX),
  );

  return { left: clampedX, top, transform, placeBelow };
}

export function VerseActionsPopover({
  verseKey,
  wordLocation,
  mode,
  anchor,
  playingTarget,
  onListenWord,
  onListenAyah,
  onTafseer,
  onClose,
  popoverRef,
}: VerseActionsPopoverProps) {
  const { left, top, transform } = getPopoverPosition(anchor);

  return createPortal(
    <div
      ref={popoverRef}
      data-verse-actions
      className="pointer-events-auto fixed z-50"
      style={{ left, top, transform }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex max-w-[min(20rem,calc(100vw-1rem))] flex-col gap-1.5 rounded-xl border border-border bg-card px-2.5 py-2 shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
          <span className="text-xs font-semibold text-primary">
            {mode === "ayah" ? `آية ${verseKey}` : (wordLocation ?? verseKey)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onClose}
            aria-label="إغلاق"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1">
          {mode === "word" && onListenWord && (
            <Button
              variant="secondary"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={onListenWord}
            >
              <Volume2
                className={cn(
                  "h-3.5 w-3.5",
                  playingTarget === "word" && "animate-pulse",
                )}
              />
              الكلمة
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onListenAyah}
          >
            <Volume2
              className={cn(
                "h-3.5 w-3.5",
                playingTarget === "ayah" && "animate-pulse",
              )}
            />
            الآية
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onTafseer}
          >
            <BookOpen className="h-3.5 w-3.5" />
            تفسير
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
