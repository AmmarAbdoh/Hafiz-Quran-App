import { describe, expect, it } from "vitest";
import type { PhonemeEmission } from "./ctcGreedy";
import {
  advanceTracker,
  createPhonemeTracker,
  expectNextPage,
  giveUpOnHeldWord,
  holdAt,
  recitedSpan,
  releaseHold,
  type ExpectedWord,
} from "./phonemeProgress";
import { phonemeIdentity } from "./phonemeTokens";

/** Al-Fatihah 1:2, in the units the recogniser actually emits. */
const FATIHAH_2: ExpectedWord[] = [
  { locations: ["1:2:1"], units: ["ءَ", "ل", "حَ", "م", "دُ"] },
  { locations: ["1:2:2"], units: ["لِ", "ل", "لَاا", "هِ"] },
  { locations: ["1:2:3"], units: ["رَ", "ب", "بِ"] },
  { locations: ["1:2:4"], units: ["ل", "عَاا", "لَ", "مِ", "ۦۦۦۦ", "ن"] },
];

const say = (
  symbols: readonly string[],
  confidence = 0.95,
): PhonemeEmission[] =>
  symbols.map((symbol, index) => ({
    id: index,
    symbol,
    confidence,
    seconds: index * 0.04,
  }));

const flat = (words: ExpectedWord[]) => words.flatMap((w) => w.units);

describe("following a recitation that is going well", () => {
  it("says after which sounds it moved on to the next word", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    const progress = advanceTracker(tracker, say(flat(FATIHAH_2)));

    /* The last sound of each of the four words, 5, 4, 3 and 6 long. */
    expect(progress.movedOnAfter).toEqual([4, 8, 11, 17]);
  });

  it("marks each word as it is finished and names the next one", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    const first = advanceTracker(tracker, say(FATIHAH_2[0]!.units));

    expect(first.completed).toEqual([{ locations: ["1:2:1"] }]);
    expect(first.currentLocations).toEqual(["1:2:2"]);
    expect(first.finished).toBe(false);
  });

  it("reaches the end of the passage with every word correct", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    const progress = advanceTracker(tracker, say(flat(FATIHAH_2)));

    expect(progress.completed.flatMap((w) => w.locations)).toEqual([
      "1:2:1",
      "1:2:2",
      "1:2:3",
      "1:2:4",
    ]);
    expect(progress.finished).toBe(true);
    expect(progress.currentLocations).toEqual([]);
  });

  /* Phonemes arrive a chunk at a time, so the position has to survive calls. */
  it("keeps its place across separate batches", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);
    const units = flat(FATIHAH_2);

    advanceTracker(tracker, say(units.slice(0, 3)));
    advanceTracker(tracker, say(units.slice(3, 9)));
    const last = advanceTracker(tracker, say(units.slice(9)));

    expect(last.finished).toBe(true);
  });
});

describe("following a recitation that is not", () => {
  /*
   * The cursor says where the reciter is, and nothing about how well.
   *
   * It used to judge each word as well, from the share of its units heard
   * wrongly - thresholds its own comment called never measured, and which
   * nothing ever read: the verdict comes from forced alignment over the
   * audio. What the cursor owes the reader instead is to stop, so these ask
   * for that.
   */
  it("holds at a word the reciter cannot produce", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    const progress = advanceTracker(
      tracker,
      say(["زَ", "ط", "قُ", "خ", "دُ", "صُ"]),
    );

    expect(progress.stumbles).not.toEqual([]);
    expect(progress.currentLocations).toEqual(["1:2:1"]);
    expect(progress.completed).toEqual([]);
  });

  /*
   * And says what was said instead, which is the only record of it.
   *
   * A word fumbled and then recited correctly scores well at the end of the
   * run - both attempts are in the audio and the alignment uses the good one
   * - so the verdict has nothing against it and the summary used to call the
   * whole page clean. The phonemes that fitted nowhere are the evidence the
   * fumble happened, and the nearest thing there is to a description of it.
   */
  it("says which word was stumbled at, and what was heard there", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    const progress = advanceTracker(
      tracker,
      say(["زَ", "ط", "قُ", "خ", "دُ", "صُ"]),
    );

    expect(progress.stumbles).toEqual([
      {
        wordIndex: 0,
        locations: ["1:2:1"],
        heard: ["زَ", "ط", "قُ", "خ", "دُ", "صُ"],
      },
    ]);
  });

  /* Said wrongly, then said right: the cursor carries on, and the stumble is
     still the only thing that saw it. */
  it("keeps the stumble even when the reciter recovers", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    const wrong = advanceTracker(
      tracker,
      say(["زَ", "ط", "قُ", "خ", "دُ", "صُ"]),
    );
    const right = advanceTracker(tracker, say(FATIHAH_2[0]!.units));

    expect(wrong.stumbles).toHaveLength(1);
    expect(right.completed).toEqual([{ locations: ["1:2:1"] }]);
    /* Reported once, when it happened - not again on every batch after. */
    expect(right.stumbles).toEqual([]);
  });

  /*
   * The model's own guidance: "the model was unsure" and "the reciter said
   * something different" look identical in a transcript, and only one of them
   * should ever be held against someone.
   */
  it("does not blame the reciter for phonemes the model doubted", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    const progress = advanceTracker(tracker, [
      ...say(["زَ", "ط", "قُ", "خ", "دُ", "صُ"], 0.1),
      ...say(FATIHAH_2[0]!.units),
    ]);

    expect(progress.stumbles).toEqual([]);
    expect(progress.completed).toEqual([{ locations: ["1:2:1"] }]);
  });

  /*
   * Both of these come from one Fatihah recited into a real microphone, where
   * the recogniser dropped a م it reports reliably for every professional
   * reciter in the bench. Each cost six seconds of being stuck, a mistake
   * tone, and the word revealed - for a word that had just been recited.
   */
  it("forgives one phoneme of a word that never arrived", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);
    /* رَبِّ without its doubled ب: رَ _ بِ */
    const withGap = ["رَ", "بِ"];

    advanceTracker(tracker, say(FATIHAH_2[0]!.units));
    advanceTracker(tracker, say(FATIHAH_2[1]!.units));
    const progress = advanceTracker(tracker, say(withGap));

    expect(progress.stumbles).toEqual([]);
    expect(progress.completed.flatMap((w) => w.locations)).toEqual(["1:2:3"]);
  });

  /* The missing phoneme being the word's last, with the next word's first
     arriving in its place - which is how عَلَيهِمۡ وَلَا presented. */
  it("forgives a missing last phoneme and moves on to the next word", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);
    const withoutLast = FATIHAH_2[0]!.units.slice(0, -1);

    const progress = advanceTracker(
      tracker,
      say([...withoutLast, ...FATIHAH_2[1]!.units]),
    );

    expect(progress.stumbles).toEqual([]);
    expect(progress.completed.flatMap((w) => w.locations)).toEqual([
      "1:2:1",
      "1:2:2",
    ]);
  });

  /*
   * The protection the forgiveness must not cost. Hearing the next word at
   * the *start* of this one is someone who has not said this word at all,
   * which is the one thing a memorization helper must never wave through.
   */
  it("does not forgive its way past a word that was never begun", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    const progress = advanceTracker(tracker, say(FATIHAH_2[1]!.units));

    expect(progress.completed).toEqual([]);
    expect(tracker.wordIndex).toBe(0);
  });

  /*
   * Reciting the next word but one. Being carried past a word is reported as
   * a skip, which is evidence the verdict uses; it is not the cursor saying
   * the word was heard and heard wrongly.
   */
  it("reports a word it was carried past rather than judging it", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    /* Words three and four: the third alone is shorter than the run of
       unplaceable phonemes the resync asks for before it will believe it. */
    const progress = advanceTracker(
      tracker,
      say([
        ...FATIHAH_2[0]!.units,
        ...FATIHAH_2[2]!.units,
        ...FATIHAH_2[3]!.units,
      ]),
    );

    expect(progress.skipped).toContain("1:2:2");
    expect(progress.completed.flatMap((w) => w.locations)).not.toContain(
      "1:2:2",
    );
  });
});

/*
 * The gap this closes: the cursor could only creep forward, so a reciter who
 * opened anywhere but the first word of the page was followed by nothing at
 * all, and the run simply sat there saying it was listening.
 */
describe("a reciter who is not where the page expects", () => {
  it("finds them further down the page and follows from there", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    // They begin at the third word, saying nothing of the first two.
    const progress = advanceTracker(
      tracker,
      say([...FATIHAH_2[2]!.units, ...FATIHAH_2[3]!.units]),
    );

    expect(progress.currentLocations).toEqual([]);
    expect(progress.completed.at(-1)).toEqual({ locations: ["1:2:4"] });
  });

  it("does not mark the words they never reached", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    const progress = advanceTracker(
      tracker,
      say([...FATIHAH_2[2]!.units, ...FATIHAH_2[3]!.units]),
    );

    expect(
      progress.completed.filter((word) => word.locations[0] === "1:2:2"),
    ).toEqual([]);
  });

  it("needs more than a single shared phoneme to move", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    // One unit of the last word, then nonsense: not enough to believe a jump.
    advanceTracker(tracker, say(["ن", "زز", "طط", "قق", "خخ", "صص", "ضض"]));

    expect(tracker.wordIndex).toBe(0);
  });
});

/*
 * Following along and memorising want opposite things from a word the reciter
 * cannot produce. Following wants to keep up; memorising wants to stop,
 * because the word you have forgotten is the one you have to say.
 */
