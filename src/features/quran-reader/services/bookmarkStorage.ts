import { SURAH_AYAH_COUNTS } from "@/domain/quran/audio/reciters";
import { safeStorage, STORAGE_KEYS } from "@/shared/storage";

const SCHEMA_VERSION = 1 as const;
const VERSE_KEY_RE = /^(\d{1,3}):(\d{1,3})$/;

interface BookmarksStore {
  schemaVersion: typeof SCHEMA_VERSION;
  keys: string[];
}

function isBookmarksStore(value: unknown): value is BookmarksStore {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(record.keys) &&
    record.keys.every(
      (key) => typeof key === "string" && VERSE_KEY_RE.test(key),
    )
  );
}

function normalizeVerseKey(verseKey: string): string | null {
  const match = VERSE_KEY_RE.exec(verseKey.trim());
  if (!match) return null;
  const surah = Number(match[1]);
  const ayah = Number(match[2]);
  if (surah < 1 || surah > 114) return null;
  const ayahCount = SURAH_AYAH_COUNTS[surah - 1] ?? 0;
  if (ayah < 1 || ayah > ayahCount) return null;
  return `${surah}:${ayah}`;
}

function readStore(): BookmarksStore {
  const raw = safeStorage.getItem(STORAGE_KEYS.bookmarks);
  if (!raw) return { schemaVersion: SCHEMA_VERSION, keys: [] };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isBookmarksStore(parsed)) {
      return { schemaVersion: SCHEMA_VERSION, keys: [] };
    }
    return parsed;
  } catch {
    return { schemaVersion: SCHEMA_VERSION, keys: [] };
  }
}

function writeStore(keys: string[]): void {
  const payload: BookmarksStore = { schemaVersion: SCHEMA_VERSION, keys };
  safeStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(payload));
}

export function listBookmarks(): string[] {
  return [...readStore().keys];
}

export function isBookmarked(verseKey: string): boolean {
  const normalized = normalizeVerseKey(verseKey);
  if (!normalized) return false;
  return readStore().keys.includes(normalized);
}

export function saveBookmark(verseKey: string): boolean {
  const normalized = normalizeVerseKey(verseKey);
  if (!normalized) return false;

  const store = readStore();
  if (store.keys.includes(normalized)) return true;

  writeStore([normalized, ...store.keys]);
  return true;
}

export function removeBookmark(verseKey: string): boolean {
  const normalized = normalizeVerseKey(verseKey);
  if (!normalized) return false;

  const nextKeys = readStore().keys.filter((key) => key !== normalized);
  writeStore(nextKeys);
  return true;
}
