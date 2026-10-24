/*
 * The recogniser's symbol table and the text it is compared against.
 *
 * Two rules from the model card, both of which produce silent nonsense when
 * broken: the ids in `tokens.txt` are authoritative - the raw unit inventory
 * is offset by one against the CTC layer, and blank is 250 rather than 0 -
 * and the units are multi-character, because madd length is encoded by
 * repetition (`اااااا` is one symbol, a six-harakat alef, not six alefs).
 */

export interface PhonemeTokenTable {
  /** Symbol for each CTC class, indexed by id. */
  symbols: string[];
  blankId: number;
  /** Every symbol but blank, longest first, for greedy matching. */
  inventory: string[];
}

export function parseTokenTable(text: string): PhonemeTokenTable {
  const symbols: string[] = [];
  let blankId = -1;

  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    // The symbol itself can be anything, so the id is taken from the end.
    const split = line.lastIndexOf(" ");
    if (split === -1) continue;
    const symbol = line.slice(0, split);
    const id = Number(line.slice(split + 1));
    if (!Number.isInteger(id)) continue;
    symbols[id] = symbol;
    if (symbol === "<blank>") blankId = id;
  }

  if (blankId === -1) {
    throw new Error("the symbol table has no <blank> entry");
  }

  const inventory = symbols
    .filter((symbol) => symbol && symbol !== "<blank>")
    .sort((a, b) => b.length - a.length);

  return { symbols, blankId, inventory };
}

/**
 * Split a phoneme string into the units the model actually emits.
 *
 * Longest match first, so a six-harakat madd stays one symbol instead of
 * becoming six separate alefs - which would otherwise count as five errors
 * against a recitation that was perfectly correct.
 */
export function toPhonemeUnits(
  phonemes: string,
  inventory: readonly string[],
): string[] {
  const units: string[] = [];
  let at = 0;

  while (at < phonemes.length) {
    if (phonemes[at] === " ") {
      at += 1;
      continue;
    }

    let matched = "";
    for (const unit of inventory) {
      if (unit.length <= matched.length) break;
      if (phonemes.startsWith(unit, at)) {
        matched = unit;
        break;
      }
    }

    if (matched) {
      units.push(matched);
      at += matched.length;
    } else {
      /*
       * A character the table has no symbol for is dropped, not kept.
       *
       * Keeping it looked like the honest thing to do, but the recogniser
       * cannot emit a symbol it does not have, so the unit could never be
       * matched: the cursor would wait at that word for a sound that was
       * never going to arrive, and the word would score zero however well it
       * was recited. Dropping it judges the word on the sounds the model can
       * actually produce.
       *
       * Checked against all 6,236 ayat of the model's own phoneme dataset:
       * this branch is never taken, so it guards a future data source rather
       * than anything shipping today.
       */
      at += 1;
    }
  }

  return units;
}

/**
 * Symbols that differ only in how long a sound is held, grouped together.
 *
 * The table encodes length by repetition - `ا`, `اا`, `اااا`, `اااااا` are
 * four separate symbols, and 97 of the 136 distinct sounds have several
 * lengths like this. For deciding *which word* was recited that distinction
 * is noise, and worse, it is the one dimension the model's own card warns
 * about: reciters legitimately choose two, four or six harakat where the
 * training labels fixed one, so "duration grading should be done from
 * forced-alignment timing, not from the emitted symbol run-length".
 *
 * Judging identity on collapsed symbols is what their own evaluation script
 * calls phoneme-identity, and it is what stopped a correct Alafasy recitation
 * being marked wrong for holding a madd longer than the label expected.
 */
/**
 * The letters whose repetition is a length rather than a doubling.
 *
 * The table writes both by repeating a character, and they must not be
 * confused. A madd letter (`ا` `ۥ` `ۦ`, and the tatweel `ـ` of an imala) or an
 * ikhfa' nasal (`ں` `۾`) repeated is one sound held for longer, which is what
 * reciters legitimately vary. Any other letter repeated is a shadda: `ييَ` in
 * إِيَّاكَ, `ممممِ` in مِّن. Collapsing those as well made إِيَاكَ - the classic
 * meaning-changing slip - the same units as إِيَّاكَ, to the cursor and to the
 * verdict alike.
 */
/** The characters whose repetition is length rather than a doubling. */
const HELD_SOUNDS = "اۥۦـں۾";

const HELD_SOUND_RUN = new RegExp(`([${HELD_SOUNDS}])\\1+`, "gu");

/**
 * The same sound with its length stripped off: `اااااا` becomes `ا`.
 *
 * Length is encoded by repeating the character, so this is what two symbols
 * have in common when they are the same phoneme held for different counts.
 * A doubled consonant keeps its doubling; see `HELD_SOUND_RUN`.
 */
export function phonemeIdentity(symbol: string): string {
  return symbol.replace(HELD_SOUND_RUN, "$1");
}

/** A letter repeated that `HELD_SOUND_RUN` does not collapse: a shadda. */
const DOUBLED_CONSONANT = new RegExp(`^([^${HELD_SOUNDS}])\\1`, "u");

/**
 * Whether this symbol is a doubled consonant rather than a held sound.
 *
 * The table writes both by repetition, and only one of them is length. A madd
 * held for two counts instead of four is the same word; `إِيَاكَ` without its
 * shadda is a different one, and the classic meaning-changing slip. Anything
 * that forgives a phoneme has to know the difference.
 */
export function isDoubledConsonant(symbol: string): boolean {
  return DOUBLED_CONSONANT.test(symbol);
}

export function identityClasses(symbols: readonly string[]): {
  classOf: Int32Array;
  classCount: number;
} {
  const classOf = new Int32Array(symbols.length).fill(-1);
  const byBase = new Map<string, number>();
  let next = 0;

  for (let id = 0; id < symbols.length; id += 1) {
    const symbol = symbols[id];
    if (!symbol) continue;
    // Blank keeps a class of its own; it is not a sound.
    const base = symbol === "<blank>" ? "<blank>" : phonemeIdentity(symbol);
    let index = byBase.get(base);
    if (index === undefined) {
      index = next;
      next += 1;
      byBase.set(base, index);
    }
    classOf[id] = index;
  }

  // Anything the table skipped gets its own class so nothing collides.
  for (let id = 0; id < classOf.length; id += 1) {
    if (classOf[id] === -1) {
      classOf[id] = next;
      next += 1;
    }
  }

  return { classOf, classCount: next };
}
