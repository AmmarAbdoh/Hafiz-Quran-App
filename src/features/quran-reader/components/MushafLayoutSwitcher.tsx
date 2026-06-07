import { BookOpen, FileText } from "lucide-react";
import type { MushafLayoutMode } from "@/features/quran-reader/lib/quranReaderRoutes";
import { cn } from "@/shared/lib/utils";

interface MushafLayoutSwitcherProps {
  layoutMode: MushafLayoutMode;
  onLayoutModeChange: (mode: MushafLayoutMode) => void;
}

export function MushafLayoutSwitcher({
  layoutMode,
  onLayoutModeChange,
}: MushafLayoutSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="طريقة العرض"
      className="inline-flex rounded-full border border-border bg-muted/50 p-0.5 shadow-sm"
    >
      <button
        type="button"
        role="tab"
        aria-selected={layoutMode === "surah"}
        onClick={() => onLayoutModeChange("surah")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors sm:px-4 sm:text-sm",
          layoutMode === "surah"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <BookOpen className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
        <span>سورة</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={layoutMode === "page"}
        onClick={() => onLayoutModeChange("page")}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors sm:px-4 sm:text-sm",
          layoutMode === "page"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <FileText className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
        <span>صفحة</span>
      </button>
    </div>
  );
}