describe("waiting for the word instead of moving past it", () => {
  it("does not advance when the word was not said", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    // The second word is skipped entirely; the cursor must not follow.
    const progress = advanceTracker(
      tracker,
      say([...FATIHAH_2[0]!.units, ...FATIHAH_2[2]!.units]),
    );

    expect(progress.currentLocations).toEqual(["1:2:2"]);
    expect(progress.completed.map((word) => word.locations[0])).toEqual([
      "1:2:1",
    ]);
  });

  it("says when something else was said in its place", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    const progress = advanceTracker(
      tracker,
      say(["زَ", "طط", "قُ", "خخ", "صص", "ضض", "ثث"]),
    );

    expect(progress.stumbles).not.toEqual([]);
    expect(progress.currentLocations).toEqual(["1:2:1"]);
  });

  it("stays quiet while the reciter is merely pausing", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    expect(advanceTracker(tracker, []).stumbles).toEqual([]);
  });

  it("moves on once the word is finally recited", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    advanceTracker(tracker, say(["زَ", "طط", "قُ", "خخ", "صص", "ضض"]));
    const progress = advanceTracker(tracker, say(FATIHAH_2[0]!.units));

    expect(progress.completed.map((word) => word.locations[0])).toEqual([
      "1:2:1",
    ]);
    expect(progress.currentLocations).toEqual(["1:2:2"]);
  });
});

/*
 * Waiting for a word must not become trapping someone at it. Both of these
 * were reported from real use: the cursor held mid-word so a retry threw the
 * first phonemes away, and reciting onwards left the reciter pinned forever.
 */
describe("getting past a word you got wrong", () => {
  const stickOnFirstWord = () => {
    const tracker = createPhonemeTracker(FATIHAH_2);
    advanceTracker(tracker, say(FATIHAH_2[0]!.units.slice(0, 2)));
    advanceTracker(tracker, say(["زز", "طط", "قق", "خخ", "صص", "ضض"]));
    return tracker;
  };

  it("starts the word again rather than resuming halfway through it", () => {
    const tracker = stickOnFirstWord();

    // Said in full, from the beginning, as anyone retrying would.
    const progress = advanceTracker(tracker, say(FATIHAH_2[0]!.units));

    expect(progress.completed.map((word) => word.locations[0])).toEqual([
      "1:2:1",
    ]);
    expect(progress.currentLocations).toEqual(["1:2:2"]);
  });

  it("follows a reciter who gives up and carries on", () => {
    const tracker = stickOnFirstWord();

    const progress = advanceTracker(tracker, say(FATIHAH_2[1]!.units));

    expect(progress.currentLocations).not.toEqual(["1:2:1"]);
  });
});

/*
 * Al-Fatihah 1:7, taken verbatim from the model's own phonemisation, because
 * the point of these is the lengths: `اااااا` is a six-harakat madd and
 * `ضضَ` a doubled consonant, and demanding those exact symbols from a live
 * microphone was what made الضالين impossible to get right. 26.5% of the
 * Quran's units and 76.9% of its words carry a length like this.
 */
const FATIHAH_7: ExpectedWord[] = [
  { locations: ["1:7:1"], units: ["صِ", "رَ", "اا", "طَ"] },
  { locations: ["1:7:2"], units: ["للَ", "ذِ", "ۦۦ", "نَ"] },
  { locations: ["1:7:3"], units: ["ءَ", "ن", "عَ", "م", "تَ"] },
  { locations: ["1:7:4"], units: ["عَ", "لَ", "ي", "هِ", "م"] },
  { locations: ["1:7:5"], units: ["غَ", "ي", "رِ"] },
  { locations: ["1:7:6"], units: ["ل", "مَ", "غ", "ضُ", "ۥۥ", "بِ"] },
  { locations: ["1:7:7"], units: ["عَ", "لَ", "ي", "هِ", "م"] },
  { locations: ["1:7:8"], units: ["وَ", "لَ"] },
  { locations: ["1:7:9"], units: ["ضضَ", "اااااا", "للِ", "ۦۦۦۦ", "ن"] },
];

describe("a reciter whose timing is their own", () => {
  it("accepts الضالين held for four harakat where the page labels six", () => {
    const tracker = createPhonemeTracker(FATIHAH_7);
    advanceTracker(tracker, say(flat(FATIHAH_7.slice(0, 8))));

    // The same sounds, neither madd the labelled length.
    const progress = advanceTracker(
      tracker,
      say(["ضضَ", "اااا", "للِ", "ۦۦ", "ن"]),
    );

    expect(progress.completed).toEqual([{ locations: ["1:7:9"] }]);
    expect(progress.finished).toBe(true);
  });

  it("accepts a madd held longer than the page labels", () => {
    const tracker = createPhonemeTracker(FATIHAH_7);

    const progress = advanceTracker(tracker, say(["صِ", "رَ", "اااااا", "طَ"]));

    expect(progress.currentLocations).toEqual(["1:7:2"]);
  });

  /*
   * Length is forgiven, doubling is not: the table writes both by repetition,
   * and إِيَاكَ for إِيَّاكَ is the classic slip that changes the meaning.
   */
  it("does not take a dropped shadda for the word", () => {
    const tracker = createPhonemeTracker([
      { locations: ["1:5:1"], units: ["ءِ", "ييَ", "اا", "كَ"] },
      { locations: ["1:5:2"], units: ["نَ", "ع", "بُ", "دُ"] },
    ]);

    const progress = advanceTracker(tracker, say(["ءِ", "يَ", "اا", "كَ"]));

    expect(progress.completed).toEqual([]);
    expect(progress.currentLocations).toEqual(["1:5:1"]);
  });

  /*
   * The greedy decoder suppresses a class repeated on consecutive frames, so
   * a doubled consonant reaches us once however carefully it was pronounced.
   * Waiting for it twice would hold the reciter at the word forever.
   */
  it("does not wait twice for a doubling the decoder emits once", () => {
    const tracker = createPhonemeTracker([
      { locations: ["2:21:9"], units: ["تَ", "تَ", "قُ", "ۥ", "ن"] },
    ]);

    const progress = advanceTracker(tracker, say(["تَ", "قُ", "ۥ", "ن"]));

    expect(progress.completed).toEqual([{ locations: ["2:21:9"] }]);
  });

  it("still hears a genuinely different word in the same place", () => {
    const tracker = createPhonemeTracker(FATIHAH_7);
    advanceTracker(tracker, say(flat(FATIHAH_7.slice(0, 8))));

    const progress = advanceTracker(
      tracker,
      say(["ك", "فَ", "رُ", "وا", "بِ", "هِ"]),
    );

    expect(progress.stumbles).not.toEqual([]);
    expect(progress.currentLocations).toEqual(["1:7:9"]);
  });
});

/*
 * `عَلَيهِم` occurs twice in this ayah, which is the shape that made resyncing
 * to the first match on the page wrong: a reciter on the second one was
 * dragged back to the first and then had to recite the middle of the verse
 * again to escape.
 */
describe("picking up a reciter who has moved", () => {
  it("resyncs to the occurrence nearest the cursor, not the first one", () => {
    const tracker = createPhonemeTracker(FATIHAH_7);
    // Up to and including the second عليهم, then stuck on ولا.
    advanceTracker(tracker, say(flat(FATIHAH_7.slice(0, 7))));
    advanceTracker(tracker, say(["زز", "طط", "قق", "خخ", "ثث", "صص"]));

    // They go back over the second عليهم, not the one at the top.
    const progress = advanceTracker(tracker, say(FATIHAH_7[6]!.units));

    expect(progress.currentLocations).toEqual(["1:7:8"]);
    expect(progress.skipped).toEqual([]);
  });

  it("reports the words it was carried past, without marking them", () => {
    const tracker = createPhonemeTracker(FATIHAH_7);
    advanceTracker(tracker, say(flat(FATIHAH_7.slice(0, 4))));

    // Straight to the closing words, abandoning the middle of the verse.
    const progress = advanceTracker(
      tracker,
      say([...FATIHAH_7[7]!.units, ...FATIHAH_7[8]!.units]),
    );

    expect(progress.skipped).toEqual(["1:7:5", "1:7:6", "1:7:7"]);
    // The run that confirmed the jump began at ولا, so that was recited.
    expect(progress.completed.map((word) => word.locations[0])).toContain(
      "1:7:8",
    );
  });

  it("reports nothing skipped when the recitation simply goes well", () => {
    const tracker = createPhonemeTracker(FATIHAH_7);

    const progress = advanceTracker(tracker, say(flat(FATIHAH_7)));

    expect(progress.skipped).toEqual([]);
    expect(progress.finished).toBe(true);
  });
});

/*
 * Going back over the last few words is how people memorise. The cursor used
 * to prefer any match ahead of it, however far, so a reciter repeating three
 * words was carried to wherever those sounds next occurred - revealing and
 * charging as skipped everything in between.
 */
describe("a reciter going back over what they just said", () => {
  // Its first two words come round again further down, as refrains do.
  const PAGE: ExpectedWord[] = [
    { locations: ["9:1:1"], units: ["قَ", "ا", "لَ"] },
    { locations: ["9:1:2"], units: ["رَ", "ب", "بُ"] },
    { locations: ["9:1:3"], units: ["كُ", "م"] },
    { locations: ["9:1:4"], units: ["ءِ", "ذ"] },
    { locations: ["9:1:5"], units: ["سَ", "مِ"] },
    { locations: ["9:1:6"], units: ["عَ", "ۥ"] },
    { locations: ["9:1:7"], units: ["قَ", "ا", "لَ"] },
    { locations: ["9:1:8"], units: ["رَ", "ب", "بُ"] },
    { locations: ["9:1:9"], units: ["نَ", "ا"] },
  ];

  it("follows them back instead of jumping to the next occurrence", () => {
    const tracker = createPhonemeTracker(PAGE);
    advanceTracker(tracker, say(flat(PAGE.slice(0, 3))));

    const repeat = advanceTracker(tracker, say(flat(PAGE.slice(0, 3))));

    expect(repeat.skipped).toEqual([]);
    expect(repeat.currentLocations).toEqual(["9:1:4"]);
  });

  it("does not call it a wrong attempt once they have caught up", () => {
    const tracker = createPhonemeTracker(PAGE);
    advanceTracker(tracker, say(flat(PAGE.slice(0, 3))));

    // Six phonemes ending exactly where the cursor waits.
    const repeat = advanceTracker(
      tracker,
      say(["لَ", "رَ", "ب", "بُ", "كُ", "م"]),
    );

    expect(repeat.stumbles).toEqual([]);
    expect(repeat.currentLocations).toEqual(["9:1:4"]);
  });

  it("does not charge words already passed when it later moves ahead", () => {
    const UNIQUE: ExpectedWord[] = [
      { locations: ["9:2:1"], units: ["سَ", "ب", "بِ"] },
      { locations: ["9:2:2"], units: ["حِ", "س", "مَ"] },
      { locations: ["9:2:3"], units: ["رَ", "بِ", "كَ"] },
      { locations: ["9:2:4"], units: ["ل", "ءَ", "ع"] },
      { locations: ["9:2:5"], units: ["لَ", "ذِ", "ۦ"] },
      { locations: ["9:2:6"], units: ["خَ", "لَ", "قَ"] },
      { locations: ["9:2:7"], units: ["فَ", "سَ", "وَ"] },
      { locations: ["9:2:8"], units: ["هُ", "دَ", "ى"] },
    ];
    const tracker = createPhonemeTracker(UNIQUE);
    advanceTracker(tracker, say(flat(UNIQUE.slice(0, 5))));
    // Back over the second and third words: the cursor follows them back.
    advanceTracker(tracker, say(flat(UNIQUE.slice(1, 3))));
    expect(tracker.wordIndex).toBe(3);

    // Then straight past the sixth, the only word they never said.
    const progress = advanceTracker(tracker, say(flat(UNIQUE.slice(6))));

    expect(progress.skipped).toEqual(["9:2:6"]);
    expect(progress.finished).toBe(true);
  });
});

