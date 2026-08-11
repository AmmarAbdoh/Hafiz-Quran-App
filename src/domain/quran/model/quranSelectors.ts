import { MUSHAF_LINES_PER_PAGE } from "./mushafLayout";
import type {
  MushafVerse,
  PageLine,
  UthmaniVerse,
  VerseInfoItem,
  VerseInfoRecord,
} from "./types";

export function findMushafVerse(
  mushafData: MushafVerse[],
  surah: number,
  ayah: number,
): MushafVerse | undefined {
  return mushafData.find(
    (verse) => verse.sura_no === surah && verse.aya_no === ayah,
  );
}

export function getVerseInfo(
  verseId: number,
  records: VerseInfoRecord[],
): VerseInfoItem[] {
  const verseInfo = records.find((record) => record.id === verseId);
  if (!verseInfo) return [];

  return [
    { key: "surah", value: verseInfo.verse_key.split(":")[0] ?? "" },
    { key: "ayah", value: verseInfo.verse_number },
    { key: "juz", value: verseInfo.juz_number },
    { key: "hizb", value: verseInfo.hizb_number },
    { key: "page", value: verseInfo.page_number },
  ];
}

export function getPrevAndNextVerse(
  verse: UthmaniVerse,
  allVerses: UthmaniVerse[],
): [UthmaniVerse | null, UthmaniVerse | null] {
  const surahNumber = verse.verse_key.split(":")[0];
  const currentIndex = allVerses.findIndex((item) => item.id === verse.id);
  if (currentIndex === -1) return [null, null];

  const previous =
    currentIndex > 0 &&
    allVerses[currentIndex - 1]?.verse_key.startsWith(`${surahNumber}:`)
      ? (allVerses[currentIndex - 1] ?? null)
      : null;
  const next =
    currentIndex < allVerses.length - 1 &&
    allVerses[currentIndex + 1]?.verse_key.startsWith(`${surahNumber}:`)
      ? (allVerses[currentIndex + 1] ?? null)
      : null;
  return [previous, next];
}

export function getVersesForPage(
  mushafData: MushafVerse[],
  page: number,
): MushafVerse[] {
  return mushafData.filter((verse) => verse.page === page);
}

export function getPageLines(verses: MushafVerse[]): PageLine[] {
  if (verses.length === 0) return [];

  const maxLine = Math.max(
    MUSHAF_LINES_PER_PAGE,
    ...verses.map((verse) => verse.line_end),
  );
  const lines: PageLine[] = [];
  for (let lineNumber = 1; lineNumber <= maxLine; lineNumber += 1) {
    lines.push({
      lineNumber,
      verses: verses.filter((verse) => verse.line_start === lineNumber),
    });
  }
  return lines;
}

export function getSurahHeaderLines(verses: MushafVerse[]): number {
  const first = verses[0];
  if (!first || first.aya_no !== 1) return 0;
  return Math.max(0, first.line_start - 1);
}

export function getFirstVerseOnPage(
  mushafData: MushafVerse[],
  page: number,
): MushafVerse | undefined {
  return mushafData.find((verse) => verse.page === page);
}

export function getSurahAyahCount(
  mushafData: MushafVerse[],
  surahNumber: number,
): number {
  return mushafData.filter((verse) => verse.sura_no === surahNumber).length;
}

export function getPageSurahNumbers(
  mushafData: MushafVerse[],
  page: number,
): number[] {
  const surahs = new Set<number>();
  for (const verse of mushafData) {
    if (verse.page === page) surahs.add(verse.sura_no);
  }
  return [...surahs].sort((left, right) => left - right);
}

export function getSurahPages(
  mushafData: MushafVerse[],
  surahNumber: number,
): number[] {
  const pages = new Set<number>();
  for (const verse of mushafData) {
    if (verse.sura_no === surahNumber) pages.add(verse.page);
  }
  return [...pages].sort((left, right) => left - right);
}
