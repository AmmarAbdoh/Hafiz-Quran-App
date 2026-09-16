import {
  normalizeArabicDigits,
  normalizeArabicForMatch,
} from "@/shared/lib/arabic-normalize";
import { findSurahsByName } from "@/domain/quran";
import type { MushafVerse } from "@/domain/quran";

export interface AyahSearchEntry {
  surah: number;
  ayah: number;
  text: string;
  normalizedText: string;
}

export interface AyahSearchResult extends AyahSearchEntry {
  score: number;
}

const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 20;

export function parseAyahReference(
  query: string,
): { surah: number; ayah: number } | null {
  // ٢:٢٥٥ and 2:255 are the same reference; only the digits differ.
  const trimmed = normalizeArabicDigits(query).trim();
  const match = /^(\d{1,3})\s*[:٫،]\s*(\d{1,3})$/.exec(trimmed);
  if (!match) return null;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return null;
  if (surah < 1 || surah > 114 || ayah < 1) return null;
  return { surah, ayah };
}

export function matchSurahNames(
  query: string,
): { surah: number; ayah: number }[] {
  const normalized = normalizeArabicForMatch(query);
  if (normalized.length < MIN_QUERY_LENGTH) return [];

  // A trailing number is the ayah, not part of the name - no surah is named
  // with a digit, so this cannot swallow one.
  const trailing = /^(.*?)\s+(\d{1,3})$/.exec(normalized);
  const namePart = trailing?.[1]?.trim() ?? normalized;
  const ayah = trailing ? Number(trailing[2]) : 1;
  if (namePart.length < MIN_QUERY_LENGTH || ayah < 1) return [];

  return findSurahsByName(namePart).map((surah) => ({ surah, ayah }));
}

export function buildAyahSearchIndex(
  mushafData: MushafVerse[],
): AyahSearchEntry[] {
  const seen = new Set<string>();
  const entries: AyahSearchEntry[] = [];

  for (const verse of mushafData) {
    const key = `${verse.sura_no}:${verse.aya_no}`;
    if (seen.has(key)) continue;

    const text = verse.aya_text_emlaey.trim();
    if (!text) continue;

    seen.add(key);
    entries.push({
      surah: verse.sura_no,
      ayah: verse.aya_no,
      text,
      normalizedText: normalizeArabicForMatch(text),
    });
  }

  return entries;
}

function scoreMatch(normalizedText: string, normalizedQuery: string): number {
  if (!normalizedQuery) return -1;
  if (normalizedText === normalizedQuery) return 0;
  if (normalizedText.startsWith(normalizedQuery)) return 1;
  if (normalizedText.includes(normalizedQuery)) return 2;

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (
    tokens.length > 1 &&
    tokens.every((token) => normalizedText.includes(token))
  ) {
    return 3;
  }

  return -1;
}

export function searchAyahsByText(
  index: AyahSearchEntry[],
  query: string,
  limit = DEFAULT_LIMIT,
): AyahSearchResult[] {
  const reference = parseAyahReference(query);
  if (reference) {
    const match = index.find(
      (entry) =>
        entry.surah === reference.surah && entry.ayah === reference.ayah,
    );
    return match ? [{ ...match, score: 0 }] : [];
  }

  const normalizedQuery = normalizeArabicForMatch(query);
  if (normalizedQuery.length < MIN_QUERY_LENGTH) return [];

  const byKey = new Map(
    index.map((entry) => [`${entry.surah}:${entry.ayah}`, entry]),
  );

  /*
   * Named surahs come first, but they do not replace the text results the way
   * a numeric reference does. Several surah names - النور, الفجر - are also
   * ordinary words of the Quran, and a reader typing one of those is at least
   * as likely to be looking for the ayah that contains it.
   */
  const named: AyahSearchResult[] = [];
  const seen = new Set<string>();
  for (const { surah, ayah } of matchSurahNames(query)) {
    const key = `${surah}:${ayah}`;
    const entry = byKey.get(key);
    if (!entry || seen.has(key)) continue;
    seen.add(key);
    named.push({ ...entry, score: 0 });
  }

  const matches: AyahSearchResult[] = [];

  for (const entry of index) {
    if (seen.has(`${entry.surah}:${entry.ayah}`)) continue;
    const score = scoreMatch(entry.normalizedText, normalizedQuery);
    if (score < 0) continue;

    matches.push({ ...entry, score });
  }

  matches.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.text.length !== b.text.length) return a.text.length - b.text.length;
    if (a.surah !== b.surah) return a.surah - b.surah;
    return a.ayah - b.ayah;
  });

  return [...named, ...matches].slice(0, limit);
}
