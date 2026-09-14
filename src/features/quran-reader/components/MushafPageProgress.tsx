import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";

interface MushafPageProgressProps {
  page: number;
  juzNumber: number | null;
  hizbNumber: number | null;
}

/**
 * The folio line at the foot of the page: the juz and hizb it belongs to at one
 * edge, and the page number at the other, printed bare the way a mushaf does.
 */
export function MushafPageProgress({
  page,
  juzNumber,
  hizbNumber,
}: MushafPageProgressProps) {
  const { t } = useTranslation("reader");
  const { locale } = useLocale();

  const location = [
    juzNumber
      ? t("status.juz", { juz: formatNumber(juzNumber, locale) })
      : null,
    hizbNumber
      ? t("status.hizb", { hizb: formatNumber(hizbNumber, locale) })
      : null,
  ].filter((part): part is string => part !== null);

  return (
    <p className="mx-auto flex min-h-9 w-full max-w-6xl items-center justify-between gap-3 px-4 text-caption text-muted-foreground sm:px-6">
      <span className="flex min-w-0 items-center gap-1.5">
        {location.map((part, index) => (
          <span key={part} className="flex items-center gap-1.5 truncate">
            {index > 0 ? <span aria-hidden="true">·</span> : null}
            {part}
          </span>
        ))}
      </span>
      {/* Read aloud with its label, since a bare digit says nothing on its own. */}
      <span
        className="shrink-0 font-medium"
        aria-label={t("status.page", { page: formatNumber(page, locale) })}
      >
        {formatNumber(page, locale)}
      </span>
    </p>
  );
}
