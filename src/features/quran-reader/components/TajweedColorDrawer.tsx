import { Info, Palette, Pin, PinOff } from "lucide-react";
import { useAutoHideDock } from "@/features/quran-reader/hooks/useAutoHideDock";
import { TAJWEED_LEGEND } from "@/shared/constants/tajweed";
import { cn } from "@/shared/lib/utils";

interface TajweedColorDrawerProps {
  visible: boolean;
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  onOpenLegendGuide: () => void;
}

export function TajweedColorDrawer({
  visible,
  pinned,
  onPinnedChange,
  onOpenLegendGuide,
}: TajweedColorDrawerProps) {
  const {
    expanded,
    handleMouseEnter,
    handleMouseLeave,
    handleFocusCapture,
    handleBlurCapture,
    handleFocus,
  } = useAutoHideDock({ pinned, enabled: visible });

  if (!visible) return null;

  const showLegend = expanded;

  return (
    <div
      className={cn(
        "group/dock mushaf-tajweed-dock",
        !showLegend && "mushaf-tajweed-dock--collapsed",
        pinned && "mushaf-tajweed-dock--pinned",
      )}
      onMouseEnter={!pinned ? handleMouseEnter : undefined}
      onMouseLeave={!pinned ? handleMouseLeave : undefined}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
      onFocus={handleFocus}
    >
      <div
        className={cn(
          "mushaf-tajweed-dock__chrome",
          showLegend && "mushaf-tajweed-dock__chrome--visible",
        )}
        aria-hidden={!showLegend}
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
        className="mushaf-tajweed-dock__bar"
        onClick={() => onPinnedChange(!pinned)}
        aria-expanded={showLegend}
        aria-label={pinned ? "إلغاء تثبيت معنى الألوان" : "تثبيت معنى الألوان"}
        title={pinned ? "إلغاء التثبيت" : "تثبيت معنى الألوان"}
      >
        <span
          className={cn(
            "mushaf-tajweed-dock__pin-icon",
            pinned && "mushaf-tajweed-dock__pin-icon--visible",
          )}
          aria-hidden
        >
          {pinned ? (
            <PinOff className="h-3.5 w-3.5" />
          ) : (
            <Pin className="h-3.5 w-3.5" />
          )}
        </span>

        <span className="mushaf-tajweed-dock__bar-label">
          <Palette className="h-3.5 w-3.5 text-primary" aria-hidden />
          <span className="text-[10px] font-medium text-muted-foreground sm:text-[11px]">
            معنى الألوان
          </span>
        </span>
      </button>
    </div>
  );
}
