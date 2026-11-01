/*
 * Which words to mark red, once the whole recitation can be looked at.
 *
 * The scores come from forced alignment, which answers "did he say this?"
 * per word. Turning that into marks takes one more decision, and it is the
 * decision that governs how a memorization helper feels: how much doubt a
 * correct recitation is allowed before it is accused of something.
 *
 * Measured first over 663 clips and then over 3,595, where the trade is
 * stark. Marking every word that scores low misses little - 7.8% of the
 * mistakes - and accuses 6.3% of the recitations with nothing wrong with
 * them, because CTC fires for a frame or two per phoneme and one of them
 * landing badly is noise rather than a word. So this rule is not really
 * about finding mistakes; the alignment already finds them. It is about not
 * accusing people.
 *
 * Forgiving one weak word per ayah cuts those accusations to 1.8%, an ayah
 * being the unit it is measured on. Forgiving two cuts them to 1.2% and
 * misses more than half of every mistake, so one is the only usable setting.
 * Its cost is that a single genuinely dropped word is forgiven too, and that
 * cost is most of the remaining error: without the skip evidence below,
 * 67.8% of dropped and swapped words get through, almost every one of them a
 * clip whose one wrong word is the only weak word in its ayah.
 *
 * So the tolerance is withdrawn where there is independent evidence: a word
 * the live cursor watched the reciter go past. Two unrelated things have
 * then gone wrong with the same word - it was never reached, and its audio
 * does not support it - and a single wobble cannot produce both.
 *
 * Measured by `scripts/tasmee/skips.mjs`, which replays the cursor over the
 * same clips, counting only the dropped and swapped words - a reciter who
 * stops early is caught by not finishing, not by this rule, so folding those
 * clips in flatters it: **67.8% of mistakes missed falls to 19.7%, for 1.8%
 * of correct recitations wrongly flagged rising to 2.8%.** It is by a long
 * way the single largest thing the verdict has. On whole pages it is 22.9%
 * falling to 7.6%.
 *
 * The cost is small because of the score gate below, but it is not nothing -
 * the 663-clip set said the accusations did not move at all, and five times
 * the data says they do. Most of the new ones are hesitations, where the
 * cursor loses the thread and reports a skip on a word that was recited.
 *
 * Against marking every weak word, the pair - forgive one, then withdraw
 * the forgiveness on the cursor's evidence - costs 7.8% of mistakes missed
 * becoming 14.2%, and buys 6.3% of correct recitations accused becoming
 * 2.8%, over all 3,595 clips. That is a judgement rather than something the
 * data settles, and it goes this way because accusing a correct reciter is
 * the worst thing this feature can do: these are professional reciters, one
 * in sixteen is already too often, and a learner on a phone microphone will
 * fare worse. See docs/tasmee-improvements.md.
 */
/* Relative and extensioned so Node can load this unchanged: the bench in
   scripts/tasmee judges by the same rule the reader does. */
import { WORD_SAID_THRESHOLD } from "./ctcAlign.ts";
import { phonemeIdentity } from "./phonemeTokens.ts";

/**
 * Weak words an ayah is allowed before any of them is marked.
 *
 * One, measured: see above. Named because the bench reports it.
 */
export const WEAK_WORDS_TOLERATED = 1;

/**
 * The tolerance for a reader who would rather be told too often than missed.
 *
 * Zero: every word that scores low is marked. Measured over the same 3,595
 * clips, that is **7.8% of mistakes missed for 6.3% of correct recitations
 * accused**, against 15.2% and 2.3% at the default. Half the misses, and
 * nearly three times the accusations - one correct recitation in sixteen,
 * measured on professional reciters, so worse than that on anyone else.
 * Since the threshold was halved, on learners: 18.2% of correct recitations
 * with a word marked rather than 21.9%, the wrong word itself marked 62.0%
 * of the time rather than 62.4%.
 *
 * Offered rather than chosen because the curve has no right answer on it:
 * someone checking their own memorisation may well prefer being doubted to
 * being told they were perfect when they were not.
 */
export const STRICT_WEAK_WORDS_TOLERATED = 0;

/**
 * How little a skipped word must score for the cursor to be believed.
 *
 * The cursor is wrong sometimes - it reports a skip in 1,037 of 3,595 clips,
 * including correct ones - so its word alone is not enough to withdraw the
 * tolerance. A word that truly went unsaid holds frames that argue against
 * it and scores near nothing; the cursor's own mistakes land on words that
 * merely scored poorly, which is why a bound this tight separates them.
 *
 * The 663-clip sweep called this a plateau flat from 0 to 0.05. Over 3,595 it
 * is a smooth curve and 0.02 is a chosen point on it, not an edge the data
 * picks out: 0 misses 28.6% of mistakes at 1.8% wrongly flagged, 0.02 misses
 * 14.2% at 2.8%, 0.05 misses 13.3% at 3.2%, and 0.2 misses 11.4% at 4.1%.
 * Loosening it keeps buying mistakes, for accusations - 0.02 is where the
 * accusations are still rarer than one in thirty.
 */
