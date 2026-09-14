import { useSyncExternalStore } from "react";
import {
  getResumeReaderPath,
  loadReaderPosition,
  subscribeReaderPosition,
} from "@/features/quran-reader/services/readerPositionStorage";

export function useResumeReaderPath(): string {
  return useSyncExternalStore(
    subscribeReaderPosition,
    getResumeReaderPath,
    getResumeReaderPath,
  );
}

export function useReaderPositionSnapshot() {
  return useSyncExternalStore(
    subscribeReaderPosition,
    loadReaderPosition,
    () => null,
  );
}
