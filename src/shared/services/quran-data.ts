import { SURAH_NAMES } from "@/shared/constants/quran";
import type {
  ChapterData,
  ImlaeiData,
  ImlaeiVerse,
  MushafPageLayout,
  MushafVerse,
  MushafWord,
  MushafWordLayoutData,
  MushafWordLine,
  PageLine,
  TafseerData,
  UthmaniData,
  UthmaniVerse,
  VerseInfoItem,
  VerseInfoRecord,
} from "@/shared/types/quran";

const MUSHAF_LINES_PER_PAGE = 15;

const BASE = "/data/quran";

const cache = new Map<string, unknown>();

async function fetchJson<T>(path: string): Promise<T> {
  const cached = cache.get(path);
  if (cached) return cached as T;

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }
  const data = (await response.json()) as T;
  cache.set(path, data);
  return data;
}

export function clearQuranDataCache(): void {
  cache.clear();
  clearWordLayoutPageIndex();
}

export async function loadMushafData(): Promise<MushafVerse[]> {
  return fetchJson<MushafVerse[]>(`${BASE}/hafsData_v2-0.json`);
}

export async function loadMushafWordLayout(): Promise<MushafWordLayoutData> {
  return fetchJson<MushafWordLayoutData>(
    `${BASE}/mushaf_word_layout_v4.json`,
  );
}

let quranReaderPreloadPromise: Promise<void> | null = null;

/** Warm the in-memory Quran cache once at app startup. */
export function preloadQuranReaderData(): Promise<void> {
  if (!quranReaderPreloadPromise) {
    quranReaderPreloadPromise = Promise.all([
      loadMushafData(),
      loadMushafWordLayout(),
      loadVerseInfoRecords(),
    ]).then(() => undefined);
  }
  return quranReaderPreloadPromise;
}

let wordLayoutPageIndex: Map<number, MushafPageLayout> | null = null;

export function buildWordLayoutPageIndex(
  data: MushafWordLayoutData,
): Map<number, MushafPageLayout> {
  const index = new Map<number, MushafPageLayout>();
  for (const page of data.pages) {
    index.set(page.page, page);
  }
  return index;
}

export function getWordLayoutPageIndex(
  data: MushafWordLayoutData,
): Map<number, MushafPageLayout> {
  if (!wordLayoutPageIndex) {
    wordLayoutPageIndex = buildWordLayoutPageIndex(data);
  }
  return wordLayoutPageIndex;
}

export function clearWordLayoutPageIndex(): void {
  wordLayoutPageIndex = null;
}

export function getWordLayoutForPage(
  data: MushafWordLayoutData,
  page: number,
): MushafPageLayout | undefined {
  return getWordLayoutPageIndex(data).get(page);
}

/** Expand sparse mushaf lines into a fixed 15-line page grid. */
export function buildFullWordLines(
  pageLayout: MushafPageLayout,
): MushafWordLine[] {
  const lineMap = new Map(pageLayout.lines.map((line) => [line.line, line]));
  const lines: MushafWordLine[] = [];

  for (let lineNum = 1; lineNum <= MUSHAF_LINES_PER_PAGE; lineNum++) {
    lines.push(lineMap.get(lineNum) ?? { line: lineNum, words: [] });
  }

  return lines;
}

export interface MushafSurahHeaderPlacement {
  surahNumber: number;
  beforeLine: number;
  headerLines: number;
}

/** Every surah that begins on this page (ayah 1), in line order. */
export function getPageSurahHeaders(
  pageLayout: MushafPageLayout,
): MushafSurahHeaderPlacement[] {
  const sortedLines = [...pageLayout.lines].sort((a, b) => a.line - b.line);
  const contentLineNumbers = sortedLines
    .filter((line) => line.words.length > 0)
    .map((line) => line.line);

  const headers: MushafSurahHeaderPlacement[] = [];
  const seenSurahs = new Set<number>();

  for (const line of sortedLines) {
    const firstWord = line.words[0];
    if (!firstWord || firstWord.aya !== 1) continue;
    if (seenSurahs.has(firstWord.sura)) continue;
    seenSurahs.add(firstWord.sura);

    const previousContentLines = contentLineNumbers.filter(
      (lineNumber) => lineNumber < line.line,
    );
    const lastContentLine =
      previousContentLines.length > 0
        ? Math.max(...previousContentLines)
        : 0;
    const gapLines = Math.max(0, line.line - lastContentLine - 1);

    headers.push({
      surahNumber: firstWord.sura,
      beforeLine: line.line,
      headerLines: Math.max(1, gapLines),
    });
  }

  return headers;
}

