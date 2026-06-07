import type { CSSProperties } from "react";

interface MushafSurahHeaderProps {
  surahName: string;
  headerLines?: number;
}

export function MushafSurahHeader({
  surahName,
  headerLines = 1,
}: MushafSurahHeaderProps) {
  const spacerLines = Math.max(0, headerLines - 1);

  return (
    <div
      className="mushaf-surah-header-block"
      style={
        { "--mushaf-header-spacer-lines": spacerLines } as CSSProperties
      }
      aria-label={`سورة ${surahName}`}
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
    </div>
  );
}
