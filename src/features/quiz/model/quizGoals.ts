import { getPresetQuestionTypes } from "./questionTypes";
import { describeScopeCoverage } from "./scopeCoverage";
import type { QuizConfig, QuizScope } from "./types";
import { buildVersePool } from "./versePool";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";

/**
 * What a learner actually wants when they open the quiz. The engine has always
 * taken a QuizConfig and nothing else, so each of these is just a config -
 * nothing about how questions are generated changes.
 */
export type QuizGoalId = "today" | "weak" | "surah" | "manual";

/** Where the reader was left, as the quiz needs it. */
export interface ReadingPosition {
  layout: "page" | "surah";
  page: number;
  surah: number;
}

export interface WeakVerse {
  verseKey: string;
  missed: number;
}

const DEFAULT_QUESTION_COUNT = 10;

function surahOf(verseKey: string): number | null {
  const surah = Number(verseKey.split(":")[0]);
  return Number.isInteger(surah) && surah >= 1 && surah <= 114 ? surah : null;
}

/**
 * Question types are never asked for by a goal. describeScopeCoverage already
 * knows which types a given scope can support - a single surah cannot ask
 * which surah an ayah is from - so the goal states the scope and the coverage
 * decides the questions.
 */
function typesForScope(
  scope: QuizScope,
  mushafData: MushafVerse[],
  verseInfoRecords: VerseInfoRecord[],
): QuizConfig["questionTypes"] {
  const pool = buildVersePool(mushafData, scope);
  return getPresetQuestionTypes(
    "standard",
    describeScopeCoverage(pool, verseInfoRecords),
  );
}

function configFor(
  scope: QuizScope,
  mushafData: MushafVerse[],
  verseInfoRecords: VerseInfoRecord[],
  extra: Partial<QuizConfig> = {},
): QuizConfig {
  return {
    scope,
    questionTypes: typesForScope(scope, mushafData, verseInfoRecords),
    sessionMode: "fixed",
    questionCount: DEFAULT_QUESTION_COUNT,
    ...extra,
  };
}

/** The page or surah last read, so "review today" means what was read today. */
function scopeForReadingPosition(position: ReadingPosition | null): QuizScope {
  if (!position) return { mode: "surah", surahIndices: [1] };
  return position.layout === "page"
    ? { mode: "page", pageFrom: position.page, pageTo: position.page }
    : { mode: "surah", surahIndices: [position.surah] };
}

export function buildReviewTodayConfig(
  position: ReadingPosition | null,
  mushafData: MushafVerse[],
  verseInfoRecords: VerseInfoRecord[],
): QuizConfig {
  return configFor(
    scopeForReadingPosition(position),
    mushafData,
    verseInfoRecords,
  );
}

/**
 * Drilling misses asks only about the missed ayahs but has to draw its wrong
 * options from somewhere, so the scope is every surah they fall in while
 * focusVerseKeys narrows what is actually asked.
 */
export function buildWeakVersesConfig(
  weakVerses: readonly WeakVerse[],
  mushafData: MushafVerse[],
  verseInfoRecords: VerseInfoRecord[],
): QuizConfig | null {
  const verseKeys = weakVerses.map((verse) => verse.verseKey);
  const surahIndices = [...new Set(verseKeys.map(surahOf))].filter(
    (surah): surah is number => surah !== null,
  );
  if (surahIndices.length === 0) return null;

  return configFor(
    { mode: "surah", surahIndices },
    mushafData,
    verseInfoRecords,
    {
      questionCount: Math.max(verseKeys.length, 1),
      focusVerseKeys: verseKeys,
    },
  );
}

export function buildSurahConfig(
  surahNumber: number,
  mushafData: MushafVerse[],
  verseInfoRecords: VerseInfoRecord[],
): QuizConfig {
  return configFor(
    { mode: "surah", surahIndices: [surahNumber] },
    mushafData,
    verseInfoRecords,
  );
}
