/*
 * Scoring a recitation against the words the page expects.
 *
 * The decoder beside this one asks "what did he say?", takes the argmax of a
 * 251-way distribution per frame, throws the rest away, and compares the
 * resulting string to the expected one. We already know what the reciter is
 * supposed to say, so that answers a harder question than we need - and the
 * comparison it leaves us with is a blunt error rate. One wrong phoneme in a
 * ten-unit verse comes to 10%, under any threshold loose enough not to
 * punish a long verse, which is how a wrong ending gets waved through.
 *
 * This asks the question we actually have: "did he say *this*?" The audio is
 * forced onto the expected phoneme sequence with Viterbi, and each word is
 * scored by how well the frames assigned to it actually support it. A word
 * that was never said is not decoded into something plausible - it simply
 * holds frames that argue against it, and scores near zero.
 *
 * It also gives exact timings for free, because the path says which frames
 * belong to which word.
 */

/** Where a word's phonemes sit in the flattened expected sequence. */
export interface WordSpan {
  /** Index of the first label belonging to this word. */
  from: number;
  /** Index one past its last label. */
  to: number;
}

export interface WordScore {
  /**
   * How the word's weakest phoneme fared against its best rival.
   *
   * Not the mean probability over the word's frames - averaging lets one
   * wrong phoneme hide behind its neighbours, the same dilution that made an
   * error rate useless on a short verse. And not the bare probability of the
   * weakest phoneme either: the model is legitimately unsure at the joins
   * between sounds, and being unsure is not the same as being contradicted.
   *
   * So each phoneme is scored against whatever the model thought more
   * likely: `p(expected) / (p(expected) + p(best other))`. Half means a tie,
   * below half means something else was heard. The word takes its lowest.
   */
  score: number;
  /**
   * How each phoneme of the word fared, weakest first.
   *
   * Kept so the way a word's score is reached can be compared offline
   * against the fixtures without re-running the model, which is ten minutes
   * a time. `score` is one choice among these; see scripts/tasmee/rules.mjs.
   */
  supports: number[];
  /** Frames the alignment gave it; zero means it was never reached. */
  frames: number;
  startFrame: number;
  endFrame: number;
}

/** Log of zero, for states a path cannot have reached. */
const IMPOSSIBLE = -Infinity;

/**
 * Force `logProbs` onto the expected labels and score each word.
 *
 * `logProbs` is frame-major, `frames * vocab`. `labels` is the expected
 * phoneme sequence as token ids; `spans` says which stretch of it each word
 * owns. Returns one score per span, in order.
 */
