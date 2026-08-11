import { useSyncExternalStore } from "react";
import { DEFAULT_TAFSEER_ID, TAFSEER_OPTIONS } from "../model/constants";
import { safeStorage, STORAGE_KEYS } from "@/shared/storage";

function resolveTafseerId(stored: string | null): string {
  if (stored && stored in TAFSEER_OPTIONS) return stored;
  return DEFAULT_TAFSEER_ID;
}

let currentTafseerId = resolveTafseerId(
  safeStorage.getItem(STORAGE_KEYS.tafseer),
);
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string {
  return currentTafseerId;
}

function setTafseerId(id: string): void {
  if (!(id in TAFSEER_OPTIONS) || id === currentTafseerId) return;
  currentTafseerId = id;
  safeStorage.setItem(STORAGE_KEYS.tafseer, id);
  listeners.forEach((listener) => listener());
}

export function useTafseer() {
  const tafseerId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => DEFAULT_TAFSEER_ID,
  );

  return { tafseerId, setTafseerId };
}
