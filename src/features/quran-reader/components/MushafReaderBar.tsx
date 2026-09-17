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

  const juzLabel = juzNumber
    ? t("status.juz", { juz: formatNumber(juzNumber, locale) })
    : null;
  const hizbLabel = hizbNumber
    ? t("status.hizb", { hizb: formatNumber(hizbNumber, locale) })
    : null;

  return (
    /*
     * A three-column grid, not space-between. With exactly two children,
     * space-between pushes one to each edge, which left the page control 142px
     * off centre on a phone and 482px off on a desktop - where the page it
     * turns sits in the middle of the screen and the control sat under the
     * surah rail. A printed mushaf centres the page number in its footer.
     *
     * The grid centres the control against the bar rather than against its
     * siblings, so it cannot drift when either label grows or shrinks.
     *
     * Juz sits in the leading cell and hizb in the trailing one - the near
     * and far corners of a printed mushaf's own footer - rather than the two
     * combined in one cell, which is where the page previously ran out of
     * width to put anything else.
     */
    <div className="mx-auto grid min-h-13 w-full max-w-content grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 pointer-fine:min-h-11 sm:px-6">
      <p className="flex min-w-0 items-center gap-1.5 text-label text-muted-foreground">
        {juzLabel ? <span className="truncate">{juzLabel}</span> : null}
      </p>

      <div className="flex justify-center">
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

      <p className="flex min-w-0 items-center justify-end gap-1.5 text-label text-muted-foreground">
        {hizbLabel ? <span className="truncate">{hizbLabel}</span> : null}
      </p>
    </div>
  );
}
