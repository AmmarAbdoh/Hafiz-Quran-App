/*
 * Which sounds does the recogniser drop?
 *
 * Asked because a learner was stopped for twenty-six seconds at فَوَيْلٌ
 * لِّلْمُصَلِّينَ having recited it correctly: the model emitted every phoneme of
 * it but the opening فَ, three attempts running, and the cursor cannot forgive
 * a phoneme missing from a word's first position. Before changing the cursor,
 * this asks whether the model drops that sound generally or only on his
 * microphone.
 *
 * Per expected unit, counted over whatever the clip emitted - a multiset
 * comparison rather than an alignment, which is blunt but enough to separate
 * "never heard" from "heard everywhere".
 *
 *   node scripts/tasmee/dropped.mjs [--fixtures DIR]
 */
import { flag } from "./lib/args.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  parseTokenTable,
  phonemeIdentity,
  toPhonemeUnits,
} from "../../src/features/recitation-practice/model/phonemeTokens.ts";

const FIXTURES = path.resolve(
  flag("fixtures", "scripts/tasmee/fixtures-large"),
);
const MODEL_DIR = process.env.TASMEE_ZIPFORMER_DIR ?? ".models/zipformer";

const emissions = JSON.parse(
  await readFile(path.join(FIXTURES, ".emissions.json"), "utf8"),
);
const quran = JSON.parse(
  await readFile(`${MODEL_DIR}/ordered_quran_phonemes.json`, "utf8"),
);
const { inventory } = parseTokenTable(
  await readFile(`${MODEL_DIR}/tokens.txt`, "utf8"),
);

/** Expected and heard counts per identity, over the correct clips only. */
const want = new Map();
const got = new Map();
/* And the same again for a unit that opens a word, which is the position the
   cursor cannot forgive. */
const wantFirst = new Map();
const gotFirst = new Map();

const bump = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by);

for (const row of emissions) {
  /* Only recitations with nothing wrong with them: a dropped sound in a
     word-dropped clip is the fixture, not the model. */
  if (row.verdict !== "correct") continue;

  const heard = new Map();
  for (const [symbol] of row.units) bump(heard, phonemeIdentity(symbol));

  const expected = new Map();
  const opens = new Map();
  for (const key of row.verseKeys ?? [row.verseKey]) {
    const ayah = quran[key];
    if (!ayah) continue;
    for (const word of ayah.aya_phonemes_list) {
      const units = toPhonemeUnits(word, inventory).map(phonemeIdentity);
      units.forEach((unit, at) => {
        bump(expected, unit);
        if (at === 0) bump(opens, unit);
      });
    }
  }

  for (const [unit, count] of expected) {
    bump(want, unit, count);
    bump(got, unit, Math.min(count, heard.get(unit) ?? 0));
  }
  for (const [unit, count] of opens) {
    bump(wantFirst, unit, count);
    bump(gotFirst, unit, Math.min(count, heard.get(unit) ?? 0));
  }
}

const rows = [...want.entries()]
  .filter(([, count]) => count >= 200)
  .map(([unit, count]) => ({
    unit,
    want: count,
    heard: (got.get(unit) ?? 0) / count,
    opens: wantFirst.get(unit) ?? 0,
    openHeard: wantFirst.get(unit)
      ? (gotFirst.get(unit) ?? 0) / wantFirst.get(unit)
      : null,
  }))
  .sort((a, b) => a.heard - b.heard);

const pct = (value) =>
  value === null ? "    -" : `${(value * 100).toFixed(1)}%`;
console.log(
  `${emissions.filter((r) => r.verdict === "correct").length} correct clips, ` +
    `${rows.length} units expected 200+ times
`,
);
console.log("unit      expected   heard    opens a word   heard there");
console.log("-".repeat(60));
for (const row of rows) {
  console.log(
    `  ${row.unit.padEnd(8)}${String(row.want).padStart(7)}` +
      `${pct(row.heard).padStart(9)}${String(row.opens).padStart(14)}` +
      `${pct(row.openHeard).padStart(14)}`,
  );
}