/*
 * `مِنَ ٱلنَّاسِ` is one sound across the boundary - `وَمِنَ` then `نَاسِ` - and so
 * are 1.35% of the Quran's word boundaries. The decoder emits the shared
 * نَ once, so a cursor expecting it on both sides of the join waits for
 * something that cannot arrive.
 */
describe("a doubling that straddles two words", () => {
  const MIN_AN_NAS: ExpectedWord[] = [
    { locations: ["2:8:4"], units: ["وَ", "مِ", "نَ"] },
    { locations: ["2:8:5"], units: ["نَ", "اا", "سِ"] },
  ];

  it("crosses the join on a single emission", () => {
    const tracker = createPhonemeTracker(MIN_AN_NAS);

    const progress = advanceTracker(
      tracker,
      say(["وَ", "مِ", "نَ", "ا", "سِ"]),
    );

    expect(progress.finished).toBe(true);
    expect(progress.skipped).toEqual([]);
    expect(progress.completed.map((word) => word.locations[0])).toEqual([
      "2:8:4",
      "2:8:5",
    ]);
  });

  it("still crosses it when the decoder does send both", () => {
    const tracker = createPhonemeTracker(MIN_AN_NAS);

    const progress = advanceTracker(
      tracker,
      say(["وَ", "مِ", "نَ", "نَ", "ا", "سِ"]),
    );

    expect(progress.finished).toBe(true);
    expect(progress.skipped).toEqual([]);
  });
});

/*
 * Where a jump is believed from matters as much as where it lands. The run
 * that confirms a jump can end on a word's last unit, in which case the
 * cursor resumes at the *next* word - and charging the word it just heard the
 * end of as unsaid would accuse the reciter of dropping it.
 */
describe("what a jump reports as unsaid", () => {
  const PAGE: ExpectedWord[] = [
    { locations: ["2:1:1"], units: ["ءَ", "لِ", "ف"] },
    { locations: ["2:1:2"], units: ["لَاا", "م"] },
    { locations: ["2:1:3"], units: ["مِ", "ۦۦ", "م"] },
    { locations: ["2:1:4"], units: ["ذَ", "اا", "لِ", "ك"] },
  ];

  it("does not charge the word whose ending it heard", () => {
    const tracker = createPhonemeTracker(PAGE);

    /*
     * Six phonemes that fit nowhere at word one, the last three of which are
     * the whole of word three - so the run ends exactly on its last unit.
     */
    const progress = advanceTracker(
      tracker,
      say(["ص", "ض", "ط", "مِ", "ۦ", "م"]),
    );

    expect(progress.skipped).toEqual(["2:1:1", "2:1:2"]);
    expect(progress.currentLocations).toEqual(["2:1:4"]);
  });
});

/*
 * The invariant that was missing, and the bug it let through: a reciter said
 * a word, the run of phonemes confirming it moved the cursor past it, and the
 * word appeared in neither `completed` nor `skipped` - so nothing revealed it
 * and nothing marked it. It stayed blank on the page while the run was
 * reported clean.
 *
 * Every word the cursor leaves behind belongs to exactly one of the two.
 */
describe("accounting for every word the cursor passes", () => {
  const PAGE: ExpectedWord[] = [
    { locations: ["2:1:1"], units: ["ءَ", "لِ", "ف"] },
    { locations: ["2:1:2"], units: ["لَاا", "م"] },
    { locations: ["2:1:3"], units: ["مِ", "ۦۦ", "م"] },
    { locations: ["2:1:4"], units: ["ذَ", "اا", "لِ", "ك"] },
  ];

  /** Everything behind the cursor, however it got there. */
  const accountedFor = (progress: {
    completed: { locations: string[] }[];
    skipped: string[];
  }) => [
    ...progress.completed.flatMap((word) => word.locations),
    ...progress.skipped,
  ];

  it("reports a word whose own phonemes moved the cursor past it", () => {
    const tracker = createPhonemeTracker(PAGE);

    // The last three fit nowhere at word one and are the whole of word three,
    // so the confirming run ends exactly on its final unit.
    const progress = advanceTracker(
      tracker,
      say(["ص", "ض", "ط", "مِ", "ۦ", "م"]),
    );

    expect(progress.currentLocations).toEqual(["2:1:4"]);
    expect(accountedFor(progress)).toContain("2:1:3");
    // ...as recited, not as something they were carried past.
    expect(progress.skipped).not.toContain("2:1:3");
  });

  it("leaves no word behind the cursor unaccounted for", () => {
    for (const heard of [
      ["ص", "ض", "ط", "مِ", "ۦ", "م"],
      ["ءَ", "لِ", "ف", "ص", "ض", "ط", "ذَ", "ا", "لِ", "ك"],
      ["ص", "ض", "ط", "خ", "ث", "ح", "لَ", "م"],
      flat(PAGE),
    ]) {
      const tracker = createPhonemeTracker(PAGE);
      const progress = advanceTracker(tracker, say(heard));

      const behind = PAGE.slice(0, progress.wordIndex).flatMap(
        (word) => word.locations,
      );
      expect([...accountedFor(progress)].sort()).toEqual(behind.sort());
    }
  });
});

/*
 * A verdict judges what was recited. Scoring the whole page instead flagged
 * every word after a reciter who stopped early, and with more phonemes on
 * the page than the run had frames, no alignment existed at all.
 */
describe("what a verdict can judge", () => {
  it("covers nothing until a word has been recited", () => {
    const tracker = createPhonemeTracker(FATIHAH_7);
    advanceTracker(tracker, say(["زز", "طط"]));

    expect(recitedSpan(tracker)).toBeNull();
  });

  it("ends where the reciter stopped", () => {
    const tracker = createPhonemeTracker(FATIHAH_7);
    advanceTracker(tracker, say(flat(FATIHAH_7.slice(0, 3))));

    expect(recitedSpan(tracker)).toEqual({ from: 0, to: 3 });
  });

  it("begins where a reciter who opened mid-page began", () => {
    const tracker = createPhonemeTracker(FATIHAH_7);
    advanceTracker(tracker, say(flat(FATIHAH_7.slice(4, 6))));

    expect(recitedSpan(tracker)).toEqual({ from: 4, to: 6 });
  });
});

/*
 * Being stopped at a word, which is what "stop me at a mistake" has to mean.
 *
 * The cursor always waited at a word it had not heard - but the resync then
 * followed anyone who gave up and read on, which is the opposite of what a
 * reader who asked to be stopped wants. These ask for the hold, and for the
 * two ways out of it.
 */
