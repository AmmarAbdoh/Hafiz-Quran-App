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

export interface SimpleVerse {
  id: number;
  verse_key: string;
  text_uthmani_simple: string;
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

export type VerseInfoKey = "surah" | "ayah" | "juz" | "hizb" | "page";

export interface VerseInfoItem {
  key: VerseInfoKey;
  value: string | number;
}

export interface PageLine {
  lineNumber: number;
  verses: MushafVerse[];
}

export interface MushafWord {
  verse_key: string;
  sura: number;
  aya: number;
  word: number;
  location: string;
  line: number;
  page: number;
  code_v2: string;
  char_type: string;
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
