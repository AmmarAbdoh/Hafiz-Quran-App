import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_TAFSEER_ID,
  TAFSEER_OPTIONS,
} from "@/shared/constants/quran";

const STORAGE_KEY = "quran-tafseer-id";

function resolveTafseerId(stored: string | null): string {
  if (stored && stored in TAFSEER_OPTIONS) return stored;
  return DEFAULT_TAFSEER_ID;
}

export function useTafseer() {
  const [tafseerId, setTafseerIdState] = useState(() =>
    resolveTafseerId(localStorage.getItem(STORAGE_KEY)),
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, tafseerId);
  }, [tafseerId]);

  const setTafseerId = useCallback((id: string) => {
    if (id in TAFSEER_OPTIONS) {
      setTafseerIdState(id);
    }
  }, []);

  return { tafseerId, setTafseerId };
}