describe("holding the reciter at a word", () => {
  const junk = ["زَ", "ط", "قُ", "خ", "دُ", "صُ"];

  it("will not follow the reciter on to the words after it", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);
    holdAt(tracker, advanceTracker(tracker, []).wordIndex);

    /* Six phonemes that fit nowhere, and then the next two words recited
       perfectly - which without the hold is a confirmed run the cursor
       follows, reporting the word it left as skipped. */
    advanceTracker(tracker, say(junk));
    const onward = advanceTracker(
      tracker,
      say([...FATIHAH_2[1]!.units, ...FATIHAH_2[2]!.units]),
    );

    expect(onward.currentLocations).toEqual(["1:2:1"]);
    expect(onward.completed).toEqual([]);
    expect(onward.skipped).toEqual([]);
    expect(onward.stumbles).not.toEqual([]);
  });

  /* The one way past it that does not need the reader to give up: say it. */
  it("lets the word itself past", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);
    holdAt(tracker, advanceTracker(tracker, []).wordIndex);

    advanceTracker(tracker, say(junk));
    const said = advanceTracker(tracker, say(FATIHAH_2[0]!.units));

    expect(said.completed).toEqual([{ locations: ["1:2:1"] }]);
    expect(said.currentLocations).toEqual(["1:2:2"]);
  });

  /*
   * Going back over the words before the one you are stuck on is how people
   * find it, so the hold is forward only - and the cursor still comes back.
   */
  it("still follows the reciter back over what they have already said", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    /* Three words in, so there is somewhere behind the cursor to go. */
    advanceTracker(tracker, say(flat(FATIHAH_2.slice(0, 3))));
    holdAt(tracker, advanceTracker(tracker, []).wordIndex);

    /* The first two words again, which is a run long enough to confirm and
       which ends behind the cursor rather than at it. */
    const back = advanceTracker(tracker, say(flat(FATIHAH_2.slice(0, 2))));

    expect(back.wordIndex).toBeLessThan(3);
    /* Nothing accused: those words were recited, twice over. */
    expect(back.skipped).toEqual([]);
  });

  /*
   * The hold survives going back, which is the whole reason the tracker keeps
   * the word rather than a flag.
   *
   * Reported by review: the provider used to keep its own copy and drop it
   * whenever the cursor left the held word - which going back over the line
   * before it does. The hold was released and the reciter could then read
   * straight past the word that had stopped them.
   */
  it("keeps holding after the reciter goes back over earlier words", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    advanceTracker(tracker, say(flat(FATIHAH_2.slice(0, 2))));
    holdAt(tracker, advanceTracker(tracker, []).wordIndex);
    advanceTracker(tracker, say(junk));

    /* Back over the two words before it, which the hold allows. */
    const back = advanceTracker(tracker, say(flat(FATIHAH_2.slice(0, 2))));
    expect(back.heldAt).toEqual(["1:2:3"]);

    /* And now reading on past it, which it does not. */
    const onward = advanceTracker(tracker, say(FATIHAH_2[3]!.units));
    expect(onward.heldAt).toEqual(["1:2:3"]);
    expect(onward.completed).toEqual([]);
    expect(onward.stumbles).not.toEqual([]);
  });

  /* Reciting the held word is still how you get past it, even arriving at it
     from behind - the run covers it, so it was said. */
  it("lets the held word past when the run covers it", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    advanceTracker(tracker, say(flat(FATIHAH_2.slice(0, 2))));
    holdAt(tracker, advanceTracker(tracker, []).wordIndex);
    advanceTracker(tracker, say(junk));
    const said = advanceTracker(tracker, say(FATIHAH_2[2]!.units));

    expect(said.heldAt).toBeNull();
    expect(said.completed).toEqual([{ locations: ["1:2:3"] }]);
  });

  /* Giving up from behind the held word leaves the cursor where it is: the
     words between are still being recited, not abandoned. */
  it("gives up on the held word without charging the ones before it", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    advanceTracker(tracker, say(flat(FATIHAH_2.slice(0, 3))));
    holdAt(tracker, advanceTracker(tracker, []).wordIndex);
    advanceTracker(tracker, say(junk));
    /* Back over the opening words, which leaves the cursor behind the hold. */
    advanceTracker(tracker, say(flat(FATIHAH_2.slice(0, 2))));

    expect(giveUpOnHeldWord(tracker)).toEqual(["1:2:4"]);
    const after = advanceTracker(tracker, []);
    expect(after.heldAt).toBeNull();
    expect(after.wordIndex).toBeLessThan(3);
    expect(after.skipped).toEqual([]);
  });

  it("follows them anywhere again once the hold is lifted", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);
    holdAt(tracker, advanceTracker(tracker, []).wordIndex);
    advanceTracker(tracker, say(junk));
    releaseHold(tracker);

    const onward = advanceTracker(
      tracker,
      say([...FATIHAH_2[1]!.units, ...FATIHAH_2[2]!.units]),
    );

    expect(onward.completed.flatMap((word) => word.locations)).toContain(
      "1:2:2",
    );
  });

  /*
   * The escape hatch. The recogniser does drop a phoneme a learner really
   * said, so without this, asking to be stopped would make the run a trap
   * whose only way out is abandoning the page.
   */
  it("hands back the word the reader gave up on, and moves past it", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);
    holdAt(tracker, advanceTracker(tracker, []).wordIndex);
    advanceTracker(tracker, say(junk));

    expect(giveUpOnHeldWord(tracker)).toEqual(["1:2:1"]);

    const after = advanceTracker(tracker, say(FATIHAH_2[1]!.units));
    expect(after.completed).toEqual([{ locations: ["1:2:2"] }]);
    /* Not reported as skipped as well: the reader was told about it by being
       stopped, and the caller records it as given up on. Reporting it here
       too would list one word under two different reasons. */
    expect(after.skipped).toEqual([]);
  });

  /* The span has to cover it, or the summary cannot mention it at all. */
  it("keeps a word given up on inside the stretch that gets judged", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    advanceTracker(tracker, say(FATIHAH_2[0]!.units));
    holdAt(tracker, advanceTracker(tracker, []).wordIndex);
    advanceTracker(tracker, say(junk));
    giveUpOnHeldWord(tracker);
    advanceTracker(tracker, say(FATIHAH_2[2]!.units));

    expect(recitedSpan(tracker)).toEqual({ from: 0, to: 3 });
  });
});

/*
 * Starting an ayah again, when the cursor is somewhere the reciter is not.
 *
 * From a saved run over Al-'Imran 3:10-3:15. At زُيِّنَ لِلنَّاسِ the reciter
 * said زُيِّنَ لِلَّذِينَ كَفَرُوا, which borrows قُل لِّلَّذِينَ كَفَرُوا from 3:12
 * thirty-one words earlier on the same page; the cursor followed it there and
 * had no way back - the only exit is a second confirmed run, which the hold
 * refuses and a desynced reciter does not produce. Twenty-eight seconds
 * stuck, fifty before the right ayah was current again.
 *
 * So the reciter gets a way to say where they are that does not depend on the
 * cursor agreeing: begin an ayah at its first word.
 */
describe("finding your place by starting an ayah again", () => {
  /* Two ayat with no phonemes in common, so a match can only be a restart. */
  const TWO_AYAT: ExpectedWord[] = [
    { locations: ["3:12:1"], units: ["قُ", "ل"] },
    { locations: ["3:12:2"], units: ["لِ", "ل", "لَ", "ذِ"] },
    { locations: ["3:12:3"], units: ["كَ", "فَ", "رُ"] },
    { locations: ["3:13:1"], units: ["قَ", "دڇ"] },
    { locations: ["3:13:2"], units: ["كَ", "اا", "نَ"] },
    { locations: ["3:14:1"], units: ["زُ", "ييِ", "نَ"] },
    { locations: ["3:14:2"], units: ["لِ", "ننننَ", "اا", "سِ"] },
    { locations: ["3:14:3"], units: ["حُ", "ب", "بُ"] },
  ];

  const startOf = (location: string) => {
    const at = TWO_AYAT.findIndex((word) => word.locations[0] === location);
    return flat(TWO_AYAT.slice(at, at + 3)).slice(0, 6);
  };

  it("moves the cursor to an ayah the reciter has begun again", () => {
    const tracker = createPhonemeTracker(TWO_AYAT);
    /* Stuck early, as the collision left it. */
    advanceTracker(tracker, say(flat(TWO_AYAT.slice(0, 2))));

    const restarted = advanceTracker(tracker, say(startOf("3:14:1")));

    expect(restarted.currentLocations).toEqual(["3:14:2"]);
  });

  /*
   * The hold is deliberately overridden: going back to the start of the ayah
   * is not reading past the word you were stopped at.
   */
  it("works even while the run is held at a word", () => {
    const tracker = createPhonemeTracker(TWO_AYAT);
    advanceTracker(tracker, say(flat(TWO_AYAT.slice(0, 2))));
    holdAt(tracker, advanceTracker(tracker, []).wordIndex);

    const restarted = advanceTracker(tracker, say(startOf("3:14:1")));

    expect(restarted.heldAt).toBeNull();
    expect(restarted.currentLocations).toEqual(["3:14:2"]);
  });

  /* The invariant the rest of the jumps keep: nothing silently left behind. */
  it("accounts for every word it moves the cursor over", () => {
    const tracker = createPhonemeTracker(TWO_AYAT);
    advanceTracker(tracker, say(flat(TWO_AYAT.slice(0, 2))));

    const restarted = advanceTracker(tracker, say(startOf("3:14:1")));

    const behind = TWO_AYAT.slice(0, restarted.wordIndex).flatMap(
      (word) => word.locations,
    );
    const accounted = [
      ...restarted.completed.flatMap((word) => word.locations),
      ...restarted.skipped,
      /* Already behind the cursor before the restart. */
      "3:12:1",
      "3:12:2",
    ];
    for (const location of behind) expect(accounted).toContain(location);
  });

  /* A couple of phonemes in common must not count as starting over. */
  it("is not triggered by a syllable that happens to match", () => {
    const tracker = createPhonemeTracker(TWO_AYAT);
    advanceTracker(tracker, say(flat(TWO_AYAT.slice(0, 2))));

    /* The first two units of 3:14 and then something else entirely. */
    const nearly = advanceTracker(
      tracker,
      say(["زُ", "ييِ", "ط", "ظ", "ص", "ض"]),
    );

    expect(nearly.currentLocations).not.toEqual(["3:14:2"]);
  });
});

/*
 * A word whose *first* phoneme the recogniser will not say.
 *
 * Found on a learner reciting al-Ma'un, who was stopped for twenty-six
 * seconds at فَوَيْلٌ لِّلْمُصَلِّينَ having recited it correctly three times over.
 * The model emitted every phoneme of it except the opening فَ - and none for
 * فَذَٰلِكَ earlier on the same page either - while over 1,897 correct
 * professional clips that symbol is heard 99.2% of the time. Replaying his
 * recording through the model in one pass gives the same answer, so it is his
 * ف being too light for the model rather than anything the live path did.
 *
 * Forgiving a phoneme mid-word was already allowed; at a word's first
 * position it was not, and the cursor could only wait.
 */
