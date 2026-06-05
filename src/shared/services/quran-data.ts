import { SURAH_NAMES } from "@/shared/constants/quran";
import type {
  ChapterData,
  ImlaeiData,
  ImlaeiVerse,
  MushafPageLayout,
  MushafVerse,
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

export function getPageSurahHeaderInfo(pageLayout: MushafPageLayout): {
  show: boolean;
  surahNumber: number;
  headerLines: number;
} {
  const firstLine = pageLayout.lines[0];
  const firstWord = firstLine?.words[0];
  if (!firstWord || firstWord.aya !== 1) {
    return { show: false, surahNumber: 0, headerLines: 0 };
  }

  return {
    show: true,
    surahNumber: firstWord.sura,
    headerLines: Math.max(0, firstLine.line - 1),
  };
}

export function getWordLayoutTotalPages(data: MushafWordLayoutData): number {
  return data.meta.page_count;
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
