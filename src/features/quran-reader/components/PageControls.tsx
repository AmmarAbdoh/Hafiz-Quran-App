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

  const controlSize = "h-11 w-11";
  const inputSize = compact ? "h-11 w-14 text-xs" : "h-11 w-16 text-sm";
  const labelSize = compact ? "text-xs" : "text-sm";
  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  const pillPadding = compact ? "p-0.5" : "p-1";

  return (
    <div
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
        onClick={() => prevPage !== null && onPageChange(prevPage)}
        disabled={prevPage === null}
        aria-label={t("navigation.previousPage")}
      >
        <ChevronLeft className={cn(iconSize, "rtl:rotate-180")} aria-hidden />
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
            "flex min-w-[2.5rem] items-center justify-center rounded-full px-2 transition-colors hover:bg-background/80 sm:min-w-[2.75rem]",
            "min-h-11",
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
        onClick={() => nextPage !== null && onPageChange(nextPage)}
        disabled={nextPage === null}
        aria-label={t("navigation.nextPage")}
      >
        <ChevronRight className={cn(iconSize, "rtl:rotate-180")} aria-hidden />
      </Button>
    </div>
  );
}