export function alignToExpected(
  logProbs: Float32Array | Float64Array,
  frames: number,
  vocab: number,
  labels: readonly number[],
  spans: readonly WordSpan[],
  blankId: number,
  /**
   * Token id to identity class, from `identityClasses`. Sounds that differ
   * only in how long they are held share a class, so a reciter who holds a
   * madd longer than the label expected is not marked wrong for it.
   */
  classOf?: Int32Array,
  classCount?: number,
): WordScore[] {
  const empty = spans.map(() => ({
    score: 0,
    supports: [],
    frames: 0,
    startFrame: -1,
    endFrame: -1,
  }));
  if (frames === 0 || labels.length === 0) return empty;

  /*
   * CTC's extended sequence: a blank may appear before, between and after
   * every label, so the path has somewhere to wait while a phoneme is held.
   */
  const states = labels.length * 2 + 1;
  const extended = new Int32Array(states);
  for (let i = 0; i < labels.length; i += 1) extended[i * 2 + 1] = labels[i]!;
  for (let i = 0; i < states; i += 2) extended[i] = blankId;

  /*
   * Probability per identity class, so every length of a sound counts as that
   * sound. Computed once: the alignment and the scoring both read it.
   *
   * Only two things are ever read, so only they are kept. The path can stand
   * on blank and on the labels' own classes, and scoring a phoneme against
   * its best rival needs nothing but each frame's two strongest classes. The
   * whole frames-by-classes table was 236 doubles a frame, which on a long
   * run was tens of megabytes of a phone's worker spent on numbers nothing
   * looked at.
   */
  const classes = classOf ?? null;
  const width = classes ? (classCount ?? vocab) : vocab;
  const classOfToken = (token: number) => (classes ? classes[token]! : token);
  const blankClass = classOfToken(blankId);

  const column = new Int32Array(width).fill(-1);
  let columns = 0;
  for (const token of [blankId, ...labels]) {
    const into = classOfToken(token);
    if (column[into] === -1) {
      column[into] = columns;
      columns += 1;
    }
  }
  const classProbability = new Float64Array(frames * columns);
  /* Per frame, the strongest class but blank and the one after it. */
  const strongest = new Int32Array(frames * 2).fill(-1);
  const strength = new Float64Array(frames * 2);
  const sums = new Float64Array(width);
  for (let frame = 0; frame < frames; frame += 1) {
    sums.fill(0);
    const source = frame * vocab;
    for (let token = 0; token < vocab; token += 1) {
      sums[classOfToken(token)]! += Math.exp(logProbs[source + token]!);
    }
    const top = frame * 2;
    for (let into = 0; into < width; into += 1) {
      const value = sums[into]!;
      if (column[into] !== -1) {
        classProbability[frame * columns + column[into]!] = value;
      }
      if (into === blankClass) continue;
      if (value > strength[top]!) {
        strength[top + 1] = strength[top]!;
        strongest[top + 1] = strongest[top]!;
        strength[top] = value;
        strongest[top] = into;
      } else if (value > strength[top + 1]!) {
        strength[top + 1] = value;
        strongest[top + 1] = into;
      }
    }
  }
  const probabilityOf = (frame: number, token: number) =>
    classProbability[frame * columns + column[classOfToken(token)]!]!;
  const at = (frame: number, token: number) => {
    const probability = probabilityOf(frame, token);
    return probability > 0 ? Math.log(probability) : -40;
  };

  let previous = new Float64Array(states).fill(IMPOSSIBLE);
  let current = new Float64Array(states).fill(IMPOSSIBLE);
  // 0 stay, 1 from the state before, 2 from two before (skipping a blank).
  const back = new Uint8Array(frames * states);

  previous[0] = at(0, blankId);
  if (states > 1) previous[1] = at(0, extended[1]!);

  for (let frame = 1; frame < frames; frame += 1) {
    current.fill(IMPOSSIBLE);
    const row = frame * states;

    for (let state = 0; state < states; state += 1) {
      let best = previous[state]!;
      let choice = 0;

      if (state > 0 && previous[state - 1]! > best) {
        best = previous[state - 1]!;
        choice = 1;
      }
      /*
       * The two-step jump is only legal into a real phoneme, and only when
       * the one before it differs - otherwise `بب` would collapse into `ب`,
       * which is the whole reason CTC keeps blanks between repeats. Differs
       * as a class, because that is what the path scores: two lengths of one
       * madd side by side would otherwise share a single held sound.
       */
      if (
        state > 1 &&
        extended[state] !== blankId &&
        classOfToken(extended[state]!) !== classOfToken(extended[state - 2]!) &&
        previous[state - 2]! > best
      ) {
        best = previous[state - 2]!;
        choice = 2;
      }

      if (best === IMPOSSIBLE) continue;
      current[state] = best + at(frame, extended[state]!);
      back[row + state] = choice;
    }

    [previous, current] = [current, previous];
  }

  // A recitation may end on the last phoneme or on the blank after it.
  let state =
    states > 1 && previous[states - 2]! > previous[states - 1]!
      ? states - 2
      : states - 1;
  if (previous[state] === IMPOSSIBLE) return empty;

  /* Walk the path back, collecting each frame's probability for its label. */
  const labelTotals = new Float64Array(labels.length);
  const labelCounts = new Int32Array(labels.length);
  const counts = new Int32Array(spans.length);
  const starts = new Int32Array(spans.length).fill(-1);
  const ends = new Int32Array(spans.length).fill(-1);
  const spanOfLabel = new Int32Array(labels.length).fill(-1);
  for (let s = 0; s < spans.length; s += 1) {
    for (let label = spans[s]!.from; label < spans[s]!.to; label += 1) {
      spanOfLabel[label] = s;
    }
  }

  for (let frame = frames - 1; frame >= 0; frame -= 1) {
    if (extended[state] !== blankId) {
      const label = (state - 1) / 2;
      const span = spanOfLabel[label]!;
      if (span !== -1) {
        const own = classOfToken(extended[state]!);
        const expected = probabilityOf(frame, extended[state]!);
        const top = frame * 2;
        const rival =
          strongest[top] === own ? strength[top + 1]! : strength[top]!;
        const sum = expected + rival;
        labelTotals[label]! += sum === 0 ? 0 : expected / sum;
        labelCounts[label]! += 1;
        counts[span]! += 1;
        if (ends[span] === -1) ends[span] = frame;
        starts[span] = frame;
      }
    }
    if (frame === 0) break;
    state -= back[frame * states + state]!;
  }

  return spans.map((span, index) => {
    /*
     * The lower quartile of the word's phonemes, chosen by measurement.
     *
     * CTC is peaky: a label fires for a frame or two and blanks fill the
     * rest, so a word covering sixty frames of audio may own only six of
     * them, and one going to a rival is a wobble rather than a different
     * word. Taking the weakest phoneme rejected 61% of correct recitations;
     * the second weakest, which was a guess, missed 27% of mistakes. Swept
     * over 663 clips against nine ways of reducing a word to one number -
     * weakest, nth weakest, mean, trimmed means, median, share held up - the
     * lower quartile came out best: 22.2% missed at 4.2% wrongly flagged.
     * See scripts/tasmee/aggregate.mjs.
     *
     * Re-run over 3,595 ayah clips and 177 page clips against ten, the extra
     * ones being interpolated percentiles and "forgive the single worst
     * phoneme" - that last because a word whose score collapses usually has
     * exactly one unalignable phoneme and the rest near 1.0. It loses:
     * trimming buys 2.4 points of wrongly flagged for 9.4 points of missed
     * mistakes, because a word that was never said has no good phoneme
     * either. The lower quartile still wins on both sets.
     *
     * That comparison was run before the replay was corrected to score only
     * the recited span, so the margins are not exact; the ordering is wide
     * enough that it is unlikely to turn over, and it is worth re-running
     * once the cache is app-faithful. See docs/tasmee-improvements.md.
     */
    const supports: number[] = [];
    for (let label = span.from; label < span.to; label += 1) {
      // A phoneme the path never dwelt on was not pronounced at all.
      const held = labelCounts[label]!;
      supports.push(held === 0 ? 0 : labelTotals[label]! / held);
    }
    supports.sort((a, b) => a - b);
    const score =
      counts[index]! === 0
        ? 0
        : (supports[Math.floor((supports.length - 1) * 0.25)] ?? 0);

    return {
      score,
      supports,
      frames: counts[index]!,
      startFrame: starts[index]!,
      endFrame: ends[index]!,
    };
  });
}

/**
 * Below this a word was not said as the page has it.
 *
 * Swept rather than reasoned, alongside the score above: with the lower
 * quartile this is where missed mistakes fall furthest while wrongly-flagged
 * recitations stay under 5%, which is the trade a memorization helper wants.
 * One threshold replaces the error rate, the minimum-error floor and the
 * confidence floor the string comparison needed, because a margin does not
 * care how long the word was.
 */
export const WORD_SAID_THRESHOLD = 0.2;
