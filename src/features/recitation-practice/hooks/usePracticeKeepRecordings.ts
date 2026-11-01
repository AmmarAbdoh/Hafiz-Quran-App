import { useSyncExternalStore } from "react";
import { PRACTICE_KEEP_RECORDINGS_STORAGE_KEY } from "@/features/recitation-practice/model/practiceConfig";
import { createStoredPreference, safeStorage } from "@/shared/storage";

/**
 * Whether each finished run is kept on this device to listen back to.
 *
 * On unless turned off: listening back is how a reader checks a word the
 * verdict listed, and the recordings never leave the device. A stored
 * preference for the same reason as strict mode - the switch is in
 * Settings, and the run that reads it is in the reader.
 */
export function readKeepRecordingsPreference(): boolean {
  return safeStorage.getItem(PRACTICE_KEEP_RECORDINGS_STORAGE_KEY) !== "false";
}

const store = createStoredPreference(readKeepRecordingsPreference, (keep) =>
  safeStorage.setItem(PRACTICE_KEEP_RECORDINGS_STORAGE_KEY, String(keep)),
);

export function usePracticeKeepRecordings() {
  const keepRecordings = useSyncExternalStore(store.subscribe, store.snapshot);
  return { keepRecordings, setKeepRecordings: store.set };
}
