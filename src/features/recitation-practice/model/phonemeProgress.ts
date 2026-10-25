/*
 * Following a recitation through the page, one phoneme at a time.
 *
 * The recogniser emits phonemes as they are spoken and the model ships the
 * canonical phonemisation of every ayah split per word, so the only thing
 * standing between the two is a pointer. This keeps that pointer: where in
 * the page the reciter has reached, which words are behind them, and which of
 * those they were carried past without reciting.
 *
 * It does not decide whether the recitation was any good. That belongs to the
 * forced alignment in ctcAlign.ts, which sees the whole run and has numbers
 * behind it; marking a word wrong from symbols arriving one at a time, then
 * reporting a clean run at the end, is the contradiction that produced "it
 * says you made no mistakes but there were red lines". Here the job is only
 * to keep up.
 *
 * Keeping up means being forgiving about duration and strict about identity.
 * The symbol table encodes madd length by repetition, so `اااااا` and
 * `اااا` are different symbols for one sound held for different counts, and
 * the model's own card says length belongs to alignment timing rather than to
 * the emitted symbol - reciters legitimately choose two, four or six harakat
 * where the training labels fixed one. Only the sound is compared, which is
 * why `createPhonemeTracker` reduces both sides to identities.
 */
import type { PhonemeEmission } from "@/features/recitation-practice/model/ctcGreedy";
/* Relative and extensioned so Node can load this unchanged: the cursor
   bench in scripts/tasmee follows the same tracker the reader does. */
import { isDoubledConsonant, phonemeIdentity } from "./phonemeTokens.ts";

/** Below this, the recogniser's own doubt, not the reciter's mistake. */
const CONFIDENCE_FLOOR = 0.45;
/**
 * After this many phonemes that fit nowhere nearby, stop assuming the reciter
 * is where we left them.
 *
 * Without this the tracker can only ever creep forward, so a reciter who
 * opens somewhere other than the first word of the page - or who loses it and
 * picks up again further down - is followed by nothing at all, forever. The
 * page is the search space, not the next few phonemes.
 */
const RESYNC_AFTER_STRAY_UNITS = 6;
/**
 * Phonemes a word must still have left to prove itself when the one being
 * forgiven is its very first.
 *
 * Measured on a learner who was stopped for twenty-six seconds at فَوَيْلٌ
 * لِّلْمُصَلِّينَ having recited it correctly. The model never emitted its opening
 * فَ - not on any of three attempts, and not on فَذَٰلِكَ earlier in the same
 * page - while on 1,897 correct professional clips that symbol is heard 99.2%
 * of the time. Replayed through the model in one pass the recording gives the
 * same answer, so this is the reciter's ف being too light for the model in
 * running speech rather than anything the streaming path did to it.
 *
 * Forgiving a phoneme mid-word was already allowed. At a word's *first*
 * position it was not, on the grounds that hearing the next word's opening
 * sound there would walk the cursor past a word nobody said - which is a
 * real risk, but not the same one: forgiving the first unit keeps the cursor
 * inside the word, and the word is only credited once the rest of it arrives.
 * Requiring two more phonemes is what makes "the rest of it" mean something,
 * so a two-phoneme word can never be assembled from one miss and one match.
 *
 * Two, swept over 3,595 clips alongside the guard below, which is what makes
 * the number small: demanding one more phoneme misses 15.4% of mistakes at
 * 2.2% wrongly flagged, two the same 15.4% at 2.2%, three 15.2% at 2.3%. The
 * last is the rule exactly as it was before any of this, so the whole change
 * is available for nothing; two is chosen over three because it covers more
 * words and trades three missed mistakes for three accusations avoided, and
 * accusing someone who recited correctly is the worse failure. The words this
 * was found on are well clear of either: فَذَٰلِكَ is five phonemes, and فَوَيْلٌ
 * لِّلْمُصَلِّينَ, which tajweed joins into one, is eleven.
 */
const MIN_UNITS_TO_FORGIVE_FIRST = 2;
/** Phonemes that must agree before a jump is believed, so one letter in common cannot move the cursor. */
const RESYNC_CONFIRM_UNITS = 3;
/**
 * How far that much agreement can move the cursor.
 *
 * Three phonemes in common turn up all over a page, so believing them
 * anywhere carried a reciter who went back over a few words to wherever those
 * sounds next occurred - from word 15 to word 103 on al-Baqarah 2:6-16.
 * Nearby, three is enough; further away the whole stray run has to agree.
 */
const NEAR_JUMP_WORDS = 8;
/**
 * Words that must lead identically into the cursor and into a distant match
 * for the match to be read as the reciter confusing two ayat; see
 * `slippedIntoTwin`.
 */
const TWIN_LEAD_IN_WORDS = 2;
/**
 * How far past the point two ayat part a matched run may begin and still be
 * the same slip: the resync looks again every few sounds, and by the second
 * look the reciter is a word or two further into the wrong ayah.
 */
const TWIN_SLIP_WORDS = 3;
/**
 * Heard sounds in a row that must continue the page exactly before the
 * cursor catches up over a misheard stretch; see `catchUp`.
 */
const CATCH_UP_CONFIRM_UNITS = 3;
/** Sounds misheard, dropped or added that catching up will look past. */
const CATCH_UP_MAX_EDITS = 2;

/*
 * The three ways the cursor forgives the recogniser, and what each was
 * measured to cost. Every threshold before these was tuned on professional
 * reciters; these were chosen on 1,000 correct recitations by ordinary
 * people (ashraf-ali/quran-data, CC0), and checked against the 1,698 real
 * mistakes in the professional bench so that forgiving the recogniser does
 * not become forgiving the reciter.
 *
 *                                     today   adopted
 *   learners stopped at least once     9.2%     6.7%
 *   learners with anything red        12.0%    10.1%
 *   words wrongly passed over           351      218
 *   passages finished when carried on   71%      93%
 *   professionals: mistakes missed    15.3%    15.7%   (6 of 1,698)
 *   professionals: wrongly marked      2.0%     1.7%
 *
 * Catching up credits a word only when more than half its sounds were heard
 * exactly; at half or more, swapped words sharing half their sounds with the
 * right one were credited and 11 more mistakes were missed. One edit instead
 * of two lost a third of the learner gain for nothing on the professionals.
 *
 * The runner-up floor traded smoothly - 30% to 10% took learners stopped from
 * 7.4% to 6.7% for one more professional mistake missed per step - and the
 * lowest was taken, because the people this is for are the learners and
 * accusing someone who recited correctly is the worse failure.
 */
