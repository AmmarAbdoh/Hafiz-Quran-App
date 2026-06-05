import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

interface PageControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PageControls({
  currentPage,
  totalPages,
  onPageChange,
  className,
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
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted/50 p-1",
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-full"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="الصفحة السابقة"
      >
        <ChevronRight className="h-4 w-4" />
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
          className="h-9 w-14 rounded-full bg-background text-center text-sm font-semibold tabular-nums outline-none ring-2 ring-primary/30 selection:bg-primary/25"
          aria-label="رقم الصفحة"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(String(currentPage));
            setEditing(true);
          }}
          className="flex h-9 min-w-[3rem] items-center justify-center rounded-full px-3 transition-colors hover:bg-background/80"
          aria-label="انتقل إلى صفحة"
        >
          <span className="text-sm font-semibold tabular-nums">{currentPage}</span>
        </button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-full"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="الصفحة التالية"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
  );
}