describe("a word whose opening phoneme never arrives", () => {
  /* The real units, from the model's own phonemisation. Tajweed joins the
     two page words, so the idghaam makes them one eleven-phoneme unit. */
  const MAUN_4: ExpectedWord[] = [
    {
      locations: ["107:4:1", "107:4:2"],
      units: [
        "فَ",
        "وَ",
        "ي",
        "لُ",
        "للِ",
        "ل",
        "مُ",
        "صَ",
        "للِ",
        "ۦۦۦۦ",
        "ن",
      ],
    },
    { locations: ["107:5:1"], units: ["ءَ", "للَ", "ذِ", "ۦۦ", "نَ"] },
  ];

  it("forgives it when the rest of the word arrives", () => {
    const tracker = createPhonemeTracker(MAUN_4);

    /* Exactly what the model emitted on his third attempt. */
    const progress = advanceTracker(tracker, say(MAUN_4[0]!.units.slice(1)));

    expect(progress.completed).toEqual([{ locations: ["107:4:1", "107:4:2"] }]);
    expect(progress.stumbles).toEqual([]);
  });

  /*
   * But a short word has to be said. Forgiving the first of two phonemes
   * leaves one, and a single sound in common turns up all over a page -
   * which is how a word nobody recited would get credited.
   */
  it("will not forgive the opening of a word too short to prove itself", () => {
    const tracker = createPhonemeTracker(FATIHAH_7);

    advanceTracker(tracker, say(flat(FATIHAH_7.slice(0, 7))));
    /* وَلَا is two phonemes, so dropping its وَ leaves nothing to earn it. */
    const progress = advanceTracker(tracker, say(FATIHAH_7[7]!.units.slice(1)));

    expect(progress.completed).toEqual([]);
    expect(progress.currentLocations).toEqual(["1:7:8"]);
  });

  /*
   * And never on a sound that could just as well be the next word's first.
   * That is exactly what a reciter who dropped this word sounds like, and it
   * is the hazard the old `unitIndex > 0` guard was written for.
   */
  it("refuses a sound that could belong to the next word instead", () => {
    const tracker = createPhonemeTracker([
      { locations: ["x:1"], units: ["فَ", "وَ", "ي", "لُ", "للِ"] },
      /* Opens with the same وَ that is the first word's second phoneme. */
      { locations: ["x:2"], units: ["وَ", "لَ", "اا"] },
    ]);

    const progress = advanceTracker(tracker, say(["وَ"]));

    expect(progress.completed).toEqual([]);
    expect(progress.currentLocations).toEqual(["x:1"]);
  });
});

/*
 * "I said it right the first time, it didn't move, so I thought I was wrong
 * and tried other versions." Al-Baqarah 2:32 as a learner said it: the تَ of
 * أَنتَ came through as ننننَ with تَ the runner-up at 28%, and the ل of
 * ٱلْعَلِيمُ not at all.
 */
describe("a word the recogniser half-misheard", () => {
  const ANTA_AL_ALIM: ExpectedWord[] = [
    { locations: ["2:32:10"], units: ["ءَ", "ںںں", "تَ"] },
    { locations: ["2:32:11"], units: ["ل", "عَ", "لِ", "ۦۦ", "مُ"] },
    { locations: ["2:32:12"], units: ["ل", "حَ", "كِ", "ۦۦۦۦ", "م"] },
  ];

  const misheard = (runnerUp: number): PhonemeEmission[] => [
    ...say(["ءَ", "ںںں"]),
    {
      id: 2,
      symbol: "ننننَ",
      confidence: 0.65,
      seconds: 0.08,
      alternatives: [{ symbol: "تَ", probability: runnerUp }],
    },
  ];

  it("takes the page's sound when the recogniser gave it as a close runner-up", () => {
    const tracker = createPhonemeTracker(ANTA_AL_ALIM, {
      acceptRunnerUpAt: 0.2,
    });

    const progress = advanceTracker(tracker, misheard(0.28));

    expect(progress.completed).toEqual([{ locations: ["2:32:10"] }]);
    expect(progress.currentLocations).toEqual(["2:32:11"]);
  });

  it("does not take a runner-up the recogniser barely considered", () => {
    const tracker = createPhonemeTracker(ANTA_AL_ALIM, {
      acceptRunnerUpAt: 0.2,
    });

    const progress = advanceTracker(tracker, misheard(0.08));

    expect(progress.completed).toEqual([]);
    expect(progress.currentLocations).toEqual(["2:32:10"]);
  });

  it("catches up once what follows is plainly the page", () => {
    const tracker = createPhonemeTracker(ANTA_AL_ALIM, { catchUp: true });

    /* تَ misheard, ل never heard, then ٱلْعَلِيمُ itself. */
    const progress = advanceTracker(
      tracker,
      say(["ءَ", "ںںں", "ننننَ", "عَ", "لِ", "ۦۦ", "مُ"]),
    );

    expect(progress.completed.flatMap((word) => word.locations)).toEqual([
      "2:32:10",
      "2:32:11",
    ]);
    expect(progress.skipped).toEqual([]);
    expect(progress.stumbles).toEqual([]);
    expect(progress.currentLocations).toEqual(["2:32:12"]);
  });

  it("waits, as it used to, with catching up turned off", () => {
    const tracker = createPhonemeTracker(ANTA_AL_ALIM, { catchUp: false });

    const progress = advanceTracker(
      tracker,
      say(["ءَ", "ںںں", "ننننَ", "عَ", "لِ", "ۦۦ", "مُ"]),
    );

    expect(progress.completed).toEqual([]);
    expect(progress.currentLocations).toEqual(["2:32:10"]);
  });

  /* Catching up looks past a misheard sound, never past a missing word. */
  it("reports a short word it moved over unheard as passed over", () => {
    const words: ExpectedWord[] = [
      { locations: ["x:1"], units: ["قَ", "اا", "لَ"] },
      { locations: ["x:2"], units: ["فِ"] },
      { locations: ["x:3"], units: ["ل", "ءَ", "ر", "ضِ"] },
    ];
    const tracker = createPhonemeTracker(words, { catchUp: true });

    /* قال, then straight to الأرض: فِ was never said. */
    const progress = advanceTracker(
      tracker,
      say(["قَ", "اا", "لَ", "ل", "ءَ", "ر"]),
    );

    expect(progress.skipped).toEqual(["x:2"]);
    expect(progress.completed.flatMap((word) => word.locations)).toEqual([
      "x:1",
    ]);
  });

  it("does not carry a held reciter past a word they did not say", () => {
    const words: ExpectedWord[] = [
      { locations: ["x:1"], units: ["قَ", "اا", "لَ"] },
      { locations: ["x:2"], units: ["فِ"] },
      { locations: ["x:3"], units: ["ل", "ءَ", "ر", "ضِ"] },
    ];
    const tracker = createPhonemeTracker(words, { catchUp: true });
    advanceTracker(tracker, say(["قَ", "اا", "لَ"]));
    holdAt(tracker, 1);

    const progress = advanceTracker(tracker, say(["ل", "ءَ", "ر"]));

    expect(progress.skipped).toEqual([]);
    expect(progress.currentLocations).toEqual(["x:2"]);
  });
});

/*
 * The last word of a page, said and faded: its closing sound is quiet at a
 * pause and often never emitted. Carrying on into the next page used to
 * leave the cursor waiting for it, so the page never turned.
 */
describe("the end of a passage the reciter carries on from", () => {
  const LAST: ExpectedWord[] = [
    { locations: ["101:1:1"], units: ["ءَ", "ل", "قَ", "ا", "رِ", "عَ", "ه"] },
  ];

  it("finishes the last word when the next sounds belong elsewhere", () => {
    const tracker = createPhonemeTracker(LAST, { lastWordTailForgiven: 2 });

    advanceTracker(tracker, say(["ءَ", "ل", "قَ", "ا", "رِ", "عَ"]));
    /* The next ayah begins: مَا. */
    const progress = advanceTracker(tracker, say(["مَ", "ا"]));

    expect(progress.completed).toEqual([{ locations: ["101:1:1"] }]);
    expect(progress.finished).toBe(true);
    expect(progress.stumbles).toEqual([]);
  });

  it("does not finish a last word barely begun", () => {
    const tracker = createPhonemeTracker(LAST, { lastWordTailForgiven: 2 });

    advanceTracker(tracker, say(["ءَ", "ل"]));
    const progress = advanceTracker(tracker, say(["مَ", "ا"]));

    expect(progress.finished).toBe(false);
  });
});

/*
 * "I said يا بني إسرائيل اذكروا نعمتي التي أنعمت عليكم and went on with the
 * other ayah's ending, and it jumped there and skipped the whole page."
 * Al-Baqarah 2:40 and 2:47 share their opening and then part.
 */
describe("a reciter who slips into an ayah's twin", () => {
  const opening = [["يَاابَنِۦۦۦۦ"], ["ءِ", "س", "رَ"], ["ذ", "كُ", "رُ"]];
  const ayah = (n: number, ending: string[][]): ExpectedWord[] =>
    [...opening, ...ending].map((units, i) => ({
      locations: [`2:${n}:${i + 1}`],
      units,
    }));
  const between: ExpectedWord[] = Array.from({ length: 10 }, (_, i) => ({
    locations: [`2:41:${i + 1}`],
    units: ["قِ", `${i}`],
  }));
  const PAGE = [
    ...ayah(40, [
      ["وَ", "ءَ", "و", "فُ"],
      ["بِ", "عَ", "ه", "دِ"],
    ]),
    ...between,
    ...ayah(47, [
      ["وَ", "ءَ", "ننننِ", "ۦۦ"],
      ["فَ", "ضضَ", "ل", "تُ", "كُ", "م"],
      ["عَ", "لَ"],
    ]),
  ];

  it("holds at the word they should have said, and hears what they said", () => {
    const tracker = createPhonemeTracker(PAGE);
    advanceTracker(tracker, say(flat(PAGE.slice(0, 3))));

    /* 2:47's ending, said where 2:40's belongs. */
    const progress = advanceTracker(
      tracker,
      say(["ننننِ", "ۦۦ", "فَ", "ضضَ", "ل", "تُ", "كُ", "م", "عَ", "لَ"]),
    );

    expect(progress.skipped).toEqual([]);
    expect(progress.currentLocations).toEqual(["2:40:4"]);
    expect(progress.stumbles[0]?.locations).toEqual(["2:40:4"]);
  });

  /* The other way round: on 2:47, going on with 2:40's وَأَوْفُوا۟ بِعَهْدِى. */
  const AT_47 = PAGE.findIndex((word) => word.locations[0] === "2:47:4");
  const reciteUpTo47 = (tracker: ReturnType<typeof createPhonemeTracker>) => {
    advanceTracker(tracker, say(flat(PAGE.slice(0, 5))));
    advanceTracker(tracker, say(flat(PAGE.slice(5, AT_47))));
  };

  /* Further back than the ayah before 2:47, so not followed: what was said
     there is reported at once, at the word the reciter was waiting at. */
  it("reports a slip back into a twin far behind as said in place", () => {
    const tracker = createPhonemeTracker(PAGE);
    reciteUpTo47(tracker);

    /* 2:40's ending... */
    const slipped = advanceTracker(
      tracker,
      say(["و", "فُ", "بِ", "عَ", "ه", "دِ"]),
    );
    /* ...then 2:47 begun again and said right. */
    const back = advanceTracker(tracker, say(flat(PAGE.slice(AT_47 - 3))));

    expect(slipped.stumbles.map((stumble) => stumble.locations)).toEqual([
      ["2:47:4"],
    ]);
    expect(back.finished).toBe(true);
  });

  it("does not follow a reciter back further than the ayah before", () => {
    const tracker = createPhonemeTracker(PAGE);
    reciteUpTo47(tracker);

    const repeated = advanceTracker(tracker, [
      ...say(["و", "فُ", "بِ", "عَ", "ه", "دِ"]),
      ...say(flat(PAGE.slice(5))),
    ]);

    expect(repeated.stumbles.length).toBeGreaterThan(0);
    expect(repeated.stumbles[0]?.locations).toEqual(["2:47:4"]);
  });

  it("still follows a reciter who arrives at the far ayah by its own words", () => {
    const tracker = createPhonemeTracker(PAGE);
    advanceTracker(tracker, say(flat(PAGE.slice(0, 3))));

    /* The words before 2:47's ending are the page's 2:41, not 2:40's opening. */
    const progress = advanceTracker(
      tracker,
      say(["قِ", "9", "يَاابَنِۦۦۦۦ", "ءِ", "س", "رَ", "ذ", "كُ", "رُ"]),
    );

    expect(progress.stumbles).toEqual([]);
  });
});

