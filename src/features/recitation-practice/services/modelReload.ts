/*
 * "Remove the downloaded models" has to reach the streaming model too.
 *
 * The Whisper models live in a Cache Storage bucket, which
 * `clearWhisperModelCache` can simply delete. The streaming recogniser is
 * fetched with a plain `fetch`, so its copy is the browser's own HTTP cache -
 * nothing in the page can evict that. What the page can do is ask for the
 * next fetch to go past it, which is what `cache: "reload"` does.
 *
 * Settings and the reader are different features and share no state, so the
 * request is left where the next run will find it. It survives a reload,
 * which is the point: the reader may not be mounted when the button is
 * pressed, and the page may not be open again for days.
 */
import { safeStorage } from "@/shared/storage";

const RELOAD_REQUESTED_KEY = "quran-practice-model-reload";

/**
 * Ask for the next model load to bypass the browser's cached copy.
 *
 * Through `safeStorage`, which already answers for private mode and for
 * storage that refuses to write: the old copy is then kept, which is worse
 * than a fresh one but not broken.
 */
export function requestModelReload(): void {
  safeStorage.setItem(RELOAD_REQUESTED_KEY, "1");
}

/**
 * Whether to bypass the cache this time, clearing the request.
 *
 * Consumed rather than read, so one press re-downloads once instead of
 * making every load from here on skip the cache.
 */
export function takeModelReload(): boolean {
  if (safeStorage.getItem(RELOAD_REQUESTED_KEY) === null) return false;
  safeStorage.removeItem(RELOAD_REQUESTED_KEY);
  return true;
}
