import {
  buildExpectedWord,
  type ExpectedPracticeWord,
} from "@/features/quran-reader/lib/constrainedWordAligner";
import {
  buildFullWordLines,
  getWordLayoutForPage,
} from "@/shared/services/quran-data";
import type {
  MushafWord,
  MushafWordLayoutData,
} from "@/shared/types/quran";

const QURAN_COM_API = "https://api.quran.com/api/v4";
const verseWordsCache = new Map<
  string,
  Map<number, { raw: string; display: string }>
>();

interface QuranComWord {
  position: number;
  text_uthmani: string;
  text_imlaei?: string;
  text_imlaei_simple?: string;
  char_type_name: string;
}

function pickWordDisplayText(word: QuranComWord): string {
  return (
    word.text_imlaei_simple?.trim() ||
    word.text_imlaei?.trim() ||
    word.text_uthmani?.trim() ||
    ""
  );
}

async function fetchVerseWordsMap(
  verseKey: string,
): Promise<Map<number, { raw: string; display: string }>> {
  const cached = verseWordsCache.get(verseKey);
  if (cached) return cached;

  const response = await fetch(
    `${QURAN_COM_API}/verses/by_key/${encodeURIComponent(verseKey)}?words=true&word_fields=text_uthmani,text_imlaei,text_imlaei_simple,position,char_type_name`,
  );

  if (!response.ok) {
    throw new Error(`Failed to load words for ${verseKey}`);
  }

  const data = (await response.json()) as {
    verse?: { words?: QuranComWord[] };
  };

  const map = new Map<number, { raw: string; display: string }>();
  for (const word of data.verse?.words ?? []) {
    if (word.char_type_name === "end") continue;
    map.set(word.position, {
      raw: word.text_uthmani,
      display: pickWordDisplayText(word),
    });
  }

  verseWordsCache.set(verseKey, map);
  return map;
}

export async function buildPageExpectedWords(
  words: MushafWord[],
): Promise<ExpectedPracticeWord[]> {
  const contentWords = words.filter((word) => word.char_type !== "end");
  const verseKeys = [
    ...new Set(contentWords.map((word) => word.verse_key)),
  ];

  const maps = await Promise.all(
    verseKeys.map(async (verseKey) => ({
      verseKey,
      map: await fetchVerseWordsMap(verseKey),
    })),
  );

  const byVerse = new Map(maps.map((entry) => [entry.verseKey, entry.map]));

  return contentWords.map((word) => {
    const entry = byVerse.get(word.verse_key)?.get(word.word);
    const raw = entry?.raw ?? `word-${word.location}`;
    const display = entry?.display ?? raw;
    return buildExpectedWord(word.location, word.verse_key, raw, display);
  });
}

export function clearVerseWordsCache(): void {
  verseWordsCache.clear();
}

export function getPageContentWords(
  wordLayout: MushafWordLayoutData,
  page: number,
): MushafWord[] {
  const pageLayout = getWordLayoutForPage(wordLayout, page);
  if (!pageLayout) return [];

  return buildFullWordLines(pageLayout)
    .flatMap((line) => line.words)
    .filter((word) => word.char_type !== "end");
}