const DEFAULT_RUNNER_UP_ACCEPTED = 0.1;
const DEFAULT_LAST_WORD_TAIL_FORGIVEN = 2;

/**
 * How forgiving the cursor is of the recogniser, for the bench to compare.
 *
 * The app passes nothing and gets the measured defaults; see
 * `DEFAULT_RUNNER_UP_ACCEPTED` for what they were measured against.
 */
export interface TrackerOptions {
  /**
   * A runner-up sound this likely counts as the one the page wants, or null
   * for the winner only. See `heardAs`.
   */
  acceptRunnerUpAt?: number | null;
  /** Catch up over a misheard sound or two; see `catchUp`. */
  catchUp?: boolean;
  /**
   * Sounds at the end of the passage's last word that may go unheard; see
   * where it is read in `advanceTracker`.
   */
  lastWordTailForgiven?: number;
}

/**
 * One unit of recitation to follow: the phonemes of a single spoken word, and
 * the page words it covers. Usually one, but tajweed joins words that run
 * together, so sometimes several - see wordPhonemes.ts.
 */
export interface ExpectedWord {
  locations: string[];
  units: string[];
}

/*
 * Where the reciter got to, and nothing about how well.
 *
 * The tracker used to judge each word too, from a share of its units heard
 * wrongly - thresholds its own comment called never measured. Nothing ever
 * read the answer: the verdict comes from forced alignment over the audio,
 * which has seen far more than a symbol match can. Keeping both invited the
 * reader to believe the cursor had an opinion about correctness.
 */
interface CompletedWord {
  locations: string[];
}

export interface PhonemeProgress {
  /** Words finished since the last call. */
  completed: CompletedWord[];
  /** The page words being recited now; empty once the passage is done. */
  currentLocations: string[];
  /** Index of the current word, for progress reporting. */
  wordIndex: number;
  finished: boolean;
  /**
   * Page words the cursor moved past without hearing them.
   *
   * The reciter turned up further along, so these were never reached. That is
   * first-hand evidence of a word going unsaid, independent of how its audio
   * scores, and the verdict at the end of the run uses it: a word both jumped
   * over here and weak there is a mistake, not the single wobble a clean
   * recitation is allowed.
   */
  skipped: string[];
  /**
   * Words something else was said in place of, since the last call.
   *
   * Only ever reported while waiting at a word: it is the signal behind the
   * error sound and the prompt, so it has to mean "you said something else",
   * not "the model is unsure".
   *
   * Each one carries the phonemes heard instead, which is the only record of
   * a word said wrongly and then corrected. The forced alignment at the end
   * of the run cannot see those: both attempts are in the audio, it aligns
   * to the good one, and the word scores well - so a recitation with three
   * fumbles in it comes back clean. What was heard here is all the evidence
   * there is that they happened.
   */
  stumbles: Stumble[];
  /**
   * The word the run is held at, or null; see `holdAt`.
   *
   * Reported rather than left for the caller to remember, because a caller
   * that remembered it had to guess when it ended - and guessed wrong the
   * moment the reciter went back a line.
   */
  heldAt: string[] | null;
}

/**
 * A word something else was said at, and what that was.
 *
 * Reached through `PhonemeProgress.stumbles` rather than imported, the shape
 * being nobody else's to build.
 */
interface Stumble {
  /** Which expected word, so a caller can hold the cursor at it. */
  wordIndex: number;
  /** The page words being waited for; see `ExpectedWord.locations`. */
  locations: string[];
  /**
   * The phonemes heard instead, as identities.
   *
   * The run that fitting nowhere nearby is what concluded the reciter was
   * saying something else, so it is also the best description of what they
   * said. Short - six phonemes, about one word - and not a transcript.
   */
  heard: string[];
}

interface TrackerState {
  expected: ExpectedWord[];
  wordIndex: number;
  /** Units of the current word already accounted for. */
  unitIndex: number;
  /** Phonemes of the current word forgiven as unheard; see the match loop. */
  forgiven: number;
  /** Phonemes in a row that matched nothing near the cursor. */
  stray: string[];
  /**
   * The furthest word the cursor has stood on.
   *
   * Following a reciter back over words they repeat and then forward again
   * crosses words already accounted for, and charging them as skipped a
   * second time would accuse someone of dropping what they had just said.
   */
  furthest: number;
  /** The earliest word heard recited, or -1 while none has been. */
  firstRecited: number;
  /**
   * The word the cursor is not to get past, or -1; see `holdAt`.
   *
   * The word rather than a flag, because the two stop being the same thing
   * the moment the reciter goes back. The provider used to keep its own copy
   * of which word was held and drop it whenever the cursor left that word -
   * which going back over the line before it does - so the hold was released
   * and they could then read straight past the word that had stopped them.
   * One owner, and it is this one.
   */
  heldAt: number;
  acceptRunnerUpAt: number | null;
  catchUp: boolean;
  lastWordTailForgiven: number;
  /**
   * A jump back into an ayah's twin, not yet known to be a repeat or a slip;
   * see `slippedBackIntoTwin`.
   */
  twinDetour: { left: number; heard: string[]; ayahEnd: number } | null;
}

