import type { CSSProperties } from "react";
import { BISMILLAH_TEXT } from "../model/constants";

interface MushafSurahHeaderProps {
  surahName: string;
  headerLines?: number;
  accessibleLabel?: string;
  showBismillah?: boolean;
}

export function MushafSurahHeader({
  surahName,
  headerLines = 1,
  accessibleLabel = surahName.startsWith("سورة ")
    ? surahName
    : `سورة ${surahName}`,
  showBismillah = false,
}: MushafSurahHeaderProps) {
  /*
   * `headerLines` is how many line slots the Madani grid leaves blank for this
   * surah opening, and the name band and bismillah are what fill them - so the
   * spacer is only whatever those two do not use. Counting the name band as
   * additional to the reserved slots made 88 pages a full line taller than the
   * grid they are laid out on, which is what pushed surah-opening pages past
   * the bottom of the screen.
   */
  const occupiedLines = 1 + (showBismillah ? 1 : 0);
  const spacerLines = Math.max(0, headerLines - occupiedLines);

  /*
   * On 21 pages a surah begins on the line straight after the previous one
   * ends, so the grid reserves a single slot, and the opening still needs a
   * name band and a bismillah - two. Those pages ran exactly one line past the
   * bottom of the stage and scrolled, which is the one thing the fit is for.
   *
   * The printed mushaf sets these openings tighter rather than stealing a line
   * of Quran, so the block compresses to the slots it was given: each part
   * takes an equal share of them.
   */
  const lineFit = occupiedLines > headerLines ? headerLines / occupiedLines : 1;

  return (
    <div
      className="mushaf-surah-header-block"
      style={
        {
          "--mushaf-header-spacer-lines": spacerLines,
          "--mushaf-header-line-fit": lineFit,
        } as CSSProperties
      }
      aria-label={accessibleLabel}
      dir="rtl"
      lang="ar"
    >
      {spacerLines > 0 ? (
        <div className="mushaf-surah-header__spacer" aria-hidden />
      ) : null}
      <div className="mushaf-surah-header">
        <span className="mushaf-surah-header__bracket" aria-hidden>
          ﴿
        </span>
        <span className="mushaf-surah-header__name font-mushaf">
          {surahName}
        </span>
        <span className="mushaf-surah-header__bracket" aria-hidden>
          ﴾
        </span>
      </div>
      {showBismillah ? (
        <p className="mushaf-bismillah font-mushaf" aria-label={BISMILLAH_TEXT}>
          {BISMILLAH_TEXT}
        </p>
      ) : null}
    </div>
  );
}
