import { Info, Palette } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TAJWEED_LEGEND } from "@/domain/quran";
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
  const { t } = useTranslation("reader");

  if (!visible) return null;

  const ruleLabels: Record<string, string> = {
    sakin: t("tajweed.rules.sakin.label"),
    "madd-2": t("tajweed.rules.madd2.label"),
    "madd-munfasil": t("tajweed.rules.maddMunfasil.label"),
    "madd-muttasil": t("tajweed.rules.maddMuttasil.label"),
    "madd-lazim": t("tajweed.rules.maddLazim.label"),
    ghunnah: t("tajweed.rules.ghunnah.label"),
    qalqalah: t("tajweed.rules.qalqalah.label"),
    tafkheem: t("tajweed.rules.tafkheem.label"),
  };

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
                  <span className="text-foreground/90">
                    {ruleLabels[rule.id] ?? rule.label}
                  </span>
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={onOpenLegendGuide}
              className="mushaf-tajweed-dock__info min-h-11 min-w-11"
              aria-label={t("tajweed.details")}
              title={t("tajweed.detailsShort")}
              tabIndex={open ? 0 : -1}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={cn(
          "mushaf-tajweed-dock__toggle min-h-11 min-w-11",
          open && "mushaf-tajweed-dock__toggle--active",
        )}
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={open ? t("tajweed.hideMeaning") : t("tajweed.showMeaning")}
        title={open ? t("tajweed.hideMeaning") : t("tajweed.meaning")}
      >
        <Palette className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="text-[10px] font-medium sm:text-[11px]">
          {t("tajweed.meaning")}
        </span>
      </button>
    </div>
  );
}
