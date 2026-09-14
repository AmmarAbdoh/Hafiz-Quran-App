export const STORAGE_KEYS = {
  locale: "artqiy.locale",
  theme: "theme",
  reciter: "quran-reciter-id",
  tafseer: "quran-tafseer-id",
  readerPosition: "artqiy.reader.position",
  readerRecents: "artqiy.reader.recents",
  bookmarks: "artqiy.bookmarks",
  mushafScale: "mushaf-text-scale",
  mushafWarmth: "mushaf-warmth",
  mushafTajweedColored: "mushaf-tajweed-colored",
} as const;

/**
 * Keys written under the previous app name. Read as a fallback so a returning
 * reader keeps their choice, then dropped once the value has been rewritten.
 */
export const LEGACY_STORAGE_KEYS = {
  locale: "hafiz-quran.locale",
} as const;
