export interface MushafVerse {
  id: number;
  jozz: number;
  page: number;
  sura_no: number;
  sura_name_en: string;
  sura_name_ar: string;
  line_start: number;
  line_end: number;
  aya_no: number;
  aya_text: string;
  aya_text_emlaey: string;
}

export interface UthmaniVerse {
  id: number;
  verse_key: string;
  text_uthmani: string;
}

export interface ImlaeiVerse {
  id: number;
  verse_key: string;
  text_imlaei: string;
}

export interface VerseInfoRecord {
  id: number;
  verse_number: number;
  verse_key: string;
  hizb_number: number;
  rub_el_hizb_number: number;
  ruku_number: number;
  manzil_number: number;
  sajdah_number: number | null;
  page_number: number;
  juz_number: number;
}

export interface VerseInfoItem {
  key: string;
  value: string | number;
}

export type QuestionType =
  | "fill_blank"
  | "complete_ayah"
  | "audio_identify"
  | "surah_name"
  | "ayah_number"
  | "juz_number"
  | "hizb_number"
  | "page_number";

export type QuizScopeMode = "surah" | "juz" | "page" | "ayah_range";

export interface QuizScope {
  mode: QuizScopeMode;
  /** Selected surah numbers (1–114) when mode is surah */
  surahIndices?: number[];
  /** Selected juz numbers (1–30) when mode is juz */
  juzIndices?: number[];
  /** Inclusive page range when mode is page */
  pageFrom?: number;
  pageTo?: number;
  /** Surah for ayah-range mode */
  ayahRangeSurah?: number;
  ayahFrom?: number;
  ayahTo?: number;
}

export type QuizSessionMode = "fixed" | "endless";

export interface QuizConfig {
  scope: QuizScope;
  questionTypes: QuestionType[];
  sessionMode: QuizSessionMode;
  /** Required when sessionMode is fixed */
  questionCount?: number;
}

/** @deprecated Use QuizConfig instead */
export interface QuizSelection {
  mode: "surah" | "juz";
  indices: number[];
  questionTypes: QuestionType[];
}

export interface ChapterData {
  verses: UthmaniVerse[];
}

export interface ImlaeiData {
  verses: ImlaeiVerse[];
}

export interface UthmaniData {
  verses: UthmaniVerse[];
}

export interface TafseerData {
  text: string;
}

export interface PageLine {
  lineNumber: number;
  verses: MushafVerse[];
}

export type MushafWordCharType = "word" | "end" | "pause";

export interface MushafWord {
  verse_key: string;
  sura: number;
  aya: number;
  word: number;
  location: string;
  line: number;
  page: number;
  code_v2: string;
  char_type: MushafWordCharType | string;
  audio_url?: string;
}

export interface MushafWordLine {
  line: number;
  words: MushafWord[];
}

export interface MushafPageLayout {
  page: number;
  lines: MushafWordLine[];
}

export interface MushafWordLayoutData {
  meta: {
    mushaf: number;
    source: string;
    page_count: number;
    start?: number;
    end?: number;
  };
  pages: MushafPageLayout[];
}
