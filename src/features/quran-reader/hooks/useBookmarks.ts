import { useCallback, useSyncExternalStore } from "react";
import {
  isBookmarked as readIsBookmarked,
  listBookmarks,
  removeBookmark,
  saveBookmark,
} from "@/features/quran-reader/services/bookmarkStorage";
import { STORAGE_KEYS } from "@/shared/storage";

let currentBookmarks = listBookmarks();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): readonly string[] {
  return currentBookmarks;
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function refreshBookmarks(): void {
  currentBookmarks = listBookmarks();
  notifyListeners();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === STORAGE_KEYS.bookmarks) {
      refreshBookmarks();
    }
  });
}

export function useBookmarks() {
  const bookmarks = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => [] as readonly string[],
  );

  const toggleBookmark = useCallback((verseKey: string) => {
    if (readIsBookmarked(verseKey)) {
      removeBookmark(verseKey);
    } else {
      saveBookmark(verseKey);
    }
    refreshBookmarks();
  }, []);

  const bookmarkedSet = new Set(bookmarks);

  return {
    bookmarks,
    bookmarkedSet,
    isBookmarked: (verseKey: string) => bookmarkedSet.has(verseKey),
    toggleBookmark,
    refresh: refreshBookmarks,
  };
}