/**
 * Build a tracker over the words a reciter is about to say.
 *
 * Their units are reduced to identities here, once, because the live stream
 * cannot be trusted on length: اااااا on the page and اااا from the
 * microphone are the same sound reached, and the cursor has to move. The
 * model's own card insists on this - duration belongs to forced-alignment
 * timing, not to the emitted symbol, because reciters legitimately choose
 * two, four or six harakat where the training labels fixed one. 26.5% of the
 * Quran's expected units carry a length, and 76.9% of its words contain at
 * least one, so demanding the exact symbol stalls the cursor on most of the
 * page.
 *
 * A unit repeating the identity before it inside a word is dropped. The
 * greedy decoder suppresses a class held across consecutive frames, so a
 * doubled consonant arrives once and a cursor waiting for it twice would
 * never pass it. Doubling is still judged at the end by the aligner, which
 * keeps blanks between repeats and can tell them apart.
 */
export function createPhonemeTracker(
  expected: ExpectedWord[],
  options: TrackerOptions = {},
): TrackerState {
  return {
    expected: expected.map((word) => {
      const units: string[] = [];
      for (const unit of word.units) {
        const identity = phonemeIdentity(unit);
        if (identity !== units.at(-1)) units.push(identity);
      }
      return { locations: word.locations, units };
    }),
    wordIndex: 0,
    unitIndex: 0,
    forgiven: 0,
    stray: [],
    furthest: 0,
    firstRecited: -1,
    heldAt: -1,
    acceptRunnerUpAt:
      options.acceptRunnerUpAt === undefined
        ? DEFAULT_RUNNER_UP_ACCEPTED
        : options.acceptRunnerUpAt,
    catchUp: options.catchUp ?? true,
    lastWordTailForgiven:
      options.lastWordTailForgiven ?? DEFAULT_LAST_WORD_TAIL_FORGIVEN,
    twinDetour: null,
  };
}

/**
 * Stop following the reciter past the word they are stuck on.
 *
 * Waiting at a word is the cursor's normal state and the resync is what
 * rescues someone who has genuinely moved on - but a reader who asked to be
 * stopped at a mistake means the opposite: carrying them forward is the thing
 * they turned off. While this is set the cursor can only advance by hearing
 * the word, so the one way past it is to say it, or for the reader to say
 * they are giving up on it.
 */
export function holdAt(state: TrackerState, wordIndex: number) {
  state.heldAt = wordIndex;
}

/** The page words the cursor is held at, or null. */
export function heldWord(state: TrackerState): string[] | null {
  if (state.heldAt === -1) return null;
  return state.expected[state.heldAt]?.locations ?? null;
}

/** Follow the reciter again, wherever they have got to. */
export function releaseHold(state: TrackerState) {
  state.heldAt = -1;
  /* The run of phonemes that fitted nowhere belongs to the word being left,
     so searching with it would send the cursor looking for a mistake. */
  state.stray = [];
}

/**
 * Give up on the word the cursor is held at and move past it.
 *
 * The locations left behind, which the caller owes the reader: this is not
 * the cursor being carried past a word nobody said - it is the reader saying
 * they cannot say it, which is worth more than any evidence the aligner has.
 */
export function giveUpOnHeldWord(state: TrackerState): string[] {
  const held = state.heldAt;
  const word = state.expected[held];
  releaseHold(state);
  if (!word) return [];

  /*
   * Only steps the cursor if it is standing on the word being given up on.
   * A reciter who went back over the line before it is mid-way through words
   * they are still reciting, and jumping the cursor to just past the held
   * word would charge those as skipped on their way out.
   */
  if (state.wordIndex === held) {
    state.wordIndex += 1;
    state.unitIndex = 0;
    state.forgiven = 0;
    state.furthest = Math.max(state.furthest, state.wordIndex);
  }
  return word.locations;
}

/**
 * The stretch of the page this recitation covered: from the earliest word
 * heard to the furthest the cursor got, end exclusive. Null until a word has
 * been recited.
 *
 * This is what a verdict can judge. Scoring the whole page instead forced the
 * audio onto words nobody had reached - a reciter who finished after one ayah
 * had every later word flagged, and once the page held more phonemes than the
 * run had frames, no alignment existed and every word scored zero. Words
 * skipped *inside* the stretch stay in it: that is a dropped word, which is
 * exactly what the verdict is for.
 */
export function recitedSpan(
  state: TrackerState,
): { from: number; to: number } | null {
  if (state.firstRecited === -1) return null;
  return {
    from: state.firstRecited,
    to: Math.max(state.furthest, state.wordIndex),
  };
}

function noteRecited(state: TrackerState, word: number) {
  state.firstRecited =
    state.firstRecited === -1 ? word : Math.min(state.firstRecited, word);
}

/**
 * Where on the page does this run of phonemes appear?
 *
 * Searches the whole passage rather than a window - someone who opened
 * elsewhere, or lost their place and picked it up again, can be anywhere -
 * but answers with the occurrence nearest the cursor, scanning from the top
 * of the page being how a reciter on the last line got dragged back to the
 * first. Nearest in either direction, with a tie going forward: going back
 * over the last few words is how people memorise, and a repeated passage -
 * `عَلَيْهِمْ` twice in al-Fatihah, a refrain every other ayah of ar-Rahman -
 * sits ahead of the cursor as often as behind it. Preferring forward sent a
 * reciter repeating three words to wherever those phonemes next occurred,
 * revealing and charging as skipped everything in between. Following them
 * back costs nothing: those words are already shown, and once they carry on
 * the cursor comes forward with them.
 *
 * Distance is measured from where the reciter would resume, not from where
 * the run began: a repeat of the last few words begins well behind the
 * cursor and ends right at it.
 *
 * Answers when the last `RESYNC_CONFIRM_UNITS` phonemes agree within
 * `NEAR_JUMP_WORDS` of the cursor, or the whole stray run agrees anywhere.
 * At an equal distance the whole run wins, because it also says where the
 * recitation began: three phonemes at the end of it can start a word later
 * and charge a word that was said as skipped.
 */
