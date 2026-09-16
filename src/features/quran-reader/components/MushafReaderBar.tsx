import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";

interface MushafReaderBarProps {
  page: number;
  juzNumber: number | null;
  hizbNumber: number | null;
  pageControls: ReactNode;
  showControls: boolean;
}

/**
 * The strip at the foot of the page: where this page sits in the mushaf, and
 * the controls to leave it.
 *
 * Page navigation used to be hidden until the page was tapped and then taken
 * away again four seconds later, which is most of why the reader's controls
 * felt like they came and went on their own. They are shown by default now and
 * only leave when the reader asks for a bare page. Doing that costs no reading
 * area: the page is scaled to fit above a constant dock allowance, so the room
 * this strip occupies is reserved whether or not anything is drawn in it.
 *
 * The position itself never hides - the reader always states where it is
 * without being asked (INVARIANT #14) - so the page number moves into the
 * navigation pill when that is shown, and stands alone when it is not.
 */
export function MushafReaderBar({
  page,
  juzNumber,
  hizbNumber,
  pageControls,
  showControls,
}: MushafReaderBarProps) {
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
    <div className="mx-auto flex min-h-13 w-full max-w-content items-center justify-between gap-3 px-4 sm:px-6">
      <p className="flex min-w-0 items-center gap-1.5 text-label text-muted-foreground">
        {location.map((part, index) => (
          <span key={part} className="flex items-center gap-1.5 truncate">
            {index > 0 ? <span aria-hidden="true">·</span> : null}
            {part}
          </span>
        ))}
      </p>

      {showControls ? (
        pageControls
      ) : (
        /* Read aloud with its label, since a bare digit says nothing alone. */
        <span
          className="shrink-0 text-label font-medium text-muted-foreground"
          aria-label={t("status.page", { page: formatNumber(page, locale) })}
        >
          {formatNumber(page, locale)}
        </span>
      )}
    </div>
  );
}
