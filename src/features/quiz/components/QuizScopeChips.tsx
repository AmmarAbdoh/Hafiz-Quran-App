import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuizFormatters } from "../hooks/useQuizFormatters";

interface QuizScopeChipsProps {
  /** Selected indices, in the order they should read. */
  selected: number[];
  names: readonly string[];
  /** Language of the names: juz keep their Arabic opening words. */
  nameLanguage: "ar" | "en";
  emptyLabel: string;
  onRemove: (index: number) => void;
  onClear: () => void;
}

/**
 * Selected items are listed outside the picker as removable chips: a long
 * checkbox list hides what you already chose the moment you scroll away.
 */
export function QuizScopeChips({
  selected,
  names,
  nameLanguage,
  emptyLabel,
  onRemove,
  onClear,
}: QuizScopeChipsProps) {
  const { t } = useTranslation("quiz");
  const { formatNumber } = useQuizFormatters();

  if (selected.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-2">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <p className="text-caption font-semibold text-muted-foreground">
          {t("scope.selectedCount", {
            count: selected.length,
            formattedCount: formatNumber(selected.length),
          })}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="min-h-11 rounded-lg px-2 text-caption font-semibold text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("actions.clearAll")}
        </button>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {selected.map((index) => (
          <li key={index}>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm transition-colors hover:border-destructive/50 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-muted-foreground">
                {formatNumber(index)}.
              </span>
              <bdi
                dir={nameLanguage === "ar" ? "rtl" : "ltr"}
                lang={nameLanguage}
              >
                {names[index - 1] ?? ""}
              </bdi>
              <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="sr-only">{t("scope.remove")}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
