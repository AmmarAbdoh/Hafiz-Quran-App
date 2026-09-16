import {
  normalizeArabicDigits,
  normalizeArabicForMatch,
} from "@/shared/lib/arabic-normalize";
import { SURAH_NAMES, SURAH_NAMES_EN } from "./constants";

/**
 * Finding a surah by name, for every list that offers one.
 *
 * Both name lists normalize through the same function - it strips the hyphens
 * and apostrophes out of "Al-Ma'idah" and the diacritics out of an Arabic
 * name - so one matcher serves both scripts and a reader can find a surah
 * without switching keyboards.
 */
const SURAH_NAME_KEYS = SURAH_NAMES.map((arabic, index) => ({
  surah: index + 1,
  keys: [arabic, SURAH_NAMES_EN[index] ?? ""]
    .filter(Boolean)
    .map(normalizeArabicForMatch),
}));

/*
 * The article begins a third of the names and is the first thing a reader
 * drops. In Arabic it is always written ال, but transliteration assimilates it
 * to the consonant that follows - As-Saff, An-Nas, Ash-Shams - so it has to be
 * recognised by the doubling rather than by its spelling. Without this, "saff"
 * is not a prefix of "assaff" and ranks below As-Saffat.
 */
const ASSIMILATED_ARTICLE_RE = /^a([bcdfghjklmnpqrstvwxyz]h?)\1/;

function withoutArticle(name: string): string {
  if (name.startsWith("ال")) return name.slice(2);
  if (name.startsWith("al")) return name.slice(2);
  const assimilated = ASSIMILATED_ARTICLE_RE.exec(name);
  if (assimilated?.[1]) return name.slice(1 + assimilated[1].length);
  return name;
}

/** Lower is a better match; -1 means no match at all. */
function scoreSurahName(name: string, query: string): number {
  if (!name) return -1;
  if (name === query) return 0;

  const bare = withoutArticle(name);
  if (bare === query) return 0;
  if (name.startsWith(query) || bare.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  return -1;
}

/**
 * Surah numbers matching a typed name, best first. An empty or whitespace
 * query matches nothing, so callers decide what an unfiltered list looks like.
 */
export function findSurahsByName(query: string): number[] {
  const normalized = normalizeArabicForMatch(query);
  if (normalized.length === 0) return [];

  const scored: { surah: number; score: number }[] = [];
  for (const entry of SURAH_NAME_KEYS) {
    const score = entry.keys.reduce((best, name) => {
      const next = scoreSurahName(name, normalized);
      if (next < 0) return best;
      return best < 0 ? next : Math.min(best, next);
    }, -1);
    if (score >= 0) scored.push({ surah: entry.surah, score });
  }

  scored.sort((a, b) => a.score - b.score || a.surah - b.surah);
  return scored.map(({ surah }) => surah);
}

/**
 * What a surah list should show for a typed query: the matching surah numbers,
 * best first, or null when the query is empty and the list should be whole.
 *
 * The three lists in the reader each rolled their own, and two of them matched
 * with a plain lowercase `includes`. That works for an English reader typing
 * "baqarah" and fails an Arabic one typing "بقره", because the stored name is
 * "البقرة" - a different alef, a ta marbuta and an article away.
 */
export function searchSurahNumbers(query: string): number[] | null {
  const trimmed = query.trim();
  if (trimmed.length === 0) return null;

  const digits = normalizeArabicDigits(trimmed);
  if (/^\d+$/.test(digits)) {
    return SURAH_NAME_KEYS.map(({ surah }) => surah).filter((surah) =>
      String(surah).startsWith(digits),
    );
  }

  return findSurahsByName(trimmed);
}
