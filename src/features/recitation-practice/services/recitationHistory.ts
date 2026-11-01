import type {
  MisreadWord,
  RecitedMoment,
} from "@/features/recitation-practice/contract";
import { safeStorage } from "@/shared/storage";

/*
 * Recitations kept on this device, so a reader can listen back to them.
 *
 * The same arrangement as recitation kept for offline listening
 * (`audioDownloads.ts` in the reader): the audio in the Cache API, where a
 * few megabytes a run is unremarkable, and a small index beside it in local
 * storage, where reading the list does not mean opening every recording.
 * Played back as a blob URL, which seeks natively.
 *
 * Nothing here leaves the device. The recording is the reader's own voice,
 * so it is kept only while they ask for it to be (see
 * `usePracticeKeepRecordings`), and only the most recent are kept at all.
 */
const RECORDINGS_CACHE = "artqiy-recitations";
/* Versioned: the shape of an entry is persisted, so a later change to it
   comes with a migration rather than a list that silently fails to parse. */
const INDEX_KEY = "artqiy.recitations.v1";
/** The synthetic URL each recording is stored under. */
const AUDIO_PATH = "/__artqiy/recitations/";

/**
 * How many recordings are kept; saving another removes the oldest.
 *
 * A minute is about 1.9MB, so twenty page-length runs is tens of megabytes,
 * not hundreds - small enough to keep without asking, and stated where the
 * list is shown so nobody is surprised when the oldest goes.
 */
export const KEEP_RECITATIONS = 20;

export interface SavedRecitation {
  id: string;
  recordedAt: string;
  /** The first and last ayah recited, as `surah:ayah`. */
  from: string;
  to: string;
  seconds: number;
  bytes: number;
  progressIndex: number;
  totalWords: number;
  stoppedShort: boolean;
  /** The words the verdict listed, and where in the audio each was said. */
  words: (MisreadWord & { moment: RecitedMoment | null })[];
}

function isSavedRecitation(value: unknown): value is SavedRecitation {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<SavedRecitation>;
  return (
    typeof entry.id === "string" &&
    typeof entry.recordedAt === "string" &&
    typeof entry.from === "string" &&
    typeof entry.to === "string" &&
    typeof entry.seconds === "number" &&
    Array.isArray(entry.words)
  );
}

function readIndex(): SavedRecitation[] {
  const raw = safeStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSavedRecitation) : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: SavedRecitation[]): void {
  safeStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

async function openCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(RECORDINGS_CACHE);
  } catch {
    return null;
  }
}

/** Newest first. */
export function listRecitations(): SavedRecitation[] {
  return readIndex().sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

/**
 * Keep a recitation, and let the oldest go once there are too many.
 *
 * The audio is written before the index, so a failure part way leaves an
 * unlisted file rather than a listed recording with nothing behind it.
 */
export async function saveRecitation(
  entry: SavedRecitation,
  wav: Blob,
): Promise<void> {
  const cache = await openCache();
  if (!cache) throw new Error("Cache storage is unavailable");
  await cache.put(
    AUDIO_PATH + entry.id,
    new Response(wav, { headers: { "content-type": "audio/wav" } }),
  );
  const entries = [
    entry,
    ...listRecitations().filter((e) => e.id !== entry.id),
  ];
  const kept = entries.slice(0, KEEP_RECITATIONS);
  writeIndex(kept);
  await Promise.all(
    entries
      .slice(KEEP_RECITATIONS)
      .map((old) => cache.delete(AUDIO_PATH + old.id)),
  );
}

/** The recording's audio, or null when the browser no longer has it. */
export async function recitationAudio(id: string): Promise<Blob | null> {
  const cache = await openCache();
  const response = await cache?.match(AUDIO_PATH + id);
  return response ? await response.blob() : null;
}

export async function deleteRecitation(id: string): Promise<void> {
  writeIndex(readIndex().filter((entry) => entry.id !== id));
  const cache = await openCache();
  await cache?.delete(AUDIO_PATH + id);
}

export async function deleteAllRecitations(): Promise<void> {
  writeIndex([]);
  if (typeof caches === "undefined") return;
  try {
    await caches.delete(RECORDINGS_CACHE);
  } catch {
    /* The list is already empty, which is what the reader asked for. */
  }
}
