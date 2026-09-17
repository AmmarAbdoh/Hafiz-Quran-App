import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

import { getAdjacentPageInSequence } from "@/features/quran-reader/hooks/useMushafScrollPageSpy";

interface PageControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  minPage?: number;
  maxPage?: number;
  /** When set, prev/next step through this list instead of ±1. */
  pageSequence?: number[];
  compact?: boolean;
}

function resolveSequentialPage(
  pageSequence: number[] | undefined,
  currentPage: number,
  direction: "prev" | "next",
  minPage: number,
  maxPage: number,
): number | null {
  if (pageSequence && pageSequence.length > 0) {
    return getAdjacentPageInSequence(pageSequence, currentPage, direction);
  }

  const delta = direction === "next" ? 1 : -1;
  const nextPage = currentPage + delta;
  if (nextPage < minPage || nextPage > maxPage) return null;
  return nextPage;
}

export function PageControls({
  currentPage,
  totalPages,
  onPageChange,
  className,
  minPage = 1,
  maxPage = totalPages,
  pageSequence,
  compact = false,
}: PageControlsProps) {
  const { t } = useTranslation("reader");
  const { locale } = useLocale();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  /*
   * `currentPage` is a prop driven by the URL, and the URL only updates once
   * navigation actually commits - which a second tap can easily outrun. Two
   * taps fired before that commit both read the same `currentPage` and both
   * ask to go to the very page the first tap already asked for, so from the
   * second tap of a quick run onward the control looked like it had stopped
   * responding.
   *
   * This tracks the page we last asked for rather than the one the route has
   * confirmed, so each tap steps from where the last tap left off. It stays
   * caught up with the route on every render a real navigation produces, so
   * a page reached some other way - a swipe, a keyboard shortcut, the surah
   * drawer - is still the base the next tap builds on.
   */
  const pendingPageRef = useRef(currentPage);
  useEffect(() => {
    pendingPageRef.current = currentPage;
  }, [currentPage]);

  const requestStep = (direction: "prev" | "next") => {
    const target = resolveSequentialPage(
      pageSequence,
      pendingPageRef.current,
      direction,
      minPage,
      maxPage,
    );
    if (target === null) return;
    pendingPageRef.current = target;
    onPageChange(target);
  };

  useEffect(() => {
    if (!editing) return;

    const frame = requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    });

    return () => cancelAnimationFrame(frame);
  }, [editing]);

  const commitPage = () => {
    const page = parseInt(draft, 10);
    const inSequence =
      !pageSequence || pageSequence.length === 0 || pageSequence.includes(page);
    if (!isNaN(page) && page >= minPage && page <= maxPage && inSequence) {
      pendingPageRef.current = page;
      onPageChange(page);
    }
    setEditing(false);
  };

  const prevPage = resolveSequentialPage(
    pageSequence,
    currentPage,
    "prev",
    minPage,
    maxPage,
  );
  const nextPage = resolveSequentialPage(
    pageSequence,
    currentPage,
    "next",
    minPage,
    maxPage,
  );

  /*
   * 44px is the touch floor and remains the default. A mouse does not need
   * it, and at that size the pill was the loudest thing in a strip whose job
   * is to stay out of the way of the page. A fine pointer gets a 36px one -
   * still well over the 24px WCAG 2.2 target - and this is written round this
   * way so that losing the variant leaves the safe size standing.
   *
   * The min-* pair is not redundant: `size="icon"` sets min-h/min-w to the
   * 44px target, and a floor beats a smaller height, so setting h/w alone
   * left the button open at 44 while the number beside it shrank.
   */
  const controlSize =
    "h-11 w-11 pointer-fine:h-9 pointer-fine:w-9 pointer-fine:min-h-9 pointer-fine:min-w-9";
  const inputSize = compact
    ? "h-11 w-14 pointer-fine:h-9 pointer-fine:w-12 text-label"
    : "h-11 w-16 text-sm";
  const labelSize = compact ? "text-label" : "text-sm";
  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  const pillPadding = compact ? "p-0.5" : "p-1";

  return (
    <div
      dir="ltr"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-muted/50",
        pillPadding,
        className,
      )}
      role="group"
      aria-label={t("navigation.goToPage")}
    >
      <Button
        variant="ghost"
        size="icon"
        className={cn(controlSize, "shrink-0 rounded-full")}
        onClick={() => requestStep("next")}
        disabled={nextPage === null}
        aria-label={t("navigation.nextPage")}
      >
        <ChevronLeft className={iconSize} aria-hidden />
      </Button>

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commitPage}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitPage();
            if (e.key === "Escape") setEditing(false);
          }}
          className={cn(
            "rounded-full bg-background text-center font-semibold tabular-nums outline-none ring-2 ring-primary/30 selection:bg-primary/25",
            inputSize,
          )}
          aria-label={t("navigation.pageNumber")}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(String(currentPage));
            setEditing(true);
          }}
          className={cn(
            // A target in its own right, not a label, so it keeps the 44px floor.
            "flex min-w-11 items-center justify-center rounded-full px-2 transition-colors hover:bg-background/80",
            "min-h-11 pointer-fine:min-h-9 pointer-fine:min-w-9",
          )}
          aria-label={t("navigation.goToPage")}
        >
          <span className={cn("font-semibold tabular-nums", labelSize)}>
            {formatNumber(currentPage, locale)}
          </span>
        </button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className={cn(controlSize, "shrink-0 rounded-full")}
        onClick={() => requestStep("prev")}
        disabled={prevPage === null}
        aria-label={t("navigation.previousPage")}
      >
        <ChevronRight className={iconSize} aria-hidden />
      </Button>
    </div>
  );
}