/*
 * المدثر 74:19-20, as a reciter's run heard it: فَقُتِلَ كَيْفَ with the
 * closing vowel of قُتِلَ gone, which held the cursor at the first word
 * until 74:20 lit 74:19's words.
 */
describe("a closing vowel the recogniser did not hear", () => {
  const QUTILA: ExpectedWord[] = [
    { locations: ["74:19:1"], units: ["فَ", "قُ", "تِ", "لَ"] },
    { locations: ["74:19:2"], units: ["كَ", "ي", "فَ"] },
  ];

  it("finishes a word whose last letter came without its vowel", () => {
    const tracker = createPhonemeTracker(QUTILA);

    const progress = advanceTracker(tracker, say(["فَ", "قُ", "تِ", "ل"]));

    expect(progress.completed).toEqual([{ locations: ["74:19:1"] }]);
    expect(progress.currentLocations).toEqual(["74:19:2"]);
  });

  it("still waits when the last letter is a different one", () => {
    const tracker = createPhonemeTracker(QUTILA);

    const progress = advanceTracker(tracker, say(["فَ", "قُ", "تِ", "ن"]));

    expect(progress.completed).toEqual([]);
  });

  /* Two bare letters inside it: the one sound a word may miss is used up,
     and the excuse does not stretch to the second. */
  it("excuses only the last sound of a word, not one inside it", () => {
    const tracker = createPhonemeTracker(QUTILA);

    const progress = advanceTracker(tracker, say(["فَ", "ق", "ت", "لَ"]));

    expect(progress.completed).toEqual([]);
  });

  it("waits for the vowel with the excuse turned off", () => {
    const tracker = createPhonemeTracker(QUTILA, {
      finalVowelForgiven: false,
    });

    const progress = advanceTracker(tracker, say(["فَ", "قُ", "تِ", "ل"]));

    expect(progress.completed).toEqual([]);
  });
});

/*
 * المدثر 74:11, as the same run heard it: three of ذَرْنِي's four sounds,
 * then وَمَ for وَمَنْ and لَقْتُ for خَلَقْتُ, until وَحِيدًا confirmed where
 * the reciter was. The jump used to report ذَرْنِي and وَمَنْ unsaid.
 */
describe("what a jump forward counts as said", () => {
  const DHARNI: ExpectedWord[] = [
    { locations: ["74:11:1"], units: ["ذَ", "ر", "نِ", "ۦۦ"] },
    { locations: ["74:11:2"], units: ["وَ", "مَ", "ن"] },
    { locations: ["74:11:3"], units: ["خَ", "لَ", "قڇ", "تُ"] },
    { locations: ["74:11:4"], units: ["وَ", "حِ", "ۦۦ", "دَ", "اا"] },
  ];

  it("credits the words whose sounds were mostly heard on the way", () => {
    const tracker = createPhonemeTracker(DHARNI);

    const progress = advanceTracker(
      tracker,
      say(["ذَ", "ر", "نِ", "وَ", "مَ", "لَ", "قڇ", "تُ", "وَ"]),
    );

    expect(progress.completed.flatMap((w) => w.locations)).toEqual([
      "74:11:1",
      "74:11:2",
      "74:11:3",
    ]);
    expect(progress.skipped).toEqual([]);
  });

  /*
   * Less than half heard is still for the verdict to judge, with the audio.
   * لِلَّهِ with only its ل heard, then رَبِّ ٱلْ confirming where they are.
   */
  it("still reports a word that was barely heard as passed over", () => {
    const tracker = createPhonemeTracker(FATIHAH_2);

    advanceTracker(tracker, say(FATIHAH_2[0]!.units));
    const progress = advanceTracker(
      tracker,
      say(["سِ", "ل", "رَ", "ب", "بِ", "ل"]),
    );

    expect(progress.skipped).toEqual(["1:2:2"]);
    expect(progress.completed).toEqual([{ locations: ["1:2:3"] }]);
  });
});

/*
 * Saad 38:61 in hadr, as the recogniser heard it: whole sounds of each word
 * dropped, rarely three in a row of the page, and none misheard.
 */
describe("catching up with a recogniser that drops sounds", () => {
  const QALU: ExpectedWord[] = [
    { locations: ["38:61:1"], units: ["قَ", "اا", "لُ", "ۥۥ"] },
    { locations: ["38:61:2"], units: ["رَ", "ببَ", "نَ", "اا"] },
    { locations: ["38:61:3"], units: ["مَ", "ںںں", "قَ", "ددَ", "مَ"] },
    { locations: ["38:61:4"], units: ["لَ", "نَ", "اا"] },
    { locations: ["38:61:5"], units: ["هَ", "اا", "ذَ", "اا"] },
  ];

  it("lets three sounds go unheard where they were dropped", () => {
    const tracker = createPhonemeTracker(QALU);

    const progress = advanceTracker(tracker, say(["قَ", "رَ", "ببَ", "نَ"]));

    /* Inside رَبَّنَا, waiting for its last sound. One sound of قَالُوا is
       not enough to call it said; the verdict has the audio for that. */
    expect(progress.currentLocations).toEqual(["38:61:2"]);
    expect(progress.skipped).toEqual(["38:61:1"]);
    expect(advanceTracker(tracker, say(["اا"])).completed).toEqual([
      { locations: ["38:61:2"] },
    ]);
  });

  it("waits for them when a dropped sound costs a whole edit", () => {
    const tracker = createPhonemeTracker(QALU, { catchUpGapCost: 1 });

    const progress = advanceTracker(tracker, say(["قَ", "رَ", "ببَ", "نَ"]));

    expect(progress.currentLocations).toEqual(["38:61:1"]);
  });

  it("finds a reciter two words ahead with nothing three in a row", () => {
    const tracker = createPhonemeTracker(QALU);
    advanceTracker(tracker, say([...QALU[0]!.units, "رَ"]));

    const progress = advanceTracker(
      tracker,
      say(["مَ", "قَ", "مَ", "لَ", "اا", "هَ"]),
    );

    expect(progress.completed.flatMap((w) => w.locations)).toEqual([
      "38:61:3",
      "38:61:4",
    ]);
    expect(progress.skipped).toEqual(["38:61:2"]);
    expect(progress.stumbles).toEqual([]);
    expect(progress.currentLocations).toEqual(["38:61:5"]);
  });

  it("stumbles there instead with catching up ahead turned off", () => {
    const tracker = createPhonemeTracker(QALU, { catchUpAhead: false });
    advanceTracker(tracker, say([...QALU[0]!.units, "رَ"]));

    const progress = advanceTracker(
      tracker,
      say(["مَ", "قَ", "مَ", "لَ", "اا", "هَ"]),
    );

    expect(progress.stumbles).toHaveLength(1);
    expect(progress.currentLocations).toEqual(["38:61:2"]);
  });

  it("never carries a reciter past a word with nothing of it heard", () => {
    const tracker = createPhonemeTracker(QALU);
    advanceTracker(tracker, say(QALU[0]!.units));

    /* رَبَّنَا left out altogether, then 38:61:3-5 with sounds dropped. */
    const progress = advanceTracker(
      tracker,
      say(["مَ", "قَ", "مَ", "لَ", "اا", "هَ"]),
    );

    expect(progress.completed).toEqual([]);
    expect(progress.currentLocations).toEqual(["38:61:2"]);
  });
});

/*
 * Faatir 35:30 to 35:31 across a page: the last word of the page misheard,
 * the reciter on into the next. The cursor used to wait at the foot of the
 * page for the rest of the run.
 */
