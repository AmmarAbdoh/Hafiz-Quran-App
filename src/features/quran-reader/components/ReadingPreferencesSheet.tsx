import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocale } from "@/app/i18n";
import {
  MUSHAF_SCALE_STEPS,
  type MushafScale,
} from "@/features/quran-reader/model/mushafScale";
import { MushafLayoutSwitcher } from "@/features/quran-reader/components/MushafLayoutSwitcher";
import type { MushafLayoutMode } from "@/features/quran-reader/model/quranReaderRoutes";
import {
  RECITERS,
  TAFSEER_OPTIONS,
  useReciter,
  useTafseer,
} from "@/domain/quran";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { Stepper } from "@/shared/components/Stepper";
import { Switch } from "@/shared/components/Switch";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/Sheet";
import { Label } from "@/shared/components/ui/label";

interface ReadingPreferencesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layoutMode: MushafLayoutMode;
  onLayoutModeChange: (mode: MushafLayoutMode) => void;
  tajweedColored: boolean;
  onTajweedColoredChange: (value: boolean) => void;
  onOpenTajweedLegend: () => void;
  mushafWarmth: boolean;
  onMushafWarmthChange: (value: boolean) => void;
  mushafScale: MushafScale;
  onMushafScaleChange: (scale: MushafScale) => void;
}

export function ReadingPreferencesSheet({
  open,
  onOpenChange,
  layoutMode,
  onLayoutModeChange,
  tajweedColored,
  onTajweedColoredChange,
  onOpenTajweedLegend,
  mushafWarmth,
  onMushafWarmthChange,
  mushafScale,
  onMushafScaleChange,
}: ReadingPreferencesSheetProps) {
  const { t } = useTranslation("reader");
  const { t: tCommon } = useTranslation("common");
  const { t: tSettings } = useTranslation("settings");
  const { locale } = useLocale();
  const { reciter, setReciterId } = useReciter();
  const { tafseerId, setTafseerId } = useTafseer();

  const scaleIndex = MUSHAF_SCALE_STEPS.indexOf(mushafScale);
  const reciterOptions = RECITERS.map((option) => ({
    value: option.id,
    label: locale === "ar" ? option.nameAr : option.nameEn,
  }));
  const tafseerTranslationKeys = {
    "1": "interpretation.options.one",
    "2": "interpretation.options.two",
    "3": "interpretation.options.three",
    "4": "interpretation.options.four",
    "5": "interpretation.options.five",
    "6": "interpretation.options.six",
    "7": "interpretation.options.seven",
    "8": "interpretation.options.eight",
  } as const;
  const tafseerOptions = Object.keys(TAFSEER_OPTIONS).map((id) => ({
    value: id,
    label: tSettings(
      tafseerTranslationKeys[id as keyof typeof tafseerTranslationKeys],
    ),
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent closeLabel={tCommon("actions.close")} className="gap-5">
        <SheetHeader>
          <SheetTitle>{t("preferences.title")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("preferences.title")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>{t("layout.label")}</Label>
            <MushafLayoutSwitcher
              layoutMode={layoutMode}
              onLayoutModeChange={onLayoutModeChange}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("preferences.textSize")}</Label>
            <Stepper
              value={scaleIndex + 1}
              min={1}
              max={MUSHAF_SCALE_STEPS.length}
              step={1}
              decrementLabel={t("preferences.decreaseText")}
              incrementLabel={t("preferences.increaseText")}
              valueLabel={t("preferences.textSize")}
              onValueChange={(next) => {
                const step = MUSHAF_SCALE_STEPS[next - 1];
                if (step) onMushafScaleChange(step);
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1">
              <Label htmlFor="reader-pref-tajweed">
                {t("header.tajweedColored")}
              </Label>
              {/* The legend explaining what the colours mean had no way in at
                  all until now; it belongs beside the switch that turns them
                  on. */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                onClick={onOpenTajweedLegend}
                aria-label={t("tajweed.showMeaning")}
                title={t("tajweed.showMeaning")}
              >
                <Info className="h-4 w-4" aria-hidden />
              </Button>
            </span>
            <Switch
              id="reader-pref-tajweed"
              pressed={tajweedColored}
              onPressedChange={onTajweedColoredChange}
              aria-label={t("header.tajweedColored")}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="reader-pref-warmth">
              {t("preferences.warmth")}
            </Label>
            <Switch
              id="reader-pref-warmth"
              pressed={mushafWarmth}
              onPressedChange={onMushafWarmthChange}
              aria-label={t("preferences.warmth")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reader-pref-reciter">
              {t("preferences.reciter")}
            </Label>
            <SearchableSelect
              id="reader-pref-reciter"
              value={reciter.id}
              options={reciterOptions}
              onValueChange={setReciterId}
              placeholder={tSettings("recitation.searchPlaceholder")}
              searchPlaceholder={tCommon("select.search")}
              emptyMessage={tSettings("recitation.empty")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reader-pref-tafseer">
              {t("preferences.tafseer")}
            </Label>
            <SearchableSelect
              id="reader-pref-tafseer"
              value={tafseerId}
              options={tafseerOptions}
              onValueChange={setTafseerId}
              placeholder={tSettings("interpretation.label")}
              searchPlaceholder={tCommon("select.search")}
              emptyMessage={tCommon("select.empty")}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
