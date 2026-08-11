import type { MushafWord } from "@/domain/quran";

type VerseSelectionMode = "word" | "ayah";

export interface VerseSelection {
  verseKey: string;
  mode: VerseSelectionMode;
  word: MushafWord;
}
