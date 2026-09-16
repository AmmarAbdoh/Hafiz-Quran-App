import type { MushafVerse } from "@/domain/quran";
import { generateHiddenIndex } from "../questionTypes";
import type { FillBlankQuizQuestion, QuizChoice } from "../types";
import {
  getAdjacentVersesInSurah,
  shuffleArray,
  toVerseKey,
} from "../versePool";
import { createQuestionId } from "./shared";

/*
 * The words alone. The label used to end with the ayah's own reference - "…
 * فستعلمون كيف نذير · 67:17" - which answers the question without reading any
 * of it: the page shows the ayahs either side of the blank, so the missing
 * number is arithmetic, and the option that carries it is the answer. An
 * option has to be identifiable by what it says, not by its label.
 */
function buildSearchLabel(verse: MushafVerse): string {
  return verse.aya_text_emlaey;
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

const CHOICE_COUNT = 4;

/**
 * A handful of options to pick from, so answering is a tap like every other
 * question type. The full list stays on the question as searchOptions, for the
 * learner who wants to look for something specific.
 *
 * Distractors avoid the ayahs printed around the blank: those are visible on
 * the page, so offering them is offering answers the learner can rule out by
 * looking rather than by remembering.
 */
function buildChoices(
  options: MushafVerse[],
  hiddenVerse: MushafVerse,
  visibleKeys: Set<string>,
): QuizChoice[] {
  const hiddenKey = toVerseKey(hiddenVerse);
  const others = options.filter((item) => toVerseKey(item) !== hiddenKey);
  const unseen = others.filter((item) => !visibleKeys.has(toVerseKey(item)));

  /*
   * Only unseen ayahs. Topping the list up with a visible neighbour looked
   * like a kindness when the surah is short, but an option printed on the page
   * beside the blank is one the learner rules out by looking - and with two
   * options, one of them visible, the answer is simply given away. Better to
   * offer no grid at all and let them search.
   */
  const distractors = shuffleArray(unseen).slice(0, CHOICE_COUNT - 1);
  if (distractors.length === 0) return [];

  return shuffleArray([hiddenVerse, ...distractors]).map((item) => ({
    id: toVerseKey(item),
    label: buildSearchLabel(item),
  }));
}

export function generateFillBlankQuestion(
  verse: MushafVerse,
  pool: MushafVerse[],
  mushafData: MushafVerse[],
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

  // What the page shows around the blank, so the options do not repeat it.
  const visibleKeys = new Set(
    [previous, verse, next]
      .filter((item): item is MushafVerse => Boolean(item))
      .map(toVerseKey),
  );

  return {
    id: createQuestionId(),
    type: "fill_blank",
    verse,
    verseKey: toVerseKey(verse),
    testedVerseKey: toVerseKey(hiddenVerse),
    hiddenVerse,
    hiddenVerseKey: toVerseKey(hiddenVerse),
    page: hiddenVerse.page,
    choices: buildChoices(options, hiddenVerse, visibleKeys),
    searchOptions: shuffleArray(
      options.map((item) => ({
        id: toVerseKey(item),
        label: buildSearchLabel(item),
      })),
    ),
  };
}
