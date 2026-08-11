import type { MushafVerse } from "@/domain/quran";
import { generateHiddenIndex } from "../questionTypes";
import type { FillBlankQuizQuestion } from "../types";
import {
  getAdjacentVersesInSurah,
  shuffleArray,
  toVerseKey,
} from "../versePool";
import { createQuestionId } from "./shared";

function buildSearchLabel(verse: MushafVerse): string {
  return `${verse.aya_text_emlaey} · ${verse.sura_name_ar} ${verse.aya_no}`;
}

export function generateFillBlankQuestion(
  verse: MushafVerse,
  pool: MushafVerse[],
  mushafData: MushafVerse[],
): FillBlankQuizQuestion {
  const { previous, next } = getAdjacentVersesInSurah(pool, mushafData, verse);
  const hiddenIndex = generateHiddenIndex(
    Boolean(previous),
    true,
    Boolean(next),
  );
  const hiddenVerse =
    hiddenIndex === 0 ? previous! : hiddenIndex === 2 ? next! : verse;

  return {
    id: createQuestionId(),
    type: "fill_blank",
    verse,
    verseKey: toVerseKey(verse),
    hiddenVerse,
    hiddenVerseKey: toVerseKey(hiddenVerse),
    page: hiddenVerse.page,
    searchOptions: shuffleArray(
      pool.map((item) => ({
        id: toVerseKey(item),
        label: buildSearchLabel(item),
      })),
    ),
  };
}
