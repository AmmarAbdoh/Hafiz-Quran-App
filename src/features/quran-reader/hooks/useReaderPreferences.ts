import { useCallback, useState } from "react";
import { safeStorage, STORAGE_KEYS } from "@/shared/storage";
import {
  DEFAULT_MUSHAF_SCALE,
  normalizeMushafScale,
  type MushafScale,
} from "@/features/quran-reader/model/mushafScale";
import { useTajweedColored } from "./useTajweedColored";

function readBooleanPreference(key: string): boolean {
  return safeStorage.getItem(key) === "true";
}

function readMushafScale(): MushafScale {
  const raw = safeStorage.getItem(STORAGE_KEYS.mushafScale);
  if (!raw) return DEFAULT_MUSHAF_SCALE;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_MUSHAF_SCALE;
  return normalizeMushafScale(parsed);
}

export function useReaderPreferences() {
  const { tajweedColored, setTajweedColored } = useTajweedColored();
  const [mushafScale, setMushafScale] = useState<MushafScale>(() =>
    readMushafScale(),
  );
  const [mushafWarmth, setMushafWarmth] = useState(() =>
    readBooleanPreference(STORAGE_KEYS.mushafWarmth),
  );

  const changeTajweedColored = useCallback(
    (value: boolean) => {
      setTajweedColored(value);
    },
    [setTajweedColored],
  );

  const changeMushafScale = useCallback((scale: MushafScale) => {
    setMushafScale(scale);
    safeStorage.setItem(STORAGE_KEYS.mushafScale, String(scale));
  }, []);

  const changeMushafWarmth = useCallback((value: boolean) => {
    setMushafWarmth(value);
    safeStorage.setItem(STORAGE_KEYS.mushafWarmth, String(value));
  }, []);

  return {
    tajweedColored,
    mushafScale,
    mushafWarmth,
    changeTajweedColored,
    changeMushafScale,
    changeMushafWarmth,
  };
}
