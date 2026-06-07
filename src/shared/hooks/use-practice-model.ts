import { useCallback, useEffect, useState } from "react";
import {
  migratePracticeModelId,
  PRACTICE_MODEL_OPTIONS,
  PRACTICE_MODEL_STORAGE_KEY,
} from "@/shared/constants/recitation-practice";

export function usePracticeModel() {
  const [modelId, setModelIdState] = useState(() => {
    const migrated = migratePracticeModelId(
      localStorage.getItem(PRACTICE_MODEL_STORAGE_KEY),
    );
    if (migrated !== localStorage.getItem(PRACTICE_MODEL_STORAGE_KEY)) {
      localStorage.setItem(PRACTICE_MODEL_STORAGE_KEY, migrated);
    }
    return migrated;
  });

  useEffect(() => {
    localStorage.setItem(PRACTICE_MODEL_STORAGE_KEY, modelId);
  }, [modelId]);

  const setModelId = useCallback((id: string) => {
    if (id in PRACTICE_MODEL_OPTIONS) {
      setModelIdState(id);
    }
  }, []);

  return { modelId, setModelId };
}