export type MushafPageItem =
  | {
      type: "surah-header";
      surahNumber: number;
      headerLines: number;
      key: string;
    }
  | { type: "line"; line: MushafWordLine; key: string };

export function buildMushafPageItems(pageLayout: MushafPageLayout): MushafPageItem[] {
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
  const filtered: MushafPageItem[] = [];

  for (const item of buildMushafPageItems(pageLayout)) {
    if (item.type === "surah-header") {
      if (item.surahNumber !== surahNumber) continue;
      filtered.push({
        ...item,
        headerLines: filtered.length === 0 ? 1 : item.headerLines,
      });
      continue;
    }

    const words = item.line.words.filter((word) => word.sura === surahNumber);
    if (words.length === 0) continue;

    filtered.push({
      type: "line",
      line: { line: item.line.line, words },
      key: `${item.key}-s${surahNumber}`,
    });
  }

  return filtered;
}

export function getWordLayoutTotalPages(data: MushafWordLayoutData): number {
  return data.meta.page_count;
}

export function buildWordsByLocation(
  data: MushafWordLayoutData,
): Map<string, MushafWord> {
  const map = new Map<string, MushafWord>();
  for (const page of data.pages) {
    for (const line of page.lines) {
      for (const word of line.words) {
        map.set(word.location, word);
      }
    }
  }
  return map;
}

export function findMushafVerse(
  mushafData: MushafVerse[],
  sura: number,
  aya: number,
): MushafVerse | undefined {
  return mushafData.find((verse) => verse.sura_no === sura && verse.aya_no === aya);
}

export async function loadChapter(surahNumber: number): Promise<ChapterData> {
  return fetchJson<ChapterData>(
    `${BASE}/Chapters_Uthmani/chapter_${surahNumber}.json`,
  );
}

export async function loadJuz(juzNumber: number): Promise<ChapterData> {
  return fetchJson<ChapterData>(`${BASE}/Juzs/juz_${juzNumber}.json`);
}

export async function loadImlaeiVerses(): Promise<ImlaeiVerse[]> {
  const data = await fetchJson<ImlaeiData>(
    `${BASE}/quran_verses_imlaei_cleaned.json`,
  );
  const uniqueTexts = new Set<string>();
  const uniqueVerses: ImlaeiVerse[] = [];
  for (const verse of data.verses) {
    if (!uniqueTexts.has(verse.text_imlaei)) {
      uniqueTexts.add(verse.text_imlaei);
      uniqueVerses.push(verse);
    }
  }
  return uniqueVerses;
}

export async function loadUthmaniVerses(): Promise<UthmaniVerse[]> {
  const data = await fetchJson<UthmaniData>(`${BASE}/Quran_Uthmani.json`);
  return data.verses;
}

export async function loadVerseInfoRecords(): Promise<VerseInfoRecord[]> {
  return fetchJson<VerseInfoRecord[]>(`${BASE}/Quran_info.json`);
}

export async function loadTafseer(
  tafseerId: string,
  surah: number,
  ayah: number,
): Promise<string> {
  try {
    const data = await fetchJson<TafseerData>(
      `${BASE}/quran_tafseer/tafseer_${tafseerId}/surah_${surah}/tafseer_${tafseerId}_ayah_${ayah}.json`,
    );
    return data.text;
  } catch {
    return "تعذر تحميل التفسير.";
  }
}

