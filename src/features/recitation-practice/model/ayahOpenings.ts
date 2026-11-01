/*
 * Which ayah of the Quran is the reciter starting?
 *
 * A run starts on the page on screen, and a reciter who opens an ayah from
 * somewhere else used to be followed by nothing at all - every sound fit
 * nowhere on the page. This looks for the sounds heard so far at the opening
 * of every ayah, so the run can move to where they really are.
 */
import { phonemeIdentity } from "./phonemeTokens.ts";

/** An ayah's first sounds, as identities with repeats collapsed. */
export interface AyahOpening {
  verseKey: string;
  units: string[];
  /** The ayah after it, whose opening must follow if this one was said whole. */
  next?: string;
}

/** Enough of an opening that a match is the reciter and not a coincidence. */
export const OPENING_MIN_UNITS = 8;
/** How far into an ayah its opening is kept; also when waiting gives up. */
export const OPENING_UNITS_KEPT = 40;
/**
 * Sounds an answer must stay the only one for before it is acted on.
 *
 * Openings that part on one sound - al-Falaq's three وَمِن شَرِّ - are told
 * apart by that sound alone, and one misheard sound there picked the wrong
 * ayah. On 1,000 correct learner recitations, acting at once took the wrong
 * ayah 4.7% of the time; waiting 4 sounds, 1.0%; 6, 0.5% - about a second.
 * Six, because moving a reciter away from their page is the worse mistake.
 */
export const OPENING_CONFIRM_UNITS = 6;
/**
 * Sounds after which nothing is looked for any more - about ten seconds.
 *
 * "Only at the start": by then the reciter is on the page or cannot be
 * placed. It also bounds the work: every sound searches every opening.
 */
export const OPENING_GIVE_UP_UNITS = 80;

/**
 * Sounds as compared here: identities, a sound held over two of them once.
 * The recogniser cannot report the same class twice in a row, so neither
 * side may ask for it.
 */
export function openingUnits(units: readonly string[]): string[] {
  const out: string[] = [];
  for (const unit of units) {
    const identity = phonemeIdentity(unit);
    if (identity !== out.at(-1)) out.push(identity);
  }
  return out;
}

/**
 * One heard sound: what the recogniser chose, then any runner-up it gave at
 * least `OPENING_RUNNER_UP` - as the cursor reads them, and for the same
 * reason. A live run heard the ذ of ذَٰلِكَ as تَ, and with the winner alone
 * al-Baqarah 2:2 could never be found.
 */
export type HeardSound = readonly string[];

/** A runner-up this likely may stand for the sound an opening wants. */
export const OPENING_RUNNER_UP = 0.1;

/**
 * The ayah these sounds open, "wait" while more than one still fits, or null
 * when none does.
 *
 * What was heard may begin with anything - an isti'adha, a cough - so the
 * opening can start at any point in it, but it must run to the end of what
 * was heard: the reciter is saying it now. Ayat that open alike for longer
 * than an opening is kept, like the refrain of ar-Rahman, cannot be told
 * apart by sound at all, and the one nearest `near` is taken.
 */
export function findAyahByOpening(
  heard: readonly HeardSound[],
  openings: readonly AyahOpening[],
  near: (verseKey: string) => number,
): { verseKey: string } | "wait" | null {
  /* The full opening of each ayah - the first listed - for checking what
     follows one said whole; see `withFirstSoundMissing`. */
  const byKey = new Map<string, AyahOpening>();
  for (const opening of openings) {
    if (!byKey.has(opening.verseKey)) byKey.set(opening.verseKey, opening);
  }
  const candidates = new Set<string>();
  let longest = 0;
  /* Every candidate heard to the end of its opening: nothing left to tell
     them apart by. */
  let allWhole = true;
  /* An opening is at most `OPENING_UNITS_KEPT` long, and a whole one is
     checked against the next ayah's, so nothing earlier than twice that can
     start a match that runs to the end of what was heard. */
  const earliest = Math.max(0, heard.length - 2 * OPENING_UNITS_KEPT);
  for (
    let start = earliest;
    heard.length - start >= OPENING_MIN_UNITS;
    start += 1
  ) {
    const said = heard.length - start;
    for (const opening of openings) {
      if (opening.units.length < Math.min(said, OPENING_MIN_UNITS)) continue;
      const length = Math.min(said, opening.units.length);
      let agrees = true;
      for (let i = 0; i < length; i += 1) {
        if (!heard[start + i]!.includes(opening.units[i]!)) {
          agrees = false;
          break;
        }
      }
      /*
       * An opening shorter than what was said was said whole, so its own next
       * ayah has to follow. 3:2 is the first seven words of 2:255 and nothing
       * else: without this, Ayat al-Kursi with one sound misheard after them
       * was taken for 3:2.
       */
      if (agrees && said > opening.units.length) {
        const after = heard.slice(start + opening.units.length);
        const next = opening.next ? byKey.get(opening.next) : undefined;
        agrees =
          next !== undefined &&
          after.every(
            (sound, i) =>
              i >= next.units.length || sound.includes(next.units[i]!),
          );
      }
      if (agrees) {
        candidates.add(opening.verseKey);
        longest = Math.max(longest, length);
        allWhole &&= length === opening.units.length;
      }
    }
    if (candidates.size > 0) break;
  }
  if (candidates.size === 0) return null;
  if (candidates.size === 1) return { verseKey: [...candidates][0]! };
  if (!allWhole && longest < OPENING_UNITS_KEPT) return "wait";
  return {
    verseKey: [...candidates].sort((a, b) => near(a) - near(b))[0]!,
  };
}

/**
 * Each opening, and after it the same opening without its first sound.
 *
 * The first sound of a recitation is the one the recogniser most often
 * misses - speech starting from silence, and the hamza that begins over a
 * fifth of all ayat. On 1,000 learner recitations, 188 of those never placed
 * diverged at the very first sound. Accepting the opening without it found
 * the right ayah 534 times instead of 492, with no more wrong ones (10).
 */
export function withFirstSoundMissing(
  openings: readonly AyahOpening[],
): AyahOpening[] {
  return openings.flatMap((opening) =>
    opening.units.length > OPENING_MIN_UNITS
      ? [opening, { ...opening, units: opening.units.slice(1) }]
      : [opening],
  );
}
