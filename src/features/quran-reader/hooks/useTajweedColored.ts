import { useSyncExternalStore } from "react";
import { safeStorage, STORAGE_KEYS } from "@/shared/storage";

function readTajweedColored(): boolean {
  return safeStorage.getItem(STORAGE_KEYS.mushafTajweedColored) === "true";
}

let currentTajweedColored = readTajweedColored();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return currentTajweedColored;
}

function setTajweedColored(value: boolean): void {
  if (value === currentTajweedColored) return;
  currentTajweedColored = value;
  safeStorage.setItem(STORAGE_KEYS.mushafTajweedColored, String(value));
  listeners.forEach((listener) => listener());
}

export function useTajweedColored() {
  const tajweedColored = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => false,
  );

  return { tajweedColored, setTajweedColored };
}
