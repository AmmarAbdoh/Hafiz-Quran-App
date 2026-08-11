import { SURAH_NAMES } from "./constants";
import type { MushafPageLayout, MushafVerse, MushafWordLine } from "./types";

export const MUSHAF_LINES_PER_PAGE = 15;

interface MushafSurahHeaderPlacement {
  surahNumber: number;
  beforeLine: number;
  headerLines: number;
}

type MushafPageItem =
  | {
      type: "surah-header";
      surahNumber: number;
      headerLines: number;
      key: string;
    }
  | { type: "line"; line: MushafWordLine; key: string };

/** Expand sparse layout data into the fixed 15-line Madani page grid. */
export function buildFullWordLines(
  pageLayout: MushafPageLayout,
): MushafWordLine[] {
  const linesByNumber = new Map(
    pageLayout.lines.map((line) => [line.line, line]),
  );
  const lines: MushafWordLine[] = [];

  for (let line = 1; line <= MUSHAF_LINES_PER_PAGE; line += 1) {
    lines.push(linesByNumber.get(line) ?? { line, words: [] });
  }

  return lines;
}

/** Find each surah opening on a page and the space reserved for its heading. */
export function getPageSurahHeaders(
  pageLayout: MushafPageLayout,
): MushafSurahHeaderPlacement[] {
  const sortedLines = [...pageLayout.lines].sort(
    (left, right) => left.line - right.line,
  );
  const contentLineNumbers = sortedLines
    .filter((line) => line.words.length > 0)
    .map((line) => line.line);
  const seenSurahs = new Set<number>();
  const headers: MushafSurahHeaderPlacement[] = [];

  for (const line of sortedLines) {
    const firstWord = line.words[0];
    if (!firstWord || firstWord.aya !== 1 || seenSurahs.has(firstWord.sura)) {
      continue;
    }

    seenSurahs.add(firstWord.sura);
    const previousContentLines = contentLineNumbers.filter(
      (lineNumber) => lineNumber < line.line,
    );
    const previousLine =
      previousContentLines.length > 0 ? Math.max(...previousContentLines) : 0;

    headers.push({
      surahNumber: firstWord.sura,
      beforeLine: line.line,
      headerLines: Math.max(1, line.line - previousLine - 1),
    });
  }

  return headers;
}

export function buildMushafPageItems(
  pageLayout: MushafPageLayout,
): MushafPageItem[] {
  const headersByLine = new Map(
    getPageSurahHeaders(pageLayout).map((header) => [
      header.beforeLine,
      header,
    ]),
  );
  const items: MushafPageItem[] = [];

  for (const line of buildFullWordLines(pageLayout)) {
    const header = headersByLine.get(line.line);
    if (header) {
      items.push({
        type: "surah-header",
        surahNumber: header.surahNumber,
        headerLines: header.headerLines,
        key: `surah-header-${header.surahNumber}-L${line.line}`,
      });
    }

    if (line.words.length > 0) {
      items.push({
        type: "line",
        line,
        key: `line-${line.line}`,
      });
    }
  }

  return items;
}

export function buildMushafPageItemsForSurah(
  pageLayout: MushafPageLayout,
  surahNumber: number,
): MushafPageItem[] {
  const filteredItems: MushafPageItem[] = [];

  for (const item of buildMushafPageItems(pageLayout)) {
    if (item.type === "surah-header") {
      if (item.surahNumber !== surahNumber) continue;
      filteredItems.push({
        ...item,
        headerLines: filteredItems.length === 0 ? 1 : item.headerLines,
      });
      continue;
    }

    const words = item.line.words.filter((word) => word.sura === surahNumber);
    if (words.length === 0) continue;

    filteredItems.push({
      type: "line",
      line: { line: item.line.line, words },
      key: `${item.key}-s${surahNumber}`,
    });
  }

  return filteredItems;
}

export function getSurahTashkeelName(
  mushafVerses: MushafVerse[],
  surahNumber: number,
): string {
  const verse = mushafVerses.find((item) => item.sura_no === surahNumber);
  return (
    verse?.sura_name_ar ?? SURAH_NAMES[surahNumber - 1] ?? `سورة ${surahNumber}`
  );
}

export function buildSurahNameIndex(
  mushafVerses: MushafVerse[],
): ReadonlyMap<number, string> {
  const names = new Map<number, string>();
  for (const verse of mushafVerses) {
    if (!names.has(verse.sura_no)) {
      names.set(verse.sura_no, verse.sura_name_ar);
    }
  }
  return names;
}
