import { describe, expect, it } from "vitest";
import type { PhonemeEmission } from "./ctcGreedy";
import {
  advanceTracker,
  createPhonemeTracker,
  giveUpOnHeldWord,
  holdAt,
  recitedSpan,
  releaseHold,
  type ExpectedWord,
} from "./phonemeProgress";

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

  it("marks the word left behind when a slip back into the twin comes back", () => {
    const tracker = createPhonemeTracker(PAGE);
    reciteUpTo47(tracker);

    /* 2:40's ending... */
    const slipped = advanceTracker(
      tracker,
      say(["و", "فُ", "بِ", "عَ", "ه", "دِ"]),
    );
    /* ...then 2:47 begun again and said right. */
    const back = advanceTracker(tracker, say(flat(PAGE.slice(AT_47 - 3))));

    expect(slipped.stumbles).toEqual([]);
    expect(back.stumbles.map((stumble) => stumble.locations)).toEqual([
      ["2:47:4"],
    ]);
    expect(back.finished).toBe(true);
  });

  it("says nothing of a reciter who went back and said the earlier ayah through", () => {
    const tracker = createPhonemeTracker(PAGE);
    reciteUpTo47(tracker);

    const repeated = advanceTracker(tracker, [
      ...say(["و", "فُ", "بِ", "عَ", "ه", "دِ"]),
      ...say(flat(PAGE.slice(5))),
    ]);

    expect(repeated.stumbles).toEqual([]);
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
