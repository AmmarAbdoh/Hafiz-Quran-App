import { ChevronDown, Info } from "lucide-react";
import { TAJWEED_LEGEND } from "@/shared/constants/tajweed";
import { cn } from "@/shared/lib/utils";

interface TajweedColorDrawerProps {
  open: boolean;
  visible: boolean;
  onToggle: () => void;
  onOpenLegendGuide: () => void;
}

export function TajweedColorDrawer({
  open,
  visible,
  onToggle,
  onOpenLegendGuide,
}: TajweedColorDrawerProps) {
  return (
    <div
      className={cn(
        "overflow-hidden border-border bg-muted/40 transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        visible
          ? "max-h-40 border-t opacity-100"
          : "max-h-0 border-t-0 opacity-0",
      )}
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex justify-center py-1.5">
          <div className="inline-flex items-center rounded-full border border-border/70 bg-background/80 shadow-sm">
            <button
              type="button"
              onClick={onToggle}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-s-full px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground",
                open && "text-primary",
              )}
              aria-expanded={open}
            >
              معنى الألوان
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                  open && "rotate-180",
                )}
              />
            </button>

            <span className="h-4 w-px bg-border/80" aria-hidden />

            <button
              type="button"
              onClick={onOpenLegendGuide}
              className="inline-flex h-7 w-8 items-center justify-center rounded-e-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-primary"
              aria-label="شرح تفصيلي لألوان التجويد"
              title="شرح تفصيلي"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <div className="border-t border-border/40 py-2.5">
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 sm:gap-x-4">
                {TAJWEED_LEGEND.map((rule) => (
                  <span
                    key={rule.id}
                    className="inline-flex items-center gap-1.5 text-[10px] leading-none sm:text-[11px]"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-black/10 shadow-sm sm:h-3.5 sm:w-3.5 dark:border-white/10"
                      style={{ backgroundColor: rule.color }}
                      aria-hidden
                    />
                    <span className="text-foreground/90">{rule.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
