/*
 * MEASURED, AND IT DOES NOT WORK. Kept so nobody tries it twice.
 *
 * On the 32 fixtures the alignment cost of a correct recitation and of a
 * mistake occupy the same range: correct 3.54-4.37 (median 3.86), mistakes
 * 3.57-4.42 (median 4.07). A wrong verse ending scored 3.57, below almost
 * every correct clip; a correct Minshawi recitation scored 4.37, above most
 * mistakes. There is no threshold to pick, so the runner below scores
 * 0/12 false accepts only by rejecting all 20 correct clips as well.
 *
 * The reason is plain in the numbers: the cost is dominated by *who is
 * speaking*, not by *what was said*. Cepstral mean normalisation takes out
 * the recording level and some of the voice, and what is left still swamps
 * the content. The length ratio has the same problem - Husary's murattal
 * runs 1.7-2.4x the reference's pace while Alafasy runs 1.04x, so a slow
 * correct recitation looks like an insertion.
 *
 * The one variant that would remove the speaker from the comparison is DTW
 * against the reader's OWN earlier recitation of the same page. That is a
 * different feature - it needs a correct recording to already exist - and it
 * cannot help with a page being learned, which is the whole of tasmee'.
 *
 * ---
 *
 * تسميع with no model at all.
 *
 * The app already has a recitation of every ayah by dozens of reciters. So
 * rather than recognising what was said, line the reader's audio up against a
 * reference recitation of the same ayah and look at what the alignment costs.
 * Where it costs a lot is where they diverged.
 *
 * Nothing is trained, nothing is downloaded but audio the app already uses,
 * and there is no licence to honour but the reciters' own.
 *
 * The reference is deliberately a reciter who appears in none of the
 * fixtures. Comparing Husary's recitation against Husary's own would measure
 * nothing: every "correct" clip would be the reference itself.
 */
import path from "node:path";
import { download, readWavAsFloat32, toWav } from "../lib/audio.mjs";
import { dtw, worstWindow } from "../lib/dtw.mjs";
import { mfcc } from "../lib/mfcc.mjs";

export const name = "dtw against a reference recitation (no model)";

const REFERENCE_FOLDER = "Abu_Bakr_Ash-Shaatree_128kbps";
const WORK = path.resolve("scripts/tasmee/fixtures/.work/reference");

/**
 * Chosen by separating the fixtures, and therefore optimistic.
 *
 * 32 clips is far too few to fit a threshold on and then report accuracy
 * against the same 32. The number below is the best split available on this
 * set; treat it as the ceiling of what this approach could do, not as a
 * measurement of what it would do on unseen voices.
 */
const COST_THRESHOLD = 3.6;

const referenceCache = new Map();

async function referenceFeatures(verseKey) {
  const cached = referenceCache.get(verseKey);
  if (cached) return cached;

  const [surah, ayah] = verseKey.split(":").map(Number);
  const s = String(surah).padStart(3, "0");
  const a = String(ayah).padStart(3, "0");
  const mp3 = path.join(WORK, `${s}${a}.mp3`);
  const wav = path.join(WORK, `${s}${a}.wav`);

  await download(
    `https://everyayah.com/data/${REFERENCE_FOLDER}/${s}${a}.mp3`,
    mp3,
  );
  await toWav(mp3, wav);
  const features = mfcc(await readWavAsFloat32(wav));
  referenceCache.set(verseKey, features);
  return features;
}

export async function createJudge() {
  return async function judge({ audio, verseKey }) {
    const reference = await referenceFeatures(verseKey);
    const spoken = mfcc(audio);

    if (reference.length === 0 || spoken.length === 0) {
      return { verdict: "mistake", detail: "nothing to align" };
    }

    const { cost, path: alignment } = dtw(spoken, reference);
    const worst = worstWindow(spoken, reference, alignment);

    /*
     * Length is its own signal, and a stronger one than the alignment cost:
     * stopping halfway through leaves half the reference unaccounted for, and
     * no amount of warping hides that.
     */
    const lengthRatio = spoken.length / reference.length;
    const truncated = lengthRatio < 0.75 || lengthRatio > 1.4;

    const verdict = truncated || cost > COST_THRESHOLD ? "mistake" : "correct";
    return {
      verdict,
      detail:
        `cost ${cost.toFixed(2)} · worst ${worst.cost.toFixed(2)} at ` +
        `${Math.round(worst.at * 100)}% · length ${lengthRatio.toFixed(2)}x` +
        (truncated ? " (length)" : ""),
    };
  };
}