export const SKIP_CONFIRMS_BELOW = 0.02;

/**
 * Which of an ayah's weak words to mark, once the ayah is not forgiven.
 *
 * Losing the tolerance says something in the ayah went wrong, not that every
 * word under the threshold did. Marking them all put the red on words that
 * were said: a dropped word drags its neighbours' scores down with it, and a
 * word between a quarter of the threshold and the threshold is as often a
 * correct word scored badly as a wrong one. So only the words that score near nothing, or that the cursor
 * saw skipped, are marked - and when there are none, the weakest alone.
 *
 * Measured with `scripts/tasmee/word-marks.mjs`, which checks *which* word is
 * marked against which word was wrong, on 15,000 clips of ordinary people
 * with words dropped, swapped, repeated and corrected. On the half of the
 * ayat not used to choose it, correctly said words marked fell from 22.6 to
 * 19.2 per 100 correct recitations and from 42.7 to 32.8 per 100 with a
 * mistake in them; the wrong word itself was marked 58.2% of the time rather
 * than 58.5%, and no mistake goes uncaught that was caught before, since an
 * ayah that is not forgiven still marks one word at least. Professional
 * reciters: 4.1 to 3.0 per 100, wrong word marked 37.6% rather than 38.5%.
 * Whole pages: 94 to 72 per 100.
 *
 * Strict mode keeps every weak word: a reader who asked to be doubted is
 * asking for exactly the marks this leaves out.
 *
 * Halved with `WORD_SAID_THRESHOLD` on 2026-11-01, keeping it a quarter of
 * the threshold, so the rule kept its shape at half the scale.
 */
const CLEARLY_UNSAID_BELOW = 0.025;

/**
 * Words that may be left unrecited at the end before a run is unfinished.
 *
 * One, because the closing word is the one the cursor can least be relied on
 * to complete: a reciter trailing off at the end of a page produces a last
 * word too quiet to match, and the bench's own clips are cut at quran.com's
 * word timestamps, which run short. Demanding it made the final word of a
 * clean recitation the reason the page was called unfinished.
 */
const UNRECITED_AT_END_TOLERATED = 1;
/**
 * And at the start, where two are allowed rather than one.
 *
 * The opening word fails for a reason the closing word does not: the model
 * will not always say a word's first phoneme, and the cursor cannot credit a
 * word it never heard the start of. Measured - a learner's ف was dropped on
 * every one of three attempts at فَوَيْلٌ, where 1,897 correct professional
 * clips have that symbol heard 99.2% of the time - so the first word going
 * unmatched says more about the recogniser than about the reciter. Tajweed
 * also joins words, so one unmatched unit here can cover two of the page's.
 *
 * Swept, and the asymmetry is what keeps the rule free: tolerating one at
 * each end catches 21 more mistakes for 14 more correct recitations accused
 * (14.1% missed at 2.9% flagged), while two at the start holds the figures
 * the two-ended rule replaced - 15.3% at 2.3%, against 15.4% at 2.2%. Three
 * and five are no better again. Accusing someone who recited correctly is
 * the worse failure, so the free setting wins; a reader who would rather be
 * told too often is what strict mode is for.
 *
 * Either way the failure this exists for is caught easily: someone who opens
 * halfway down a page leaves tens of words unrecited, not two.
 */
const UNRECITED_AT_START_TOLERATED = 2;

/**
 * Whether the reciter left out part of the page.
 *
 * Not the aligner's judgement to make, and not a question the scores can
 * answer. Measured over 3,595 clips, this is the whole of how `stopped-early`
 * is caught - the alignment marks 6 of 501 such clips and this rule catches
 * 496 - so a verdict that leaves it out reports an abandoned page as a clean
 * one.
 *
 * Both ends, because for a long time this asked about one. A reciter who
 * began halfway down the page and carried on to the last word reached the
 * end, so nothing here objected: the run was reported as complete and clean,
 * the bar read 100%, and the half they never recited was never judged. That
 * is the same failure as the abandoned page, in mirror image, and the same
 * answer - what was not recited cannot be called correct.
 *
 * Counted in words of the kind `SpokenWord` carries, so the caller passes how
 * many it expected and the span the cursor covered, not mushaf words.
 */
export function stoppedShort(
  expected: number,
  span: { from: number; to: number },
): boolean {
  return (
    span.from > UNRECITED_AT_START_TOLERATED ||
    expected - span.to > UNRECITED_AT_END_TOLERATED
  );
}

export interface ScoredWord {
  /** The ayah it belongs to, e.g. "1:7"; the tolerance is per ayah. */
  ayah: string;
  /** From `alignToExpected`; below `WORD_SAID_THRESHOLD` is weak. */
  score: number;
  /**
   * The cursor moved past it without hearing it. See `advanceTracker`.
   *
   * Only acted on together with a score under `SKIP_CONFIRMS_BELOW`.
   */
  skipped: boolean;
}

