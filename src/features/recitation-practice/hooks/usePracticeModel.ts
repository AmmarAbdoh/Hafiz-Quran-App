import { useSyncExternalStore } from "react";
import {
  migratePracticeModelId,
  PRACTICE_MODEL_OPTIONS,
  PRACTICE_MODEL_STORAGE_KEY,
} from "@/features/recitation-practice/model/practiceConfig";
import { createStoredPreference, safeStorage } from "@/shared/storage";

export function readPracticeModelPreference(): string {
  const stored = safeStorage.getItem(PRACTICE_MODEL_STORAGE_KEY);
  const migrated = migratePracticeModelId(stored);
  if (migrated !== stored) {
    safeStorage.setItem(PRACTICE_MODEL_STORAGE_KEY, migrated);
  }
  return migrated;
}

/*
 * One owner for the chosen model, shared by everything that reads it.
 *
 * With `useState` each caller kept its own copy: the picker and the privacy
 * disclosure beside it on the same page disagreed the moment the model was
 * changed, so the disclosure went on naming the host of a model that was no
 * longer selected - which is the one thing on that list that has to be true.
 */
const store = createStoredPreference(readPracticeModelPreference, (id) =>
  safeStorage.setItem(PRACTICE_MODEL_STORAGE_KEY, id),
);

export function usePracticeModel() {
  const modelId = useSyncExternalStore(store.subscribe, store.snapshot);

  /* An id nothing offers is not a choice: it would store a model the picker
     cannot show and the loader cannot fetch. */
  const setModelId = (id: string) => {
    if (id in PRACTICE_MODEL_OPTIONS) store.set(id);
  };

  return { modelId, setModelId };
}