function findRun(
  expected: readonly ExpectedWord[],
  stray: readonly string[],
  near: number,
): RunMatch | null {
  if (stray.length < RESYNC_CONFIRM_UNITS) return null;

  /* Distance either way; ahead wins a tie by sorting just before behind. */
  const rank = (word: number) =>
    word >= near ? (word - near) * 2 : (near - word) * 2 + 1;

  let best: RunMatch | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  const tail = stray.slice(-RESYNC_CONFIRM_UNITS);

  for (const found of occurrences(expected, stray)) {
    if (rank(found.wordIndex) < bestRank) {
      best = found;
      bestRank = rank(found.wordIndex);
    }
  }
  for (const found of occurrences(expected, tail)) {
    if (Math.abs(found.wordIndex - near) > NEAR_JUMP_WORDS) continue;
    if (rank(found.wordIndex) < bestRank) {
      best = found;
      bestRank = rank(found.wordIndex);
    }
  }
  return best;
}

/**
 * Phonemes of an ayah's opening that must agree before a restart is believed.
 *
 * An ayah's first word is a weaker anchor than it looks - بِ or وَ or قُل open
 * dozens of them - so this has to cover enough of the opening to be the
 * opening rather than a syllable that happens to match.
 *
 * Swept against the verdict bench and the saved run that prompted it, which
 * disagree only at the bottom of the range:
 *
 *   units   that run's stumbles   verdict bench
 *   3       26                    15.7% / 2.3%   <- false restarts cost it
 *   4       27                    15.3% / 2.3%
 *   6       28                    15.3% / 2.3%   <- adopted
 *   8       46                    15.3% / 2.3%   <- never fires
 *
 * Four to six are free, and six is the most agreement that can be demanded
 * without losing any of it - so it takes the strongest evidence of the
 * settings that cost nothing. Three is where the openings start matching
 * things that were not restarts, and the bench is what notices.
 */
const AYAH_RESTART_UNITS = 6;

/** Whether this word opens an ayah, which `locations` already says. */
function opensAyah(word: ExpectedWord): boolean {
  return word.locations[0]?.endsWith(":1") ?? false;
}

/**
 * The reciter starting an ayah again, which is how someone lost finds a page.
 *
 * The cursor can be in the wrong place with no way back. A phrase that occurs
 * twice takes it there - at زُيِّنَ لِلنَّاسِ a reciter said زُيِّنَ لِلَّذِينَ
 * كَفَرُوا, borrowing from قُل لِّلَّذِينَ كَفَرُوا thirty-one words earlier on the
 * page, and the cursor followed - and the way out is a second confirmed run
 * which the hold refuses and a desynced reciter never produces. Measured on
 * that run: twenty-eight seconds stuck, fifty before the cursor saw the right
 * ayah again, every word between them marked wrong.
 *
 * Bounding the jump that caused it was tried and is worse: blocking a
 * backward move over `NEAR_JUMP_WORDS` took the run from 46 stumbles to 137,
 * because that jump is also how the cursor recovers. The failure is not where
 * the cursor goes, it is that the reciter has no way to say where they are.
 *
 * This is that way. Starting an ayah from its first word is unambiguous, it
 * is what someone does when they have lost their place, and unlike a
 * threshold it is a thing the reciter chooses. So it moves the cursor
 * wherever it was, and it overrides the hold: restarting the ayah is not
 * skipping the word they were stopped at, it is going back before it.
 *
 * Answers as a `RunMatch` so the jump is accounted for like any other - the
 * words it moves over are reported skipped or recited, not left silent.
 */
function findAyahRestart(
  expected: readonly ExpectedWord[],
  stray: readonly string[],
  near: number,
): RunMatch | null {
  if (stray.length < AYAH_RESTART_UNITS) return null;

  let best: RunMatch | null = null;
  let bestEnd = -1;

  for (const [start, word] of expected.entries()) {
    if (!opensAyah(word)) continue;

    /* The opening, far enough in to be unmistakable, with the position each
       unit sits at so the cursor can resume mid-word. */
    const opening: { unit: string; word: number; unit_: number }[] = [];
    for (
      let w = start;
      w < expected.length && opening.length < AYAH_RESTART_UNITS;
      w += 1
    ) {
      const units = expected[w]?.units ?? [];
      for (const [u, unit] of units.entries()) {
        if (opening.length === AYAH_RESTART_UNITS) break;
        opening.push({ unit, word: w, unit_: u });
      }
    }
    if (opening.length < AYAH_RESTART_UNITS) continue;

    /* Anywhere in what was heard, preferring the most recent: the reciter may
       have said other things before deciding to start again. */
    for (let at = 0; at + opening.length <= stray.length; at += 1) {
      let agrees = true;
      for (const [i, step] of opening.entries()) {
        if (stray[at + i] !== step.unit) {
          agrees = false;
          break;
        }
      }
      if (!agrees) continue;
      const end = at + opening.length;
      /*
       * Two ayat that open alike are the same restart heard twice; the one
       * nearest where the reciter has reached is the one they mean. Taking
       * the first on the page sent a reciter on 2:47 who began it again to
       * 2:40, which opens with the same seven words.
       */
      if (end < bestEnd) continue;
      if (
        end === bestEnd &&
        best &&
        Math.abs(start - near) >= Math.abs(best.fromWord - near)
      ) {
        continue;
      }
      bestEnd = end;
      /* One past the opening, which is where they are now. */
      const last = opening.at(-1)!;
      const wordUnits = expected[last.word]?.units.length ?? 0;
      best =
        last.unit_ + 1 < wordUnits
          ? { wordIndex: last.word, unitIndex: last.unit_ + 1, fromWord: start }
          : { wordIndex: last.word + 1, unitIndex: 0, fromWord: start };
    }
  }

  return best;
}

interface RunMatch {
  /** Where the cursor resumes, one past the run. */
  wordIndex: number;
  unitIndex: number;
  /**
   * Where the run began, which is a different question and the one that says
   * what went unsaid: a run ending on a word's last unit resumes at the word
   * after it, and charging that word as skipped would accuse the reciter of
   * dropping something we just heard the end of.
   */
  fromWord: number;
}

