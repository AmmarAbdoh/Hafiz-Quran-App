import type { MushafWordLayoutData } from "@/shared/types/quran";

export function findPageForVerse(
  wordLayout: MushafWordLayoutData,
  verseKey: string,
): number | null {
  for (const page of wordLayout.pages) {
    for (const line of page.lines) {
      if (line.words.some((word) => word.verse_key === verseKey)) {
        return page.page;
      }
    }
  }
  return null;
}

export function formatPlaybackTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
