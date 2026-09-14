import { normalizeArabicForMatch } from "@/shared/lib/arabic-normalize";
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
  const trimmed = query.trim();
  const match = /^(\d{1,3})\s*[:٫،]\s*(\d{1,3})$/.exec(trimmed);
  if (!match) return null;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return null;
  if (surah < 1 || surah > 114 || ayah < 1) return null;
  return { surah, ayah };
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

  const matches: AyahSearchResult[] = [];

  for (const entry of index) {
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

  return matches.slice(0, limit);
}
