import { useEffect, useState } from "react";
import {
  migratePracticeModelId,
  PRACTICE_MODEL_OPTIONS,
  PRACTICE_MODEL_STORAGE_KEY,
} from "@/features/recitation-practice/model/practiceConfig";
import { safeStorage } from "@/shared/storage";

export function readPracticeModelPreference(): string {
  const stored = safeStorage.getItem(PRACTICE_MODEL_STORAGE_KEY);
  const migrated = migratePracticeModelId(stored);
  if (migrated !== stored) {
    safeStorage.setItem(PRACTICE_MODEL_STORAGE_KEY, migrated);
  }
  return migrated;
}

export function usePracticeModel() {
  const [modelId, setModelIdState] = useState(readPracticeModelPreference);

  useEffect(() => {
    safeStorage.setItem(PRACTICE_MODEL_STORAGE_KEY, modelId);
  }, [modelId]);

  const setModelId = (id: string) => {
    if (id in PRACTICE_MODEL_OPTIONS) {
      setModelIdState(id);
    }
  };

  return { modelId, setModelId };
}
