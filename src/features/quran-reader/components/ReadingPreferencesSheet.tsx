import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
import {
  MUSHAF_SCALE_STEPS,
  type MushafScale,
} from "@/features/quran-reader/model/mushafScale";
import {
  RECITERS,
  TAFSEER_OPTIONS,
  useReciter,
  useTafseer,
} from "@/domain/quran";
import { Field } from "@/shared/components/Field";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { Stepper } from "@/shared/components/Stepper";
import { Switch } from "@/shared/components/Switch";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/Sheet";
import { Label } from "@/shared/components/ui/label";

/** A setting and its control, on one line, the same way every time. */
function PreferenceRow({
  label,
  hint,
  htmlFor,
  action,
  children,
}: {
  label: string;
  /** For a setting whose name does not say what it does. */
  hint?: string;
  htmlFor?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 py-2">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-0.5">
          <Label htmlFor={htmlFor} className="text-body font-medium">
            {label}
          </Label>
          {action}
        </span>
        {hint ? (
          <span className="text-label font-normal text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
      {children}
    </div>
  );
}

interface ReadingPreferencesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

        {/*
          One row shape for every compact setting: what it is on the leading
          side, the control on the trailing side. The three used to be laid
          out three different ways - and the text size was a bare <Label>,
          which is an inline element, so the stack meant to separate it from
          its stepper did nothing and the two sat jammed on one line.
        */}
        <div className="divide-y divide-border-subtle">
          {/* Layout is not here: it decides how the reader is moved through,
              so it belongs in the header menu where it can be seen without
              opening anything. */}
          <PreferenceRow label={t("preferences.textSize")}>
            <Stepper
              value={scaleIndex + 1}
              min={1}
              max={MUSHAF_SCALE_STEPS.length}
              step={1}
              decrementLabel={t("preferences.decreaseText")}
              incrementLabel={t("preferences.increaseText")}
              valueLabel={t("preferences.textSize")}
              formatValue={(value) => formatNumber(value, locale)}
              onValueChange={(next) => {
                const step = MUSHAF_SCALE_STEPS[next - 1];
                if (step) onMushafScaleChange(step);
              }}
            />
          </PreferenceRow>

          <PreferenceRow
            htmlFor="reader-pref-tajweed"
            label={t("header.tajweedColored")}
            /* The legend explaining what the colours mean had no way in at
               all until now; it belongs beside the switch that turns them on. */
            action={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground"
                onClick={onOpenTajweedLegend}
                aria-label={t("tajweed.showMeaning")}
                title={t("tajweed.showMeaning")}
              >
                <Info className="h-4 w-4" aria-hidden />
              </Button>
            }
          >
            <Switch
              id="reader-pref-tajweed"
              pressed={tajweedColored}
              onPressedChange={onTajweedColoredChange}
              aria-label={t("header.tajweedColored")}
            />
          </PreferenceRow>

          <PreferenceRow
            htmlFor="reader-pref-warmth"
            label={t("preferences.warmth")}
            hint={t("preferences.warmthHint")}
          >
            <Switch
              id="reader-pref-warmth"
              pressed={mushafWarmth}
              onPressedChange={onMushafWarmthChange}
              aria-label={t("preferences.warmth")}
            />
          </PreferenceRow>
        </div>

        {/* These two need the width, so they keep their label above them
            rather than beside them. */}
        <div className="space-y-4">
          <Field id="reader-pref-reciter" label={t("preferences.reciter")}>
            {({ id }) => (
              <SearchableSelect
                id={id}
                value={reciter.id}
                options={reciterOptions}
                onValueChange={setReciterId}
                placeholder={tSettings("recitation.searchPlaceholder")}
                searchPlaceholder={tCommon("select.search")}
                emptyMessage={tSettings("recitation.empty")}
              />
            )}
          </Field>

          <Field id="reader-pref-tafseer" label={t("preferences.tafseer")}>
            {({ id }) => (
              <SearchableSelect
                id={id}
                value={tafseerId}
                options={tafseerOptions}
                onValueChange={setTafseerId}
                placeholder={tSettings("interpretation.label")}
                searchPlaceholder={tCommon("select.search")}
                emptyMessage={tCommon("select.empty")}
              />
            )}
          </Field>
        </div>

        {/* The only way out was the small X in the corner, which on a phone is
            the hardest thing on the sheet to hit. */}
        <SheetFooter>
          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            {tCommon("actions.done")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