describe("a reciter carried on to the next page", () => {
  const PAGE: ExpectedWord[] = [
    { locations: ["35:29:16"], units: ["لَ", "ن", "تَ", "بُ", "ۥۥ", "ر"] },
    {
      locations: ["35:30:1"],
      units: ["لِ", "يُ", "وَ", "ففِ", "يَ", "هُ", "م"],
    },
    {
      locations: ["35:30:2"],
      units: ["غَ", "فُ", "ۥۥ", "رُ", "ںںں", "شَ", "كُ", "ۥۥۥۥ", "ر"],
    },
  ];
  const NEXT: ExpectedWord[] = [
    { locations: ["35:31:1"], units: ["وَ", "للَ", "ذِ", "ۦۦ"] },
    { locations: ["35:31:2"], units: ["ءَ", "و", "حَ", "ي", "نَ", "اا"] },
  ];
  const OPENING = ["وَ", "للَ", "ذِ", "ۦۦ", "ءَ", "و"];

  it("finishes the page and hands the next one what it heard", () => {
    const tracker = createPhonemeTracker(PAGE);
    expectNextPage(tracker, NEXT);
    advanceTracker(tracker, say([...PAGE[0]!.units, ...PAGE[1]!.units]));

    const progress = advanceTracker(tracker, say(OPENING));

    expect(progress.finished).toBe(true);
    expect(progress.skipped).toEqual(["35:30:2"]);
    expect(progress.stumbles).toEqual([]);
    expect(progress.carriedOver.map((unit) => unit.symbol)).toEqual([
      "وَ",
      "للَ",
      "ذِ",
      "ۦۦ",
      "ءَ",
      "و",
    ]);

    const next = createPhonemeTracker(NEXT);
    const carried = advanceTracker(next, progress.carriedOver);
    expect(carried.completed).toEqual([{ locations: ["35:31:1"] }]);
    expect(carried.currentLocations).toEqual(["35:31:2"]);
  });

  it("stays on the page without knowing what comes next", () => {
    const tracker = createPhonemeTracker(PAGE);
    advanceTracker(tracker, say([...PAGE[0]!.units, ...PAGE[1]!.units]));

    const progress = advanceTracker(tracker, say(OPENING));

    expect(progress.finished).toBe(false);
    expect(progress.currentLocations).toEqual(["35:30:2"]);
  });

  it("hands on what it heard as it was heard, and the rest of the batch", () => {
    const tracker = createPhonemeTracker(PAGE);
    expectNextPage(tracker, NEXT);
    advanceTracker(tracker, say([...PAGE[0]!.units, ...PAGE[1]!.units]));
    const heard = say([...OPENING, "حَ", "ي", "نَ"]);
    /* Too doubtful for the stray run, and still something the next page
       may want. */
    heard.splice(3, 0, { id: 99, symbol: "ٮ", confidence: 0.3, seconds: 9 });

    const progress = advanceTracker(tracker, heard);

    expect(progress.finished).toBe(true);
    expect(progress.carriedOver).toEqual(heard);
    const next = advanceTracker(
      createPhonemeTracker(NEXT),
      progress.carriedOver,
    );
    expect(next.completed).toEqual([{ locations: ["35:31:1"] }]);
    expect(next.stumbles).toEqual([]);
  });

  it("hands on the sounds after a last word heard to the end", () => {
    const tracker = createPhonemeTracker(PAGE);
    advanceTracker(tracker, say([...PAGE[0]!.units, ...PAGE[1]!.units]));

    const progress = advanceTracker(
      tracker,
      say([...PAGE[2]!.units, "وَ", "للَ"]),
    );

    expect(progress.finished).toBe(true);
    expect(progress.carriedOver.map((unit) => unit.symbol)).toEqual([
      "وَ",
      "للَ",
    ]);
  });

  describe("a last word faded at its end", () => {
    const fadedThen = (next: string) => {
      const tracker = createPhonemeTracker(PAGE);
      expectNextPage(tracker, NEXT);
      advanceTracker(tracker, say([...PAGE[0]!.units, ...PAGE[1]!.units]));
      return advanceTracker(
        tracker,
        say([...PAGE[2]!.units.slice(0, 7), next]),
      );
    };

    it("hands on the sound that finished it when it opens the next page", () => {
      const progress = fadedThen("وَ");

      expect(progress.finished).toBe(true);
      expect(progress.carriedOver.map((unit) => unit.symbol)).toEqual(["وَ"]);
    });

    /* As likely its own ending misheard, and a stray sound would stop the
       next page forgiving its opening. */
    it("drops it when it does not", () => {
      const progress = fadedThen("ل");

      expect(progress.finished).toBe(true);
      expect(progress.carriedOver).toEqual([]);
    });
  });

  /* Short of the page's last ayah, the next page's opening is a reciter
     who lost their place, and the resync and the stumble are for that. */
  it("turns only once the reciter has reached the page's last ayah", () => {
    const tracker = createPhonemeTracker([
      { locations: ["35:29:14"], units: ["تِ", "جَاا", "رَ", "تَ"] },
      ...PAGE,
    ]);
    expectNextPage(tracker, NEXT);
    advanceTracker(tracker, say(["تِ", "جَاا", "رَ", "تَ"]));

    const progress = advanceTracker(tracker, say(OPENING));

    expect(progress.finished).toBe(false);
    expect(progress.carriedOver).toEqual([]);
  });

  /* Opening with the next page is starting somewhere else, which the
     search for an ayah begun off the page answers. */
  it("never turns a page nothing was recited on", () => {
    const tracker = createPhonemeTracker(PAGE.slice(1));
    expectNextPage(tracker, NEXT);

    const progress = advanceTracker(tracker, say(OPENING));

    expect(progress.finished).toBe(false);
    expect(progress.carriedOver).toEqual([]);
  });

  it("turns even when three of the sounds fit a few words back", () => {
    const tracker = createPhonemeTracker([
      { locations: ["35:30:1"], units: ["لِ", "ۦۦ", "ءَ", "و", "م"] },
      { locations: ["35:30:2"], units: ["غَ", "فُ", "ر"] },
      { locations: ["35:30:3"], units: ["شَ", "كُ", "ۥۥۥۥ", "ر"] },
    ]);
    expectNextPage(tracker, NEXT);
    advanceTracker(tracker, say(["لِ", "ۦۦ", "ءَ", "و", "م", "غَ", "فُ", "ر"]));

    const progress = advanceTracker(tracker, say(OPENING));

    expect(progress.finished).toBe(true);
    expect(progress.skipped).toEqual(["35:30:3"]);
  });

  it("does not carry a held reciter past the word they are stopped at", () => {
    const tracker = createPhonemeTracker(PAGE);
    expectNextPage(tracker, NEXT);
    advanceTracker(tracker, say([...PAGE[0]!.units, ...PAGE[1]!.units]));
    holdAt(tracker, 2);

    const progress = advanceTracker(tracker, say(OPENING));

    expect(progress.finished).toBe(false);
    expect(progress.heldAt).toEqual(["35:30:2"]);
  });
});

describe("a doubling across a word boundary, heard unusually", () => {
  const MIN_AN: ExpectedWord[] = [
    { locations: ["1:1:1"], units: ["وَ", "مِ", "نَ"] },
    { locations: ["1:1:2"], units: ["نَ", "اا"] },
    { locations: ["1:1:3"], units: ["قَ", "دْ", "رُ"] },
  ];

  /* The decoder merges the two sounds whether or not it heard the first's
     vowel, so one bare ن is both. */
  it("takes one sound for both when the first lost its vowel", () => {
    const progress = advanceTracker(
      createPhonemeTracker(MIN_AN),
      say(["وَ", "مِ", "ن", "اا", "قَ", "دْ", "رُ"]),
    );

    expect(progress.completed.flatMap((word) => word.locations)).toEqual([
      "1:1:1",
      "1:1:2",
      "1:1:3",
    ]);
    expect(progress.skipped).toEqual([]);
  });

  it("takes one sound for both when it came as a runner-up", () => {
    const heard = say(["وَ", "مِ", "مَ", "اا", "قَ", "دْ", "رُ"]);
    heard[2] = {
      ...heard[2]!,
      confidence: 0.65,
      alternatives: [{ symbol: "نَ", probability: 0.28 }],
    };

    const progress = advanceTracker(createPhonemeTracker(MIN_AN), heard);

    expect(progress.completed.flatMap((word) => word.locations)).toEqual([
      "1:1:1",
      "1:1:2",
      "1:1:3",
    ]);
    expect(progress.skipped).toEqual([]);
  });

  /* No doubling at all: the runner-up closed this word, and the winner
     was the next one opening. */
  it("takes the next word's opening from a winner beaten to this word's end", () => {
    const heard = say(["كَ", "تَ", "مَ", "ن", "قَ", "دْ", "رُ"]);
    heard[2] = {
      ...heard[2]!,
      confidence: 0.65,
      alternatives: [{ symbol: "بَ", probability: 0.28 }],
    };

    const progress = advanceTracker(
      createPhonemeTracker([
        { locations: ["1:1:1"], units: ["كَ", "تَ", "بَ"] },
        { locations: ["1:1:2"], units: ["مَ", "ن"] },
        { locations: ["1:1:3"], units: ["قَ", "دْ", "رُ"] },
      ]),
      heard,
    );

    expect(progress.completed).toHaveLength(3);
    expect(progress.skipped).toEqual([]);
  });

  it("takes a closing vowel's bare letter as the next word's bare opening", () => {
    const progress = advanceTracker(
      createPhonemeTracker([
        { locations: ["1:1:1"], units: ["قُ", "تِ", "لَ"] },
        { locations: ["1:1:2"], units: ["ل", "خَ"] },
        { locations: ["1:1:3"], units: ["قَ", "دْ", "رُ"] },
      ]),
      say(["قُ", "تِ", "ل", "خَ", "قَ", "دْ", "رُ"]),
    );

    expect(progress.completed).toHaveLength(3);
    expect(progress.skipped).toEqual([]);
  });
});

/*
 * Found by randomised comparison: three sounds, so nearly every way of
 * lining what was heard up against the page fits somewhere. The cheapest
 * moved over a word with nothing of it heard, which is refused; trying
 * only that one left the cursor two words short of the end for good.
 */
describe("catching up when the cheapest way is refused", () => {
  const WORDS: ExpectedWord[] = [
    ["نَ", "نَ", "بَ", "تَ", "تَ"],
    ["تَ", "بَ"],
    ["بَ", "تَ", "تَ", "تَ"],
    ["نَ", "تَ", "نَ", "نَ"],
    ["تَ", "تَ", "بَ"],
    ["بَ", "نَ", "بَ", "بَ", "تَ"],
    ["تَ"],
    ["بَ", "بَ", "بَ", "تَ"],
    ["بَ", "تَ", "بَ", "نَ"],
    ["بَ", "بَ", "نَ"],
    ["تَ", "بَ"],
    ["نَ", "تَ", "تَ", "نَ", "نَ"],
    ["بَ", "بَ", "تَ"],
    ["نَ", "بَ", "نَ", "بَ"],
  ].map((units, w) => ({
    locations: [`1:${1 + Math.floor(w / 5)}:${(w % 5) + 1}`],
    units,
  }));
  const HEARD = [
    "نَ نَ بَ تَ تَ تَ بَ نَ تَ نَ تَ تَ بَ بَ نَ بَ بَ تَ بَ بَ بَ تَ",
    "بَ تَ بَ نَ بَ تَ بَ نَ تَ نَ تَ تَ نَ نَ بَ بَ تَ نَ بَ نَ بَ",
  ];

  it("tries the next cheapest and follows the reciter to the end", () => {
    const tracker = createPhonemeTracker(WORDS);
    const heard = HEARD.join(" ").split(" ");
    let progress = advanceTracker(tracker, []);
    for (let at = 0; at < heard.length; at += 3) {
      progress = advanceTracker(tracker, say(heard.slice(at, at + 3)));
    }

    expect(progress.finished).toBe(true);
  });
});

