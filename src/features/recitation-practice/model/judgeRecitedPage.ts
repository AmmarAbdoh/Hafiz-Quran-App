import type { MisreadWord } from "@/features/recitation-practice/contract";
import { findMisreadWords } from "@/features/recitation-practice/model/practiceVerdict";
import {
  phonemesAsLetters,
  whatWasHeard,
} from "@/features/recitation-practice/model/phonemeText";
import type { ScorableWord } from "@/features/recitation-practice/model/wordPhonemes";

/**
 * One page of a recitation, as it stood when the reciter left it.
 *
 * Kept whole rather than read from the run's live state because a recitation
 * carries on to the next page while this one is still being scored: by the
 * time its verdict arrives, everything live describes a different page.
 */
export interface RecitedPage {
  spoken: readonly ScorableWord[];
  /** Each page word's ayah and text, in page order. */
  wordText: ReadonlyMap<string, { verseKey: string; text: string }>;
  /** The spoken words that were recited, and so scored. */
  span: { from: number; to: number };
  /** Words the cursor saw the reciter go past. */
  skipped: ReadonlySet<string>;
  /** Words something else was said at first, and what that was. */
  stumbles: ReadonlyMap<string, string[]>;
  /** Words the reader said they could not say. */
  gaveUp: ReadonlySet<string>;
}

/**
 * The words of a page that need work, in page order - or null when the
 * scores cannot be trusted to name them.
 *
 * Scores that do not line up with what was asked about cannot be trusted to
 * mark the right words, and marking none would report a clean recitation
 * that nobody checked: the one answer a memorization helper must never give
 * by accident.
 */
export function judgeRecitedPage(
  page: RecitedPage,
  scores: readonly number[],
  heardPerWord: readonly (readonly string[])[],
  tolerated: number,
): MisreadWord[] | null {
  const judged = page.spoken.slice(page.span.from, page.span.to);
  if (judged.length === 0 || scores.length !== judged.length) return null;

  const scored = judged.map((word, index) => ({
    ayah: word.locations[0]?.split(":").slice(0, 2).join(":") ?? "",
    score: scores[index]!,
    skipped: word.locations.some((location) => page.skipped.has(location)),
  }));

  const misread: MisreadWord[] = [];
  const listed = (location: string) =>
    misread.some((word) => word.location === location);

  /*
   * The words the reader said they could not say, before anything the audio
   * is asked about: a given-up word may also score badly, and "you told us
   * you were stuck here" is the truer reason of the two.
   */
  for (const location of page.gaveUp) {
    const known = page.wordText.get(location);
    if (!known) continue;
    misread.push({ location, ...known, heard: { kind: "gaveUp" } });
  }

  for (const index of findMisreadWords(scored, undefined, tolerated)) {
    for (const location of judged[index]!.locations) {
      if (listed(location)) continue;
      const known = page.wordText.get(location);
      if (!known) continue;
      misread.push({
        location,
        ...known,
        /* One spoken word can cover several of the page's, tajweed running
           them together, and the alignment scores the pair as one - so both
           carry the same reading of what was heard. */
        heard: whatWasHeard(judged[index]!.units, heardPerWord[index] ?? []),
      });
    }
  }

  /*
   * And the words they got wrong and then got right.
   *
   * Invisible to everything above: both attempts are in the audio, the
   * alignment uses the good one, and the word scores well. Listing them is
   * the answer to "it says I got nothing wrong, but I did" - the recitation
   * stopped and went back, which the cursor saw and nothing else did.
   */
  for (const [location, stumbled] of page.stumbles) {
    if (listed(location)) continue;
    const known = page.wordText.get(location);
    if (!known) continue;
    misread.push({
      location,
      ...known,
      heard: { kind: "stumble", letters: phonemesAsLetters(stumbled) },
    });
  }

  /* Page order, so the list reads the way the page does: the stumbles were
     appended after words that may come later than they do. */
  const order = [...page.wordText.keys()];
  return misread.sort(
    (a, b) => order.indexOf(a.location) - order.indexOf(b.location),
  );
}
