import { useSyncExternalStore } from "react";
import {
  createStoredPreference,
  safeStorage,
  STORAGE_KEYS,
} from "@/shared/storage";

const store = createStoredPreference(
  () => safeStorage.getItem(STORAGE_KEYS.mushafTajweedColored) === "true",
  (coloured) =>
    safeStorage.setItem(STORAGE_KEYS.mushafTajweedColored, String(coloured)),
);

export function useTajweedColored() {
  const tajweedColored = useSyncExternalStore(store.subscribe, store.snapshot);
  return { tajweedColored, setTajweedColored: store.set };
}