/*
 * A reciter stopped at 3:7's مُتَشَٰبِهَٰتٌ ۖ, where the mark allows it, and
 * was held 36 seconds: the page's sounds join it to فَأَمَّا, and the stopped
 * ت - heard as تِ, its release - was nothing they allowed for.
 */
describe("stopping at a pause mark", () => {
  const STOP = {
    from: 7,
    at: 9,
    letters: ["ت"],
    alif: false,
    opening: null,
    hamza: false,
  };
  const words = (stops: boolean): ExpectedWord[] => [
    { locations: ["3:7:12"], units: ["وَ", "ءُ", "خَ", "رُ"] },
    {
      locations: ["3:7:13", "3:7:14"],
      units: [
        ..."مُ تَ شَ اا بِ هَ اا تُ ںںں".split(" "),
        ..."فَ ءَ ممممَ".split(" "),
      ],
      ...(stops ? { stops: [STOP] } : {}),
    },
    { locations: ["3:7:15"], units: ["للَ", "ذِ", "ۦۦ", "نَ"] },
  ];
  /* What the recogniser heard of it: a stray هَاا, and the stop. */
  const HEARD = [
    ..."وَ ءُ خَ رُ مُ تَ شَ اا هَ اا بِ هَ اا تِ".split(" "),
    ..."فَ ءَ ممممَ للَ ذِ ۦۦ نَ".split(" "),
  ];

  it("follows the stopped ending and the next word started afresh", () => {
    const progress = advanceTracker(
      createPhonemeTracker(words(true)),
      say(HEARD),
    );

    expect(progress.stumbles).toEqual([]);
    expect(progress.skipped).toEqual([]);
    expect(progress.finished).toBe(true);
  });

  it("stumbled there before, with only the joined sounds to go on", () => {
    const progress = advanceTracker(
      createPhonemeTracker(words(false)),
      say(HEARD),
    );

    expect(progress.stumbles.map((stumble) => stumble.locations)).toEqual([
      ["3:7:13", "3:7:14"],
    ]);
  });

  it("still waits for the next word after the stop", () => {
    const tracker = createPhonemeTracker(words(true));

    const progress = advanceTracker(
      tracker,
      say([..."وَ ءُ خَ رُ مُ تَ شَ اا بِ هَ اا ت".split(" "), "للَ", "ذِ"]),
    );

    expect(progress.currentLocations).toEqual(["3:7:13", "3:7:14"]);
    expect(progress.completed.flatMap((word) => word.locations)).toEqual([
      "3:7:12",
    ]);
  });

  /* حَنِيفٗاۚ وَمَا: the alif of the stop, then وَ once, not the merged وووَ. */
  it("takes the merged opening said once", () => {
    const progress = advanceTracker(
      createPhonemeTracker([
        {
          locations: ["3:67:7", "3:67:8"],
          units: ["حَ", "نِ", "ۦۦ", "فَ", "وووَ", "مَ", "اا"],
          stops: [
            {
              from: 4,
              at: 4,
              letters: [],
              alif: true,
              opening: "وَ",
              hamza: false,
            },
          ],
        },
        { locations: ["3:67:9"], units: ["كَ", "اا", "نَ"] },
      ]),
      say(["حَ", "نِ", "ۦۦ", "فَ", "اا", "وَ", "مَ", "اا", "كَ", "اا", "نَ"]),
    );

    expect(progress.stumbles).toEqual([]);
    expect(progress.finished).toBe(true);
  });
});

/*
 * A reciter on 3:14 said زُيِّنَ لِلَّذِينَ كَفَرُوا for زُيِّنَ لِلنَّاسِ, and the
 * cursor followed لِلَّذِينَ كَفَرُوا to 3:12's قُل لِّلَّذِينَ كَفَرُوا, two ayat
 * back. Only the ayah it is in and the one before are places to go back to.
 */
describe("going back only as far as the ayah before", () => {
  const AYAT: ExpectedWord[] = [
    {
      locations: ["3:12:1", "3:12:2"],
      units: ["قُ", "للِ", "للَ", "ذِ", "ۦۦ", "نَ"],
    },
    { locations: ["3:12:3"], units: ["كَ", "فَ", "رُ", "ۥۥ"] },
    { locations: ["3:12:4"], units: ["سَ", "تُ", "غ", "لَ", "بُ", "ۥۥ", "نَ"] },
    { locations: ["3:13:1"], units: ["قَ", "د", "كَ", "اا", "نَ"] },
    {
      locations: ["3:13:2"],
      units: ["لَ", "كُ", "م", "ءَ", "اا", "يَ", "تُ", "ن"],
    },
    { locations: ["3:14:1"], units: ["زُ", "ييِ", "نَ"] },
    { locations: ["3:14:2"], units: ["لِ", "ننننَ", "اا", "سِ"] },
    { locations: ["3:14:3"], units: ["حُ", "ببُ"] },
  ];

  it("hears words from two ayat back as something else said here", () => {
    const tracker = createPhonemeTracker(AYAT);
    advanceTracker(tracker, say(flat(AYAT.slice(0, 6))));

    const progress = advanceTracker(
      tracker,
      say(["لِ", "للَ", "ذِ", "ۦۦ", "نَ", "كَ", "فَ", "رُ", "ۥۥ"]),
    );

    expect(progress.currentLocations).toEqual(["3:14:2"]);
    expect(progress.stumbles.map((stumble) => stumble.locations)).toEqual([
      ["3:14:2"],
    ]);
  });

  it("still follows a reciter back over the ayah before", () => {
    const tracker = createPhonemeTracker(AYAT);
    advanceTracker(tracker, say(flat(AYAT.slice(0, 6))));

    const progress = advanceTracker(tracker, say(flat(AYAT.slice(3))));

    expect(progress.stumbles).toEqual([]);
    expect(progress.finished).toBe(true);
  });
});

describe("catching up, configured", () => {
  it("refuses a gap that costs nothing", () => {
    expect(() =>
      createPhonemeTracker(FATIHAH_2, { catchUpGapCost: 0 }),
    ).toThrow(RangeError);
  });
});

/*
 * The stray run keeps its sounds and the emissions they were heard in as
 * two arrays, because every reader wants the sounds alone. They stay in
 * step only while every write goes through the helpers that keep them so;
 * one that does not would hand the next page the wrong emissions, silently.
 * So this drives the tracker through rough recitations and checks after
 * every step.
 */
describe("the stray run and what it was heard in", () => {
  /* A bare letter beside its voweled form, so excused closing vowels and
     doublings across words both happen. */
  const SOUNDS = ["بَ", "تَ", "نَ", "مَ", "لَ", "ل"];

  it("stay in step through rough recitations, holds and page turns", () => {
    let seed = 20261102;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const pick = <T>(items: readonly T[]) =>
      items[Math.floor(random() * items.length)]!;
    const passage = (): ExpectedWord[] =>
      Array.from({ length: 4 + Math.floor(random() * 16) }, (_, w) => ({
        locations: [`1:${1 + Math.floor(w / 5)}:${(w % 5) + 1}`],
        units: Array.from({ length: 1 + Math.floor(random() * 4) }, () =>
          pick(SOUNDS),
        ),
      }));

    for (let run = 0; run < 2000; run += 1) {
      const words = passage();
      const tracker = createPhonemeTracker(words);
      if (random() < 0.5) expectNextPage(tracker, passage());

      /* The passage as a struggling recogniser hears it. */
      const heard: PhonemeEmission[] = [];
      const emit = (symbol: string, confidence: number) =>
        heard.push({
          id: heard.length,
          symbol,
          confidence,
          seconds: heard.length * 0.04,
          ...(random() < 0.2
            ? { alternatives: [{ symbol: pick(SOUNDS), probability: 0.3 }] }
            : {}),
        });
      for (const word of words) {
        if (random() < 0.08) continue;
        for (const unit of word.units) {
          const roll = random();
          if (roll < 0.2) continue;
          emit(roll < 0.3 ? pick(SOUNDS) : unit, 0.95);
          while (random() < 0.15) emit(pick(SOUNDS), random() * 0.45);
          if (random() < 0.05) emit(pick(SOUNDS), 0.95);
        }
      }

      const inStep = () => {
        expect(tracker.strayEmissions).toHaveLength(tracker.stray.length);
        tracker.strayEmissions.forEach((group, i) => {
          const [own, ...doubtful] = group;
          expect(phonemeIdentity(own!.symbol)).toBe(tracker.stray[i]);
          expect(own!.confidence).toBeGreaterThanOrEqual(0.45);
          expect(doubtful.length).toBeLessThanOrEqual(2);
          for (const other of doubtful) {
            expect(other.confidence).toBeLessThan(0.45);
          }
        });
      };
      for (let at = 0; at < heard.length; ) {
        const size = 1 + Math.floor(random() * 6);
        const progress = advanceTracker(tracker, heard.slice(at, at + size));
        at += size;
        inStep();
        const stumble = progress.stumbles[0];
        if (stumble && random() < 0.5) holdAt(tracker, stumble.wordIndex);
        else if (progress.heldAt && random() < 0.3) {
          if (random() < 0.5) releaseHold(tracker);
          else giveUpOnHeldWord(tracker);
          inStep();
        }
      }
    }
  });
});
