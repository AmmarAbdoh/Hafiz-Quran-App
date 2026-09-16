/*
 * The mushaf text ends each ayah with its number as an ornament, encoded as a
 * single codepoint: U+FC00 for ayah 1 through U+FD1D for ayah 286, the longest
 * surah. The per-page Quran fonts draw those as the decorated numeral a reader
 * expects.
 *
 * Unicode itself calls that range Arabic Presentation Forms-A, where U+FC00 is
 * ARABIC LIGATURE BEH WITH JEEM. So anywhere this text is rendered in an
 * interface font, the ayah number silently becomes a pair of letters - ayah 1
 * reads "جب", ayah 3 "من". 6206 of the 6236 verses carry one.
 */
/** Trailing only: the same codepoints are real ligatures elsewhere in a word. */
const TRAILING_AYAH_MARKER = /[\s\u00A0]*[\uFC00-\uFD1D][\s\u00A0]*$/;

/**
 * Drops the ayah-number ornament from the end of mushaf text.
 *
 * Use it wherever the words are wanted without the numeral - an answer to
 * choose between, a line to read back - as distinct from the mushaf page,
 * which draws the ornament properly and should keep it.
 */
export function stripAyahMarker(text: string): string {
  return text.replace(TRAILING_AYAH_MARKER, "");
}
