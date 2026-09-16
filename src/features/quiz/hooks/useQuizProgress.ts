import { useSyncExternalStore } from "react";
import { summarizeQuizProgress, type QuizProgress } from "../model/quizSession";
import {
  QUIZ_HISTORY_STORAGE_KEY,
  loadQuizHistory,
} from "../services/quizHistoryStorage";

const EMPTY: QuizProgress = {
  sessions: 0,
  streakDays: 0,
  recentAccuracy: null,
  weakVerseCount: 0,
};

let cachedRaw: string | null = null;
let cached: QuizProgress = EMPTY;

function subscribe(onChange: () => void) {
  // Another tab finishing a quiz should move the streak here too.
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getSnapshot(): QuizProgress {
  const raw = window.localStorage.getItem(QUIZ_HISTORY_STORAGE_KEY);
  /*
   * useSyncExternalStore re-renders whenever the snapshot is not identical to
   * the last one, so this cannot summarize on every call - it would return a
   * new object each time and never settle. The stored string is what actually
   * changes, so it decides when the summary is rebuilt.
   */
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = summarizeQuizProgress(loadQuizHistory());
  }
  return cached;
}

function getServerSnapshot(): QuizProgress {
  return EMPTY;
}

/** What the learner has to show for their reviews: streak, accuracy, backlog. */
export function useQuizProgress(): QuizProgress {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