/**
 * Indexes of the words that should be marked, in the order given.
 *
 * `skipConfirmsBelow` is only passed by `scripts/tasmee/skips.mjs`, which
 * swept it; the app takes the value that sweep settled on.
 *
 * `weakWordsTolerated` is `WEAK_WORDS_TOLERATED` unless the reader has asked
 * to be corrected strictly, which is `STRICT_WEAK_WORDS_TOLERATED` - see
 * both constants for what that costs.
 */
export function findMisreadWords(
  words: readonly ScoredWord[],
  skipConfirmsBelow: number = SKIP_CONFIRMS_BELOW,
  weakWordsTolerated: number = WEAK_WORDS_TOLERATED,
): number[] {
  const byAyah = new Map<string, number[]>();
  words.forEach((word, index) => {
    const group = byAyah.get(word.ayah);
    if (group) group.push(index);
    else byAyah.set(word.ayah, [index]);
  });

  const misread: number[] = [];
  for (const indexes of byAyah.values()) {
    const weak = indexes.filter(
      (index) => words[index]!.score < WORD_SAID_THRESHOLD,
    );
    const isOvertaken = (index: number) =>
      words[index]!.skipped && words[index]!.score <= skipConfirmsBelow;
    const overtaken = weak.some(isOvertaken);
    if (weak.length <= weakWordsTolerated && !overtaken) continue;
    /* Strict means every weak word, which is what the reader asked for. */
    if (weakWordsTolerated === 0) {
      misread.push(...weak);
      continue;
    }
    const unsaid = weak.filter(
      (index) =>
        words[index]!.score < CLEARLY_UNSAID_BELOW || isOvertaken(index),
    );
    const weakest = weak.reduce((best, index) =>
      words[index]!.score < words[best]!.score ? index : best,
    );
    misread.push(...(unsaid.length > 0 ? unsaid : [weakest]));
  }

  return misread.sort((a, b) => a - b);
}

/** What the cursor saw at a word it could not follow the reciter through. */
export interface Stumbled {
  /** The phoneme identities heard instead, the first time. */
  heard: string[];
  /** How many times it stumbled there. */
  times: number;
}

/*
 * Stumbles that were the cursor's rather than the reciter's.
 *
 * Measured 2026-11-01 on every listed word that only a stumble put there,
 * against the words known to be wrong (the learner-mistakes set) and against
 * a second, larger recogniser (Muaalem) on 18,020 correct learner clips. Two
 * kinds turned out to be almost never a slip:
 *
 *   What was heard is largely the word itself - more than a third of it in
 *   order. The reciter was saying the word and the cursor did not keep up:
 *   2 of 61 such marks were on the wrong word.
 *
 *   Several stumbles at the start of the recitation, or outside what was
 *   recited. The cursor waiting through an isti'adha, a basmala or noise
 *   before the first word, re-reporting every six phonemes. Several stumbles
 *   *inside* the recitation are kept: that is a reciter carrying on into the
 *   twin of an ayah and coming back, the corrected slip this list exists for.
 *
 * Together, on the learner-mistakes test split (`word-marks.mjs`): correct
 * recitations with a word marked 12.7% -> 10.8%, correct words marked 25.6
 * -> 23.1 per 100 clips, mistakes marked on the wrong word 58.2% -> 57.7%.
 * Twin corrections listed 76.0% -> 75.4%; RetaSy's mistakes caught unchanged.
 */
const STUMBLES_AT_THE_EDGE_IGNORED = 3;

function commonInOrder(a: readonly string[], b: readonly string[]): number {
  const row = new Array<number>(b.length + 1).fill(0);
  for (const x of a) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j]!;
      row[j] = x === b[j - 1] ? diagonal + 1 : Math.max(above, row[j - 1]!);
      diagonal = above;
    }
  }
  return row[b.length]!;
}

/**
 * Whether a stumble at this word was the cursor's, and so not listed.
 *
 * Takes the page's spoken words and recited span, as `judgeRecitedPage` has
 * them; `scripts/tasmee/word-marks.mjs` replays the verdict with it.
 */
export function wasTheCursors(
  page: {
    spoken: readonly { locations: string[]; units: string[] }[];
    span: { from: number; to: number };
  },
  location: string,
  stumbled: Stumbled,
): boolean {
  const index = page.spoken.findIndex((word) =>
    word.locations.includes(location),
  );
  if (index === -1) return false;
  /* As the cursor compares them: identities, a held sound counted once. */
  const word: string[] = [];
  for (const unit of page.spoken[index]!.units) {
    const identity = phonemeIdentity(unit);
    if (identity !== word.at(-1)) word.push(identity);
  }
  if (3 * commonInOrder(stumbled.heard, word) > stumbled.heard.length) {
    return true;
  }
  const atTheEdge = index <= page.span.from || index >= page.span.to;
  return atTheEdge && stumbled.times >= STUMBLES_AT_THE_EDGE_IGNORED;
}
