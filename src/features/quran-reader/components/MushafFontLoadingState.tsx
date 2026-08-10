import { Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface MushafFontLoadingStateProps {
  message?: string;
  className?: string;
  compact?: boolean;
}

export function MushafFontLoadingState({
  message = "جاري تحميل المصحف…",
  className,
  compact = false,
}: MushafFontLoadingStateProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 text-center",
        compact
          ? "min-h-0 justify-start py-4"
          : "min-h-[40vh] justify-center py-16",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
