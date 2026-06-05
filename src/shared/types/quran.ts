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
  | "surah_name"
  | "ayah_number"
  | "juz_number"
  | "hizb_number"
  | "page_number";

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
