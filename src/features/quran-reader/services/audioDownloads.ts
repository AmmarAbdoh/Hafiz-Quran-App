import {
  SURAH_AYAH_COUNTS,
  getAyahAudioUrl,
  type ReciterOption,
} from "@/domain/quran";
import { safeStorage } from "@/shared/storage";

/*
 * Recitation kept for offline listening.
 *
 * Both audio hosts answer with `Access-Control-Allow-Origin: *`, so the
 * responses are CORS rather than opaque and the Cache API stores them at
 * their true size. An opaque response is padded - Chrome charges several
 * megabytes for each one - which for six thousand small files would have
 * made this impossible.
 *
 * Playback reads them back as a blob URL rather than through the service
 * worker. `<audio>` seeks with range requests and the worker steps aside for
 * those, so serving from the worker would mean reimplementing range slicing;
 * a blob URL supports seeking natively and works the same in development,
 * where there is no worker at all.
 */
const AUDIO_CACHE = "artqiy-audio";

/**
 * For "this will use about…" before anything is fetched.
 *
 * Measured: one 5.13s ayah at 128kbps is 82,164 bytes, so roughly 16KB a
 * second. Real ayat vary enormously in length, so this is only ever shown as
 * an approximation; the true size is recorded once a download finishes.
 */
const ESTIMATED_AYAH_BYTES = 85_000;

export interface SurahDownload {
  reciterId: string;
  surah: number;
  /** Files actually stored, which is the surah's ayah count when complete. */
  files: number;
  bytes: number;
  completedAt: string;
}

export interface DownloadProgress {
  done: number;
  total: number;
  bytes: number;
}

type DownloadIndex = Record<string, SurahDownload>;

const INDEX_KEY = "artqiy.audio.downloads";
/** Enough to saturate a connection without burying the player's own requests. */
const CONCURRENCY = 6;

function indexKey(reciterId: string, surah: number): string {
  return `${reciterId}:${surah}`;
}

function readIndex(): DownloadIndex {
  const raw = safeStorage.getItem(INDEX_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as DownloadIndex)
      : {};
  } catch {
    return {};
  }
}

function writeIndex(index: DownloadIndex): void {
  safeStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function ayahCount(surah: number): number {
  return SURAH_AYAH_COUNTS[surah - 1] ?? 0;
}

export function estimateSurahBytes(surah: number): number {
  return ayahCount(surah) * ESTIMATED_AYAH_BYTES;
}

export function estimateQuranBytes(): number {
  return (
    SURAH_AYAH_COUNTS.reduce((sum, count) => sum + count, 0) *
    ESTIMATED_AYAH_BYTES
  );
}

export function surahAudioUrls(
  reciter: ReciterOption,
  surah: number,
): string[] {
  const urls: string[] = [];
  for (let ayah = 1; ayah <= ayahCount(surah); ayah += 1) {
    urls.push(getAyahAudioUrl(reciter, surah, ayah));
  }
  return urls;
}

export function listDownloads(): SurahDownload[] {
  return Object.values(readIndex());
}

export function getDownload(
  reciterId: string,
  surah: number,
): SurahDownload | null {
  return readIndex()[indexKey(reciterId, surah)] ?? null;
}

export function downloadedBytes(reciterId?: string): number {
  return listDownloads()
    .filter((entry) => !reciterId || entry.reciterId === reciterId)
    .reduce((sum, entry) => sum + entry.bytes, 0);
}

async function openCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(AUDIO_CACHE);
  } catch {
    return null;
  }
}

/**
 * Fetches what is missing, leaving what is already stored alone.
 *
 * Partial progress survives a cancelled or failed run: the files already in
 * the cache are not fetched again, so resuming costs only what is left.
 */
export async function downloadSurah(
  reciter: ReciterOption,
  surah: number,
  options: {
    onProgress?: (progress: DownloadProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<SurahDownload> {
  const cache = await openCache();
  if (!cache) throw new Error("Cache storage is unavailable");

  const urls = surahAudioUrls(reciter, surah);
  const total = urls.length;
  let done = 0;
  let bytes = 0;

  const report = () => options.onProgress?.({ done, total, bytes });
  report();

  const queue = [...urls];
  const worker = async () => {
    for (;;) {
      if (options.signal?.aborted)
        throw new DOMException("Aborted", "AbortError");
      const url = queue.shift();
      if (!url) return;

      const existing = await cache.match(url);
      if (existing) {
        bytes += (await existing.clone().blob()).size;
        done += 1;
        report();
        continue;
      }

      const response = await fetch(url, { signal: options.signal });
      if (!response.ok) {
        throw new Error(`${response.status} for ${url}`);
      }
      // Read the size before the body is consumed by the cache.
      const body = await response.clone().blob();
      await cache.put(url, response);
      bytes += body.size;
      done += 1;
      report();
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()),
  );

  const entry: SurahDownload = {
    reciterId: reciter.id,
    surah,
    files: done,
    bytes,
    completedAt: new Date().toISOString(),
  };
  const index = readIndex();
  index[indexKey(reciter.id, surah)] = entry;
  writeIndex(index);
  return entry;
}

export async function deleteSurah(
  reciter: ReciterOption,
  surah: number,
): Promise<void> {
  const cache = await openCache();
  if (cache) {
    await Promise.all(
      surahAudioUrls(reciter, surah).map((url) => cache.delete(url)),
    );
  }
  const index = readIndex();
  delete index[indexKey(reciter.id, surah)];
  writeIndex(index);
}

export async function deleteAllForReciter(
  reciter: ReciterOption,
): Promise<void> {
  const index = readIndex();
  const surahs = Object.values(index)
    .filter((entry) => entry.reciterId === reciter.id)
    .map((entry) => entry.surah);
  for (const surah of surahs) {
    await deleteSurah(reciter, surah);
  }
}

/**
 * A playable URL for audio already stored, or null to go to the network.
 *
 * The caller owns the returned URL and must revoke it once the audio has
 * moved on, or every ayah played leaks its own blob.
 */
export async function cachedAudioUrl(url: string): Promise<string | null> {
  const cache = await openCache();
  if (!cache) return null;
  try {
    const hit = await cache.match(url);
    if (!hit) return null;
    return URL.createObjectURL(await hit.blob());
  } catch {
    return null;
  }
}

export async function storageEstimate(): Promise<{
  usedBytes: number;
  quotaBytes: number;
} | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return null;
  }
  try {
    const estimate = await navigator.storage.estimate();
    return {
      usedBytes: estimate.usage ?? 0,
      quotaBytes: estimate.quota ?? 0,
    };
  } catch {
    return null;
  }
}