/** Every place in the passage where `needle` occurs as consecutive units. */
function occurrences(
  expected: readonly ExpectedWord[],
  needle: readonly string[],
): RunMatch[] {
  const found: RunMatch[] = [];
  for (let word = 0; word < expected.length; word += 1) {
    const units = expected[word]!.units;
    for (let unit = 0; unit < units.length; unit += 1) {
      let matched = 0;
      let w = word;
      let u = unit;
      while (matched < needle.length) {
        const here = expected[w]?.units[u];
        if (here === undefined || here !== needle[matched]) break;
        matched += 1;
        if (u + 1 < expected[w]!.units.length) u += 1;
        else {
          w += 1;
          u = 0;
        }
      }
      if (matched === needle.length) {
        found.push({ wordIndex: w, unitIndex: u, fromWord: word });
      }
    }
  }
  return found;
}

/**
 * Whether jumping forward to `toWord` would follow a reciter who slipped from
 * one ayah into its twin.
 *
 * Al-Baqarah 2:40 and 2:47 open with the same seven words - يَٰبَنِىٓ إِسْرَٰٓءِيلَ
 * ٱذْكُرُوا۟ نِعْمَتِىَ ٱلَّتِىٓ أَنْعَمْتُ عَلَيْكُمْ - and then part. A learner
 * reciting 2:40 said the seven and went on with 2:47's وَأَنِّى فَضَّلْتُكُمْ.
 * Those sounds fit nowhere near the cursor and exactly at 2:47, so the
 * resync followed them there: seventy-two words passed over, and a page
 * marked from 2:40 to 2:47 for one slip.
 *
 * It is the most common mistake in memorising, and it has a signature: the
 * words leading into where the reciter is supposed to be and into where the
 * jump would land are the same words. Someone who has really moved on to
 * another place arrives there by its own lead-in, not by the one they just
 * said. So when the two lead-ins agree, the jump is refused and the run
 * falls through to what it is - something else said at this word.
 *
 * Forward only; going back into a twin is `slippedBackIntoTwin`. Refusing
 * both held reciters who were only repeating: al-Hashr 59:23 and 59:24 both
 * open with هُوَ ٱللَّهُ, and going back from 59:24 to say 59:23 again listed
 * three stumbles on a correct recitation, for each of three reciters.
 */
function slippedIntoTwin(
  expected: readonly ExpectedWord[],
  atWord: number,
  toWord: number,
): boolean {
  if (toWord - atWord <= NEAR_JUMP_WORDS) return false;
  return sharesLeadIn(expected, atWord, toWord);
}

/**
 * Whether jumping back to `toWord` may be a slip into the twin of the ayah
 * being recited - 2:47's opening, then 2:40's وَأَوْفُوا۟ بِعَهْدِىٓ.
 *
 * Unlike going forward this cannot be refused on the spot: going back over
 * an ayah is how people memorise, and a reciter starting 59:24 who goes back
 * to say 59:23 again sounds exactly like one who slipped. So the jump is
 * followed and remembered, and what the reciter does next decides it. Saying
 * the earlier ayah through to its end is a repeat, and nothing is said about
 * it. Coming back to where they were before finishing it is a slip, and the
 * word they left is reported as a stumble - with what they said instead -
 * at the moment they return.
 */
function slippedBackIntoTwin(
  expected: readonly ExpectedWord[],
  atWord: number,
  toWord: number,
): boolean {
  if (atWord - toWord <= NEAR_JUMP_WORDS) return false;
  return sharesLeadIn(expected, atWord, toWord);
}

/** The index of the last word of the ayah `word` belongs to. */
function lastWordOfAyah(expected: readonly ExpectedWord[], word: number) {
  const ayah = (index: number) =>
    expected[index]?.locations[0]?.split(":").slice(0, 2).join(":");
  const own = ayah(word);
  let last = word;
  while (last + 1 < expected.length && ayah(last + 1) === own) last += 1;
  return last;
}

/**
 * Whether the words leading into `atWord` lead into `toWord` too, allowing
 * the match to have begun up to `TWIN_SLIP_WORDS` past the parting.
 */
function sharesLeadIn(
  expected: readonly ExpectedWord[],
  atWord: number,
  toWord: number,
): boolean {
  const sameLeadIn = (parting: number) => {
    for (let back = 1; back <= TWIN_LEAD_IN_WORDS; back += 1) {
      const mine = expected[atWord - back];
      const theirs = expected[parting - back];
      if (!mine || !theirs || mine === theirs) return false;
      if (mine.units.join(" ") !== theirs.units.join(" ")) return false;
    }
    return true;
  };
  for (let past = 0; past <= TWIN_SLIP_WORDS; past += 1) {
    if (sameLeadIn(toWord - past)) return true;
  }
  return false;
}

/** The flattened unit at a position, or null past the end of the passage. */
function unitAt(state: TrackerState, wordIndex: number, unitIndex: number) {
  return state.expected[wordIndex]?.units[unitIndex] ?? null;
}

/** Step one position forward through the passage, word boundaries included. */
function nextPosition(
  state: TrackerState,
  wordIndex: number,
  unitIndex: number,
): [number, number] {
  const word = state.expected[wordIndex];
  if (!word) return [wordIndex, unitIndex];
  return unitIndex + 1 < word.units.length
    ? [wordIndex, unitIndex + 1]
    : [wordIndex + 1, 0];
}

/**
 * The sound an emission counts as, given the one the page wants here.
 *
 * The recogniser's winner, unless the page's sound was a close enough
 * runner-up. Measured on a learner's أَنتَ: the frame that should have said
 * تَ said ننننَ at 65% and تَ at 28%, and shown only the winner the cursor
 * held them at a word they had recited correctly. The forced alignment that
 * judges the run already reads the whole distribution; this only stops the
 * cursor being stricter than the judge.
 */
function heardAs(
  state: TrackerState,
  emission: PhonemeEmission,
  wanted: string | null,
): string {
  const winner = phonemeIdentity(emission.symbol);
  const floor = state.acceptRunnerUpAt;
  if (winner === wanted || wanted === null || floor === null) return winner;
  for (const alternative of emission.alternatives ?? []) {
    if (
      alternative.probability >= floor &&
      phonemeIdentity(alternative.symbol) === wanted
    ) {
      return wanted;
    }
  }
  return winner;
}

