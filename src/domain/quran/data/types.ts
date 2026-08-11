import type {
  ImlaeiVerse,
  MushafPageLayout,
  MushafVerse,
  SimpleVerse,
  UthmaniVerse,
  VerseInfoRecord,
} from "../model";

export type {
  MushafPageLayout,
  MushafVerse,
  MushafWord,
  VerseInfoRecord,
} from "../model";

export type QuranDataLocale = "ar" | "en";

export interface QuranCoreData {
  schemaVersion: 1;
  mushafVerses: MushafVerse[];
  verseInfo: VerseInfoRecord[];
  uthmaniVerses: UthmaniVerse[];
  simpleVerses: SimpleVerse[];
  chapterSimpleVerses: SimpleVerse[];
  imlaeiVerses: ImlaeiVerse[];
  imlaeiCleanedVerses: ImlaeiVerse[];
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
