import type { MushafPageLayout, MushafVerse, VerseInfoRecord } from "../model";

export type {
  MushafPageLayout,
  MushafVerse,
  MushafWord,
  VerseInfoRecord,
} from "../model";

export type QuranDataLocale = "ar" | "en";

/**
 * Only what the app reads. The source carries five further orthographies of
 * the whole Quran; they are cross-check material for the build's fidelity
 * hash and are no longer shipped, because they were 56% of this payload and
 * nothing here ever dereferenced them.
 */
export interface QuranCoreData {
  schemaVersion: 1;
  mushafVerses: MushafVerse[];
  verseInfo: VerseInfoRecord[];
}

export interface QuranDataAsset {
  path: string;
  bytes: number;
  uncompressedBytes: number;
  sha256: string;
  contentSha256: string;
}

export interface QuranDataManifest {
  schemaVersion: 1;
  dataVersion: "v1";
  invariants: {
    verses: 6236;
    surahs: 114;
    pages: 604;
    verseInfoRecords: 6236;
    tafsirs: 8;
    tafsirBundles: 912;
    tafsirRecords: 49888;
  };
  core: QuranDataAsset;
  layouts: {
    count: number;
    mushaf: number;
    source: string;
    pathTemplate: string;
    assets: QuranDataAsset[];
    compressedBytes: number;
  };
  tafsirs: {
    ids: string[];
    names: Record<string, string>;
    bundleCount: number;
    recordCount: number;
    pathTemplate: string;
    assets: Record<string, QuranDataAsset[]>;
    compressedBytes: number;
  };
  compressedBytes: number;
}

export interface TafsirBundle {
  schemaVersion: 1;
  tafsirId: string;
  tafsirName: string;
  surah: number;
  ayahs: Array<{ ayah: number; text: string }>;
}

export interface QuranRepository {
  loadCoreData(): Promise<QuranCoreData>;
  loadPageLayout(page: number): Promise<MushafPageLayout>;
  loadSurahLayouts(surah: number): Promise<MushafPageLayout[]>;
  loadTafsirText(
    tafsirId: string,
    surah: number,
    ayah: number,
  ): Promise<string>;
}
