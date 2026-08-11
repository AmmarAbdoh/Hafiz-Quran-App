import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Volume2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const rootStyles = getComputedStyle(document.documentElement);
  const dockOffset = Number.parseFloat(
    rootStyles.getPropertyValue("--mushaf-dock-offset"),
  );
  const audioOffset = Number.parseFloat(
    rootStyles.getPropertyValue("--mushaf-audio-offset"),
  );
  const bottomReserve =
    (Number.isFinite(dockOffset) ? dockOffset : 0) +
    (Number.isFinite(audioOffset) ? audioOffset : 0) +
    16;

  const centerX = anchor.left + anchor.width / 2;
  const placeBelow = anchor.top < HEADER_SAFE_ZONE + 80;
  const viewportBottom = window.innerHeight - bottomReserve;

  let top = placeBelow ? anchor.bottom + POPOVER_GAP : anchor.top - POPOVER_GAP;

  if (placeBelow && top + 120 > viewportBottom) {
    top = Math.max(HEADER_SAFE_ZONE, anchor.top - POPOVER_GAP);
  }

  const transform =
    placeBelow && top >= anchor.bottom
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
  const { t } = useTranslation("reader");
  const { left, top, transform } = getPopoverPosition(anchor);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      ref={popoverRef}
      data-verse-actions
      role="dialog"
      aria-label={t("actions.verseLabel", { verseKey })}
      className="pointer-events-auto fixed z-50"
      style={{ left, top, transform }}
    >
      <div className="flex max-w-[min(20rem,calc(100vw-1rem))] flex-col gap-1.5 rounded-xl border border-border bg-card px-2.5 py-2 shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
          <span className="text-xs font-semibold text-primary">
            {mode === "ayah"
              ? t("actions.verseLabel", { verseKey })
              : (wordLocation ?? verseKey)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={onClose}
            aria-label={t("actions.close")}
            ref={closeButtonRef}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1">
          {mode === "word" && onListenWord && (
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11 gap-1.5 text-xs"
              onClick={onListenWord}
            >
              <Volume2
                className={cn(
                  "h-3.5 w-3.5",
                  playingTarget === "word" && "animate-pulse",
                )}
              />
              {t("actions.word")}
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            className="min-h-11 gap-1.5 text-xs"
            onClick={onListenAyah}
          >
            <Volume2
              className={cn(
                "h-3.5 w-3.5",
                playingTarget === "ayah" && "animate-pulse",
              )}
            />
            {t("actions.listen")}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="min-h-11 gap-1.5 text-xs"
            onClick={onTafseer}
          >
            <BookOpen className="h-3.5 w-3.5" />
            {t("actions.tafsir")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
