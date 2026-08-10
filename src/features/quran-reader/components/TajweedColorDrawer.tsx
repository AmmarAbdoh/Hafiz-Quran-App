import { Info, Palette } from "lucide-react";
import { TAJWEED_LEGEND } from "@/shared/constants/tajweed";
import { cn } from "@/shared/lib/utils";

interface TajweedColorDrawerProps {
  visible: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenLegendGuide: () => void;
}

export function TajweedColorDrawer({
  visible,
  open,
  onOpenChange,
  onOpenLegendGuide,
}: TajweedColorDrawerProps) {
  if (!visible) return null;

  return (
    <div
      className={cn("mushaf-tajweed-dock", open && "mushaf-tajweed-dock--open")}
    >
      <div
        className={cn(
          "mushaf-tajweed-dock__chrome",
          open && "mushaf-tajweed-dock__chrome--visible",
        )}
        aria-hidden={!open}
      >
        <div className="mushaf-footer-bar">
          <div className="mushaf-tajweed-dock__legend-wrap">
            <div className="mushaf-tajweed-dock__legend">
              {TAJWEED_LEGEND.map((rule) => (
                <span
                  key={rule.id}
                  className="mushaf-tajweed-dock__legend-item"
                >
                  <span
                    className="mushaf-tajweed-dock__swatch"
                    style={{ backgroundColor: rule.color }}
                    aria-hidden
                  />
                  <span className="text-foreground/90">{rule.label}</span>
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={onOpenLegendGuide}
              className="mushaf-tajweed-dock__info"
              aria-label="شرح تفصيلي لألوان التجويد"
              title="شرح تفصيلي"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={cn(
          "mushaf-tajweed-dock__toggle",
          open && "mushaf-tajweed-dock__toggle--active",
        )}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={open ? "إخفاء معنى الألوان" : "عرض معنى الألوان"}
        title={open ? "إخفاء معنى الألوان" : "معنى الألوان"}
      >
        <Palette className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="text-[10px] font-medium sm:text-[11px]">
          معنى الألوان
        </span>
      </button>
    </div>
  );
}
