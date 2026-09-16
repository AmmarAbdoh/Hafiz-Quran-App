import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Bookmark,
  Copy,
  Infinity as InfinityIcon,
  Repeat,
  Share2,
  Volume2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
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
  /** Repeat this one ayah: the memorization loop, where the ayah already is. */
  onRepeatAyah?: (repeat: number | "infinite") => void;
  onTafseer: () => void;
  onCopy?: () => void;
  onShare?: () => void;
  isBookmarked?: boolean;
  onBookmarkToggle?: () => void;
  onClose: () => void;
  popoverRef?: React.Ref<HTMLDivElement>;
}

function getPopoverPosition(anchor: DOMRect) {
  // The reader layout owns the dock variables, not the document root.
  const layout = document.querySelector(".mushaf-reader-layout");
  const dockOffset = layout
    ? Number.parseFloat(
        getComputedStyle(layout).getPropertyValue("--mushaf-dock-offset"),
      )
    : 0;
  const bottomReserve = (Number.isFinite(dockOffset) ? dockOffset : 0) + 16;

  const centerX = anchor.left + anchor.width / 2;
  const viewportBottom = window.innerHeight - bottomReserve;

  /*
   * Put it on whichever side has more room, and cap it to that room.
   *
   * This used to assume the popover was about 120px tall and only ever flip
   * from below to above. Adding the repeat row made it 406px, and an ayah near
   * the top of the page put it at y=-211 - off the top of the screen, present
   * in the DOM and impossible to use. Measuring the space instead of guessing
   * the height means it fits whatever it ends up containing.
   */
  const spaceAbove = anchor.top - POPOVER_GAP - HEADER_SAFE_ZONE;
  const spaceBelow = viewportBottom - anchor.bottom - POPOVER_GAP;
  const placeBelow = spaceBelow >= spaceAbove;

  const top = placeBelow
    ? anchor.bottom + POPOVER_GAP
    : anchor.top - POPOVER_GAP;
  const transform = placeBelow
    ? "translate(-50%, 0)"
    : "translate(-50%, -100%)";
  const maxHeight = Math.max(160, placeBelow ? spaceBelow : spaceAbove);

  const clampedX = Math.min(
    window.innerWidth - VIEWPORT_PADDING,
    Math.max(VIEWPORT_PADDING, centerX),
  );

  return { left: clampedX, top, transform, maxHeight, placeBelow };
}

export function VerseActionsPopover({
  verseKey,
  wordLocation,
  mode,
  anchor,
  playingTarget,
  onListenWord,
  onListenAyah,
  onRepeatAyah,
  onTafseer,
  onCopy,
  onShare,
  isBookmarked = false,
  onBookmarkToggle,
  onClose,
  popoverRef,
}: VerseActionsPopoverProps) {
  const { t } = useTranslation("reader");
  const { locale } = useLocale();
  const { left, top, transform, maxHeight } = getPopoverPosition(anchor);
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
      className="pointer-events-auto fixed z-overlay"
      style={{ left, top, transform, maxHeight }}
    >
      {/* Scrolls rather than overflowing the screen, so the panel fits the
          space the position calculation gave it. */}
      <div className="app-main-scroll flex max-h-full max-w-[min(20rem,calc(100vw-1rem))] flex-col gap-1.5 overflow-y-auto rounded-xl border border-border bg-card px-2.5 py-2 shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
          <span className="text-label font-semibold text-primary">
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

        {/* Full-size, not compact: these are how an ayah is acted on and a
            finger aims at them directly. */}
        <div className="flex flex-wrap items-center justify-center gap-1">
          {mode === "word" && onListenWord && (
            <Button
              variant="secondary"
              size="default"
              className="gap-1.5"
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
            size="default"
            className="gap-1.5"
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
            size="default"
            className="gap-1.5"
            onClick={onTafseer}
          >
            <BookOpen className="h-3.5 w-3.5" />
            {t("actions.tafsir")}
          </Button>

          {onCopy ? (
            <Button
              variant="secondary"
              size="default"
              className="gap-1.5"
              onClick={onCopy}
            >
              <Copy className="h-3.5 w-3.5" />
              {t("actions.copy")}
            </Button>
          ) : null}

          {onShare ? (
            <Button
              variant="secondary"
              size="default"
              className="gap-1.5"
              onClick={onShare}
            >
              <Share2 className="h-3.5 w-3.5" />
              {t("actions.share")}
            </Button>
          ) : null}

          {onBookmarkToggle ? (
            <Button
              variant={isBookmarked ? "default" : "secondary"}
              size="default"
              className="gap-1.5"
              onClick={onBookmarkToggle}
              aria-pressed={isBookmarked}
            >
              <Bookmark
                className={cn("h-3.5 w-3.5", isBookmarked && "fill-current")}
              />
              {isBookmarked ? t("actions.unbookmark") : t("actions.bookmark")}
            </Button>
          ) : null}
        </div>

        {/*
          Repeating one ayah until it sticks is the memorization loop itself,
          and it used to mean leaving this ayah, opening a dialog and typing
          back the surah and ayah already selected here. Two taps now, from
          the ayah under the thumb.
        */}
        {onRepeatAyah ? (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1 border-t border-border pt-2">
            <span className="inline-flex items-center gap-1 pe-1 text-label text-muted-foreground">
              <Repeat className="h-3.5 w-3.5" aria-hidden />
              {t("actions.repeatLabel")}
            </span>
            {[3, 5, 10].map((times) => (
              <Button
                key={times}
                variant="secondary"
                size="sm"
                onClick={() => onRepeatAyah(times)}
                aria-label={t("actions.repeatTimesLabel", {
                  count: times,
                  formattedCount: formatNumber(times, locale),
                })}
              >
                {t("actions.repeatTimes", {
                  count: times,
                  formattedCount: formatNumber(times, locale),
                })}
              </Button>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onRepeatAyah("infinite")}
              aria-label={t("actions.repeatInfiniteLabel")}
              title={t("actions.repeatInfinite")}
            >
              <InfinityIcon className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
