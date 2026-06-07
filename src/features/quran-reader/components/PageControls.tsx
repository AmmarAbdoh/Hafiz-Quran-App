import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
      !pageSequence ||
      pageSequence.length === 0 ||
      pageSequence.includes(page);
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

  const controlSize = compact ? "h-7 w-7" : "h-8 w-8 sm:h-9 sm:w-9";
  const inputSize = compact ? "h-7 w-12 text-xs" : "h-8 w-14 text-sm sm:h-9";
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
    >
      <Button
        variant="ghost"
        size="icon"
        className={cn(controlSize, "shrink-0 rounded-full")}
        onClick={() => prevPage !== null && onPageChange(prevPage)}
        disabled={prevPage === null}
        aria-label="الصفحة السابقة"
      >
        <ChevronRight className={iconSize} />
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
          aria-label="رقم الصفحة"
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
            compact ? "h-7" : "h-8 sm:h-9",
          )}
          aria-label="انتقل إلى صفحة"
        >
          <span className={cn("font-semibold tabular-nums", labelSize)}>
            {currentPage}
          </span>
        </button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className={cn(controlSize, "shrink-0 rounded-full")}
        onClick={() => nextPage !== null && onPageChange(nextPage)}
        disabled={nextPage === null}
        aria-label="الصفحة التالية"
      >
        <ChevronLeft className={iconSize} />
      </Button>
    </div>
  );
}