export function getVerseInfo(
  verseId: number,
  records: VerseInfoRecord[],
): VerseInfoItem[] {
  const verseInfo = records.find((record) => record.id === verseId);
  if (!verseInfo) return [];

  const surahNumber = parseInt(verseInfo.verse_key.split(":")[0] ?? "0", 10);

  return [
    { key: "اسم السورة", value: SURAH_NAMES[surahNumber - 1] ?? "" },
    { key: "رقم الاية", value: verseInfo.verse_number },
    { key: "رقم الجزء", value: verseInfo.juz_number },
    { key: "رقم الحزب", value: verseInfo.hizb_number },
    { key: "الصفحة", value: verseInfo.page_number },
  ];
}

export async function getRandomVerse(
  mode: "surah" | "juz",
  indices: number[],
): Promise<UthmaniVerse | null> {
  if (indices.length === 0) return null;

  const randomIndex = indices[Math.floor(Math.random() * indices.length)];
  if (!randomIndex) return null;

  const data =
    mode === "juz"
      ? await loadJuz(randomIndex)
      : await loadChapter(randomIndex);

  if (data.verses.length === 0) return null;

  const verseIndex = Math.floor(Math.random() * data.verses.length);
  return data.verses[verseIndex] ?? null;
}

export function getPrevAndNextVerse(
  verse: UthmaniVerse,
  allVerses: UthmaniVerse[],
): [UthmaniVerse | null, UthmaniVerse | null] {
  const surahNumber = verse.verse_key.split(":")[0];
  const currentIndex = allVerses.findIndex((v) => v.id === verse.id);

  if (currentIndex === -1) return [null, null];

  const prev =
    currentIndex > 0 &&
    allVerses[currentIndex - 1]?.verse_key.startsWith(`${surahNumber}:`)
      ? (allVerses[currentIndex - 1] ?? null)
      : null;

  const next =
    currentIndex < allVerses.length - 1 &&
    allVerses[currentIndex + 1]?.verse_key.startsWith(`${surahNumber}:`)
      ? (allVerses[currentIndex + 1] ?? null)
      : null;

  return [prev, next];
}

export function getVersesForPage(
  mushafData: MushafVerse[],
  page: number,
): MushafVerse[] {
  return mushafData.filter((verse) => verse.page === page);
}

/** Group page verses into mushaf lines using line_start / line_end metadata. */
export function getPageLines(verses: MushafVerse[]): PageLine[] {
  if (verses.length === 0) return [];

  const maxLine = Math.max(
    MUSHAF_LINES_PER_PAGE,
    ...verses.map((v) => v.line_end),
  );

  const lines: PageLine[] = [];
  for (let lineNum = 1; lineNum <= maxLine; lineNum++) {
    const lineVerses = verses.filter((v) => v.line_start === lineNum);
    lines.push({ lineNumber: lineNum, verses: lineVerses });
  }
  return lines;
}

export function getSurahHeaderLines(verses: MushafVerse[]): number {
  const first = verses[0];
  if (!first || first.aya_no !== 1) return 0;
  return Math.max(0, first.line_start - 1);
}

export function getTotalPages(mushafData: MushafVerse[]): number {
  return mushafData.reduce((max, verse) => Math.max(max, verse.page), 0);
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

/** Distinct surahs that appear on this mushaf page, in numeric order. */
export function getPageSurahNumbers(
  mushafData: MushafVerse[],
  page: number,
): number[] {
  const surahs = new Set<number>();
  for (const verse of mushafData) {
    if (verse.page === page) {
      surahs.add(verse.sura_no);
    }
  }
  return [...surahs].sort((a, b) => a - b);
}

/** Mushaf page numbers that contain at least one ayah from this surah. */
export function getSurahPages(
  mushafData: MushafVerse[],
  surahNumber: number,
): number[] {
  const pages = new Set<number>();
  for (const verse of mushafData) {
    if (verse.sura_no === surahNumber) {
      pages.add(verse.page);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

/** Tashkeel surah label from mushaf metadata (e.g. الفَاتِحة). */
export function getSurahTashkeelName(
  mushafData: MushafVerse[],
  surahNumber: number,
): string {
  const verse = mushafData.find((item) => item.sura_no === surahNumber);
  return (
    verse?.sura_name_ar ??
    SURAH_NAMES[surahNumber - 1] ??
    `سورة ${surahNumber}`
  );
}
