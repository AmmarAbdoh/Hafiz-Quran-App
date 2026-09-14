import type { MushafVerse } from "@/domain/quran";
import { generateHiddenIndex } from "../questionTypes";
import type { FillBlankQuizQuestion } from "../types";
import {
  getAdjacentVersesInSurah,
  shuffleArray,
  toVerseKey,
} from "../versePool";
import { createQuestionId, type VerseRefFormatter } from "./shared";

function buildSearchLabel(
  verse: MushafVerse,
  verseRef: VerseRefFormatter,
): string {
  return `${verse.aya_text_emlaey} · ${verseRef(verse.sura_no, verse.aya_no)}`;
}

/**
 * Search candidates cover the whole surah of the hidden ayah, not just the
 * quizzed scope: on a three-ayah scope the answer would otherwise be whichever
 * ayah is missing from the page.
 */
function buildSearchOptions(
  pool: MushafVerse[],
  mushafData: MushafVerse[],
  hiddenVerse: MushafVerse,
): MushafVerse[] {
  const candidates = new Map<string, MushafVerse>();
  for (const verse of pool) candidates.set(toVerseKey(verse), verse);
  for (const verse of mushafData) {
    if (verse.sura_no === hiddenVerse.sura_no) {
      candidates.set(toVerseKey(verse), verse);
    }
  }
  return [...candidates.values()];
}

export function generateFillBlankQuestion(
  verse: MushafVerse,
  pool: MushafVerse[],
  mushafData: MushafVerse[],
  verseRef: VerseRefFormatter,
): FillBlankQuizQuestion | null {
  const { previous, next } = getAdjacentVersesInSurah(pool, mushafData, verse);
  const hiddenIndex = generateHiddenIndex(
    Boolean(previous),
    true,
    Boolean(next),
  );
  const hiddenVerse =
    hiddenIndex === 0 ? previous! : hiddenIndex === 2 ? next! : verse;
  const options = buildSearchOptions(pool, mushafData, hiddenVerse);
  if (options.length < 2) return null;

  return {
    id: createQuestionId(),
    type: "fill_blank",
    verse,
    verseKey: toVerseKey(verse),
    testedVerseKey: toVerseKey(hiddenVerse),
    hiddenVerse,
    hiddenVerseKey: toVerseKey(hiddenVerse),
    page: hiddenVerse.page,
    searchOptions: shuffleArray(
      options.map((item) => ({
        id: toVerseKey(item),
        label: buildSearchLabel(item, verseRef),
      })),
    ),
  };
}
