import { safeStorage, STORAGE_KEYS } from "@/shared/storage";
import type { MushafLayoutMode } from "@/features/quran-reader/model/quranReaderRoutes";
import {
  buildQuranAyahPath,
  buildQuranReaderPath,
  buildQuranSurahPath,
  clampPage,
  clampSurah,
} from "@/features/quran-reader/model/quranReaderRoutes";
import { TOTAL_MUSHAF_PAGES } from "@/domain/quran";

const SCHEMA_VERSION = 1 as const;
const listeners = new Set<() => void>();

export interface ReaderPosition {
  schemaVersion: typeof SCHEMA_VERSION;
  layout: MushafLayoutMode;
  page: number;
  surah: number;
  ayah?: number;
  scrollRatio?: number;
  updatedAt: number;
}

function isReaderPosition(value: unknown): value is ReaderPosition {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === SCHEMA_VERSION &&
    (record.layout === "page" || record.layout === "surah") &&
    typeof record.page === "number" &&
    typeof record.surah === "number" &&
    typeof record.updatedAt === "number"
  );
}

function migrateReaderPosition(value: unknown): ReaderPosition | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    (record.layout === "page" || record.layout === "surah") &&
    typeof record.page === "number" &&
    typeof record.surah === "number"
  ) {
    return {
      schemaVersion: SCHEMA_VERSION,
      layout: record.layout,
      page: clampPage(record.page, TOTAL_MUSHAF_PAGES),
      surah: clampSurah(record.surah),
      ayah: typeof record.ayah === "number" ? record.ayah : undefined,
      scrollRatio:
        typeof record.scrollRatio === "number" ? record.scrollRatio : undefined,
      updatedAt:
        typeof record.updatedAt === "number" ? record.updatedAt : Date.now(),
    };
  }
  return null;
}

export function subscribeReaderPosition(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyReaderPositionListeners(): void {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === STORAGE_KEYS.readerPosition) {
      notifyReaderPositionListeners();
    }
  });
}

function parseReaderPosition(raw: string): ReaderPosition | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isReaderPosition(parsed)) {
      return {
        ...parsed,
        page: clampPage(parsed.page, TOTAL_MUSHAF_PAGES),
        surah: clampSurah(parsed.surah),
      };
    }
    return migrateReaderPosition(parsed);
  } catch {
    return null;
  }
}

/**
 * `useSyncExternalStore` compares snapshots by identity, so parsing on every
 * read would report a change on every render and never settle.
 */
let cachedRaw: string | null = null;
let cachedPosition: ReaderPosition | null = null;

export function loadReaderPosition(): ReaderPosition | null {
  const raw = safeStorage.getItem(STORAGE_KEYS.readerPosition);
  if (raw === cachedRaw) return cachedPosition;

  cachedRaw = raw;
  cachedPosition = raw ? parseReaderPosition(raw) : null;
  return cachedPosition;
}

export function saveReaderPosition(
  position: Omit<ReaderPosition, "schemaVersion" | "updatedAt">,
): void {
  const existing = loadReaderPosition();
  let scrollRatio = position.scrollRatio;
  if (
    scrollRatio === undefined &&
    position.layout === "surah" &&
    existing?.layout === "surah" &&
    existing.surah === position.surah
  ) {
    scrollRatio = existing.scrollRatio;
  }
  if (position.layout !== "surah") {
    scrollRatio = undefined;
  }

  const payload: ReaderPosition = {
    schemaVersion: SCHEMA_VERSION,
    ...position,
    scrollRatio,
    page: clampPage(position.page, TOTAL_MUSHAF_PAGES),
    surah: clampSurah(position.surah),
    updatedAt: Date.now(),
  };
  safeStorage.setItem(STORAGE_KEYS.readerPosition, JSON.stringify(payload));
  notifyReaderPositionListeners();
}

export function getResumeReaderPath(): string {
  const saved = loadReaderPosition();
  if (!saved) return buildQuranReaderPath(1);

  if (saved.layout === "surah") {
    if (saved.ayah) return buildQuranAyahPath(saved.surah, saved.ayah);
    return buildQuranSurahPath(saved.surah);
  }

  return buildQuranReaderPath(saved.page);
}