/**
 * Two runs of sounds lined up end to end, at the fewest sounds misheard,
 * dropped or added; with which of `wanted` were heard exactly.
 */
function editAlign(
  heard: readonly string[],
  wanted: readonly string[],
): { cost: number; matched: boolean[] } {
  const rows = heard.length + 1;
  const cols = wanted.length + 1;
  const cost: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const same = heard[i - 1] === wanted[j - 1] ? 0 : 1;
      cost[i]![j] = Math.min(
        cost[i - 1]![j - 1]! + same,
        cost[i - 1]![j]! + 1,
        cost[i]![j - 1]! + 1,
      );
    }
  }
  const matched = wanted.map(() => false);
  let i = heard.length;
  let j = wanted.length;
  while (i > 0 && j > 0) {
    const same = heard[i - 1] === wanted[j - 1] ? 0 : 1;
    if (cost[i]![j] === cost[i - 1]![j - 1]! + same) {
      if (same === 0) matched[j - 1] = true;
      i -= 1;
      j -= 1;
    } else if (cost[i]![j] === cost[i - 1]![j]! + 1) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return { cost: cost[heard.length]![wanted.length]!, matched };
}

/**
 * Catch up with a reciter the recogniser misheard for a sound or two.
 *
 * The cursor waits for each sound of a word in turn, and forgives one that
 * never arrived - but not one that arrived as something else, nor two in a
 * row. Measured on a learner's أَنتَ ٱلْعَلِيمُ: تَ came through as ننننَ and the
 * ل of ٱلْعَلِيمُ not at all, then عَلِۦمُ exactly. Two misses across a word
 * boundary, the next four sounds the page itself, and the reciter held for
 * twenty seconds at a word they had said right the first time.
 *
 * So once the last few sounds heard continue the page exactly, the stretch
 * before them is lined up against the page with up to two sounds misheard,
 * dropped or added, and the cursor moves to where they lead. Not further:
 * the window is only as long as what was heard, so this cannot reach the
 * distant matches the resync exists for.
 *
 * A word moved over counts as recited only if half its sounds or more were
 * heard exactly. Anything less is reported as passed over, and the verdict -
 * which has the audio - decides; catching up never makes a word unsaid
 * invisible. Nor does it carry a reciter past the word they are held at,
 * unless that word is one of the recited ones.
 */
function catchUp(
  state: TrackerState,
  completed: CompletedWord[],
  skipped: string[],
): boolean {
  const stray = state.stray;
  if (stray.length < CATCH_UP_CONFIRM_UNITS) return false;

  const ahead: { unit: string; word: number }[] = [];
  let [word, unit] = [state.wordIndex, state.unitIndex];
  while (ahead.length < stray.length + CATCH_UP_MAX_EDITS) {
    const here = unitAt(state, word, unit);
    if (here === null) break;
    ahead.push({ unit: here, word });
    [word, unit] = nextPosition(state, word, unit);
  }

  const prefix = stray.slice(0, -CATCH_UP_CONFIRM_UNITS);
  const tail = stray.slice(-CATCH_UP_CONFIRM_UNITS);
  let best: { end: number; cost: number; matched: boolean[] } | null = null;
  for (let end = CATCH_UP_CONFIRM_UNITS; end <= ahead.length; end += 1) {
    const confirms = tail.every(
      (sound, i) => ahead[end - CATCH_UP_CONFIRM_UNITS + i]!.unit === sound,
    );
    if (!confirms) continue;
    const before = ahead.slice(0, end - CATCH_UP_CONFIRM_UNITS);
    const { cost, matched } = editAlign(
      prefix,
      before.map((step) => step.unit),
    );
    if (cost > CATCH_UP_MAX_EDITS) continue;
    if (!best || cost < best.cost) best = { end, cost, matched };
  }
  if (!best) return false;

  const heardIn = new Map<number, number>();
  heardIn.set(state.wordIndex, state.unitIndex);
  ahead.slice(0, best.end).forEach((step, i) => {
    const exact =
      i >= best.end - CATCH_UP_CONFIRM_UNITS || best.matched[i] === true;
    if (exact) heardIn.set(step.word, (heardIn.get(step.word) ?? 0) + 1);
  });
  /* Where the cursor lands: just after the last sound caught up with. */
  let [toWord, toUnit] = [state.wordIndex, state.unitIndex];
  for (let i = 0; i < best.end; i += 1) {
    [toWord, toUnit] = nextPosition(state, toWord, toUnit);
  }
  const recited = (index: number) =>
    (heardIn.get(index) ?? 0) * 2 > (state.expected[index]?.units.length ?? 0);

  if (
    state.heldAt !== -1 &&
    state.heldAt >= state.wordIndex &&
    state.heldAt < toWord &&
    !recited(state.heldAt)
  ) {
    return false;
  }

  for (let index = state.wordIndex; index < toWord; index += 1) {
    const passed = state.expected[index];
    if (!passed) continue;
    if (recited(index)) {
      completed.push({ locations: passed.locations });
      noteRecited(state, index);
    } else if (index >= state.furthest) {
      skipped.push(...passed.locations);
    }
  }
  state.wordIndex = toWord;
  state.unitIndex = toUnit;
  state.forgiven = 0;
  state.stray = [];
  return true;
}

function closeWord(state: TrackerState, completed: CompletedWord[]) {
  const word = state.expected[state.wordIndex];
  if (!word) return;

  completed.push({ locations: word.locations });
  noteRecited(state, state.wordIndex);

  state.wordIndex += 1;
  state.unitIndex = 0;
  state.forgiven = 0;
}

/**
 * Feed the phonemes heard since the last call and get back what moved.
 *
 * Mutates `state`, which is the point: this is a position in a recitation
 * that is still happening, not a transcript to be re-derived.
 */
