import type { MushafWord } from "@/shared/types/quran";

export type VerseSelectionMode = "word" | "ayah";

export interface VerseSelection {
  verseKey: string;
  mode: VerseSelectionMode;
  word: MushafWord;
}
