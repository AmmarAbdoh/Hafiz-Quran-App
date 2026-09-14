import { safeStorage, STORAGE_KEYS } from "@/shared/storage";

const SCHEMA_VERSION = 1 as const;
const MAX_RECENTS = 10;

export interface ReaderRecentEntry {
  schemaVersion: typeof SCHEMA_VERSION;
  path: string;
  label: string;
  surah?: number;
  ayah?: number;
  page?: number;
  visitedAt: number;
}

function isReaderRecentEntry(value: unknown): value is ReaderRecentEntry {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === SCHEMA_VERSION &&
    typeof record.path === "string" &&
    record.path.startsWith("/") &&
    typeof record.label === "string" &&
    typeof record.visitedAt === "number"
  );
}

function readRecents(): ReaderRecentEntry[] {
  const raw = safeStorage.getItem(STORAGE_KEYS.readerRecents);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isReaderRecentEntry).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function writeRecents(entries: ReaderRecentEntry[]): void {
  safeStorage.setItem(
    STORAGE_KEYS.readerRecents,
    JSON.stringify(entries.slice(0, MAX_RECENTS)),
  );
}

export function loadReaderRecents(): ReaderRecentEntry[] {
  return readRecents();
}

export function recordReaderRecent(
  entry: Omit<ReaderRecentEntry, "schemaVersion" | "visitedAt">,
): ReaderRecentEntry[] {
  const nextEntry: ReaderRecentEntry = {
    schemaVersion: SCHEMA_VERSION,
    ...entry,
    visitedAt: Date.now(),
  };

  const deduped = readRecents().filter(
    (recent) => recent.path !== nextEntry.path,
  );
  const next = [nextEntry, ...deduped].slice(0, MAX_RECENTS);
  writeRecents(next);
  return next;
}
