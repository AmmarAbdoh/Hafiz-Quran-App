/** Pages rendered center-aligned like the printed Madani mushaf (Quran.com). */
const CENTER_ALIGNED_PAGES = new Set([1, 2]);

/**
 * Whether a mushaf page uses centered lines instead of justified spread.
 * Matches Quran.com `isCenterAlignedPage` for IndoPak-excluded fonts.
 */
export function isCenterAlignedPage(pageNumber: number): boolean {
  return CENTER_ALIGNED_PAGES.has(pageNumber);
}
