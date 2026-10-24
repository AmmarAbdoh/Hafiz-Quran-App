import { useSyncExternalStore } from "react";
import { PRACTICE_STRICT_STORAGE_KEY } from "@/features/recitation-practice/model/practiceConfig";
import { createStoredPreference, safeStorage } from "@/shared/storage";

/**
 * Whether to mark every weak word instead of forgiving one an ayah.
 *
 * A stored preference rather than runtime state, because the control for it
 * is in Settings and the run that reads it is in the reader - two trees, and
 * only one of them is inside `RecitationPracticeProvider`. The verdict reads
 * this at the moment it judges, so changing it takes effect on the next run
 * without anything having to be told.
 *
 * Off by default: measured over 3,595 clips it accuses one correct
 * recitation in sixteen. See `STRICT_WEAK_WORDS_TOLERATED`.
 */
export function readPracticeStrictPreference(): boolean {
  return safeStorage.getItem(PRACTICE_STRICT_STORAGE_KEY) === "true";
}

const store = createStoredPreference(readPracticeStrictPreference, (strict) =>
  safeStorage.setItem(PRACTICE_STRICT_STORAGE_KEY, String(strict)),
);

export function usePracticeStrictMode() {
  const strictMode = useSyncExternalStore(store.subscribe, store.snapshot);
  return { strictMode, setStrictMode: store.set };
}