export function advanceTracker(
  state: TrackerState,
  emissions: readonly PhonemeEmission[],
): PhonemeProgress {
  const completed: CompletedWord[] = [];
  const skipped: string[] = [];
  const stumbles: Stumble[] = [];

  for (const emission of emissions) {
    state.furthest = Math.max(state.furthest, state.wordIndex);
    if (state.wordIndex >= state.expected.length) break;

    const expectedUnit = unitAt(state, state.wordIndex, state.unitIndex);
    if (expectedUnit === null) break;

    /* Length is the recogniser's weakest dimension and the page's most
       variable one; only the sound itself is compared. */
    const heard = heardAs(state, emission, expectedUnit);

    if (heard === expectedUnit) {
      state.stray = [];
      const [word, unit] = nextPosition(
        state,
        state.wordIndex,
        state.unitIndex,
      );
      if (word !== state.wordIndex) closeWord(state, completed);
      else state.unitIndex = unit;

      /*
       * A doubling that straddles a word boundary - `وَمِنَ نَاسِ`, 1.35% of
       * them - reaches us once, for the reason `createPhonemeTracker`
       * deduplicates within a word. Consume the repeat rather than waiting
       * for a sound the decoder cannot send twice, which would otherwise
       * strand the cursor until a resync and then report the word just
       * finished as one the reciter was carried past.
       */
      const next = state.expected[state.wordIndex];
      if (
        state.unitIndex === 0 &&
        next !== undefined &&
        next.units.length > 1 &&
        next.units[0] === heard
      ) {
        state.unitIndex = 1;
      }
      continue;
    }

    /*
     * One phoneme of this word, missing, is forgiven.
     *
     * Measured on a learner rather than a reciter: a single Fatihah stalled
     * five times for seventeen seconds in all, and the cause each time was
     * one phoneme the recogniser never reported - `ءَنعَمتَ` arriving as
     * `ءَنعَتَ`, `عَلَيهِم` as `عَلَيهِ`. The word was recited correctly and the
     * cursor sat on it until six unplaceable phonemes had piled up and the
     * resync came looking, sounding the mistake tone and revealing the word
     * on the way - handing someone the answer they had just given.
     *
     * Mid-word the reciter is demonstrably inside the word already. At its
     * first phoneme they are not, so the word has to earn it instead: see
     * `MIN_UNITS_TO_FORGIVE_FIRST`, which demands two more phonemes before
     * the word is credited. `forgiven` caps this at one phoneme per word
     * either way, so a word can never be assembled out of misses.
     */
    const missing = unitAt(state, state.wordIndex, state.unitIndex);
    const unitsLeft =
      (state.expected[state.wordIndex]?.units.length ?? 0) - state.unitIndex;
    if (
      (state.unitIndex > 0 ||
        /*
         * At the word's first phoneme, only while nothing has gone
         * unplaceable yet. "Its opening sound never arrived" explains a word
         * that has just begun; once a run of phonemes fits nowhere, the
         * reciter is somewhere else and the resync is what should answer.
         *
         * Without this, any stray that happened to equal the word's second
         * phoneme was swallowed as that phoneme and cleared the run with it,
         * so the resync never reached the six it needs - which is how
         * reciting al-Fatihah 1:2 from its third word left the cursor stuck
         * on the first.
         */
        (unitsLeft > MIN_UNITS_TO_FORGIVE_FIRST && state.stray.length === 0)) &&
      state.forgiven === 0 &&
      /* Length is forgiven, doubling is not: إِيَاكَ for إِيَّاكَ changes the
         meaning, and the table writes both by repeating a character. */
      missing !== null &&
      !isDoubledConsonant(missing)
    ) {
      const [gapWord, gapUnit] = nextPosition(
        state,
        state.wordIndex,
        state.unitIndex,
      );
      /*
       * At a word's first phoneme, refuse the one case the old guard was
       * written for: a sound that could equally be this word's second
       * phoneme or the next word's first. That is precisely what a reciter
       * who dropped this word sounds like, and crediting it would walk the
       * cursor past a word nobody said. Ambiguous means no.
       */
      const ambiguous =
        state.unitIndex === 0 &&
        heard === state.expected[state.wordIndex + 1]?.units[0];
      const gap = unitAt(state, gapWord, gapUnit);
      if (!ambiguous && gap !== null && heardAs(state, emission, gap) === gap) {
        state.stray = [];
        state.forgiven += 1;
        /* Step over the phoneme that never came... */
        if (gapWord !== state.wordIndex) closeWord(state, completed);
        else state.unitIndex = gapUnit;
        /* ...then account for the one that did. */
        const [word, unit] = nextPosition(
          state,
          state.wordIndex,
          state.unitIndex,
        );
        if (word !== state.wordIndex) closeWord(state, completed);
        else state.unitIndex = unit;
        continue;
      }
    }

    /*
     * The passage's last word, nearly all heard, and the reciter has moved on.
     *
     * A word someone stops on fades: its closing sound - the ه of ٱلْقَارِعَةُ,
     * the ن after a long ي - is quiet at a pause, and the recogniser often
     * never emits it. Measured on 1,000 correct learner recitations, 27%
     * stopped one or two sounds short of the end this way, with the rest of
     * the word heard. On a page that recitation carries on from, that was a
     * page that never turned: the next page's first sounds fit nowhere on
     * this one. So once at least half the word is in and no more than this
     * many sounds are left, the next sound that is not the word's finishes it.
     */
    const lastWord = state.expected[state.wordIndex];
    if (
      state.wordIndex === state.expected.length - 1 &&
      lastWord !== undefined &&
      state.unitIndex > 0 &&
      state.unitIndex * 2 >= lastWord.units.length &&
      lastWord.units.length - state.unitIndex <= state.lastWordTailForgiven
    ) {
      state.stray = [];
      closeWord(state, completed);
      continue;
    }

    /*
     * Not what was expected here, and the cursor holds where it is.
     *
     * It used to be able to look ahead a few units and follow a reciter who
     * had dropped a letter - but that also walks past words they never said,
     * which is the one thing someone memorising must not be let do, and
     * every caller had the lookahead switched off. What follows a reciter
     * who has genuinely moved on is the resync below, which needs a run of
     * phonemes rather than one common letter to believe it.
     */
    // Genuinely something else: a mistake here, until the run of them grows
    // long enough to suggest the reciter is simply somewhere else.
    if (emission.confidence >= CONFIDENCE_FLOOR) {
      state.stray.push(heard);
      if (state.catchUp && catchUp(state, completed, skipped)) continue;
    }

    if (state.stray.length >= RESYNC_AFTER_STRAY_UNITS) {
      /*
       * Enough said that fits nowhere near the cursor. Before concluding the
       * reciter is stuck, check whether they have simply moved on: waiting
       * for a word must not become trapping someone at it. A confirmed run
       * further along is them reciting, not a coincidence.
       */
      /*
       * An ayah started again outranks everything below: it is the reciter
       * saying where they are, and the point of it is to work when the rest
       * of this cannot. See `findAyahRestart`.
       */
      const restart = findAyahRestart(
        state.expected,
        state.stray,
        state.furthest,
      );
      const run = restart
        ? null
        : findRun(state.expected, state.stray, state.wordIndex);
      const found =
        restart ??
        (run && slippedIntoTwin(state.expected, state.wordIndex, run.fromWord)
          ? null
          : run);
      if (restart) state.heldAt = -1;
      if (found && found.wordIndex === state.wordIndex) {
        /*
         * A run ending right where the cursor waits: the reciter went back
         * over the words before this one and has caught up. Nothing to move,
         * and nothing wrong with it either.
         */
        state.unitIndex = found.unitIndex;
        state.stray = [];
        continue;
      }
      /*
       * Held at this word, and the run says they have moved on. That is
       * exactly what the reader asked not to happen, so the jump is refused
       * and this falls through to reporting the stumble again.
       */
      if (found && state.heldAt !== -1 && found.fromWord > state.heldAt) {
        stumbles.push({
          wordIndex: state.wordIndex,
          locations: state.expected[state.wordIndex]?.locations ?? [],
          heard: [...state.stray],
        });
        state.unitIndex = 0;
        state.stray = state.stray.slice(-RESYNC_CONFIRM_UNITS);
        continue;
      }
      if (found) {
        /*
         * The reciter is somewhere else on the page, so the cursor follows
         * them there rather than holding a word they have already left
         * behind. Every word it moves over has to be accounted for, and the
         * jump splits them in two:
         *
         *   before the confirming run  never reached - skipped
         *   covered by the run         just recited - that is what confirmed
         *                              the jump, so finished
         *
         * Both have to be reported. A word in neither list is a word nothing
         * reveals and nothing marks: it stays blank on the page behind the
         * cursor and the summary calls the run clean, which is what reciting
         * a word and not seeing it appear looks like from the outside.
         *
         * Skipped words are reported and nothing more - not marked here,
         * because being overtaken is not the same as being heard getting it
         * wrong, and only the aligner has looked at the audio.
         */
        const leaving = state.wordIndex;
        const detour = state.twinDetour;
        if (detour && found.fromWord > detour.ayahEnd) {
          /* Back before finishing the twin: that was a slip, not a repeat. */
          stumbles.push({
            wordIndex: detour.left,
            locations: state.expected[detour.left]?.locations ?? [],
            heard: detour.heard,
          });
          state.twinDetour = null;
        }
        if (
          !restart &&
          slippedBackIntoTwin(state.expected, leaving, found.fromWord)
        ) {
          state.twinDetour = {
            left: leaving,
            heard: [...state.stray],
            ayahEnd: lastWordOfAyah(state.expected, found.fromWord),
          };
        }
        state.wordIndex = found.wordIndex;
        state.unitIndex = found.unitIndex;
        state.stray = [];
        if (found.wordIndex > leaving) {
          for (
            let word = Math.max(leaving, state.furthest);
            word < found.fromWord;
            word += 1
          ) {
            skipped.push(...(state.expected[word]?.locations ?? []));
          }
          // `max`, because a run can begin behind the cursor and end ahead of
          // it when the reciter repeated a word before carrying on.
          for (
            let word = Math.max(leaving, found.fromWord);
            word < found.wordIndex;
            word += 1
          ) {
            const recited = state.expected[word];
            if (recited) {
              completed.push({ locations: recited.locations });
              noteRecited(state, word);
            }
          }
        }
        continue;
      }
      // Still nowhere: the reciter is trying this word and not getting it.
      stumbles.push({
        wordIndex: state.wordIndex,
        locations: state.expected[state.wordIndex]?.locations ?? [],
        heard: [...state.stray],
      });
      /*
       * Back to the start of the word. They will say the whole thing again,
       * not resume from the syllable they reached, so holding the position
       * mid-word only throws their first phonemes away.
       */
      state.unitIndex = 0;
      // Keep only the tail, so the search stays recent.
      state.stray = state.stray.slice(-RESYNC_CONFIRM_UNITS);
    }
  }
  state.furthest = Math.max(state.furthest, state.wordIndex);
  const detour = state.twinDetour;
  const repeatEnd = detour ? state.expected[detour.ayahEnd] : undefined;
  if (
    repeatEnd &&
    completed.some((word) => word.locations === repeatEnd.locations)
  ) {
    state.twinDetour = null;
  }
  /*
   * Past the held word, so the hold is done with.
   *
   * The cursor being *past* it, not merely elsewhere: going back over the
   * words before it leaves the hold standing, which is the whole point of
   * keeping the word rather than a flag.
   */
  if (state.heldAt !== -1 && state.wordIndex > state.heldAt) {
    state.heldAt = -1;
  }

  const current = state.expected[state.wordIndex] ?? null;
  return {
    completed,
    currentLocations: current?.locations ?? [],
    wordIndex: state.wordIndex,
    finished: state.wordIndex >= state.expected.length,
    skipped,
    stumbles,
    heldAt: heldWord(state),
  };
}
