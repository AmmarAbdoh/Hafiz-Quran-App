/*
 * Telling the reciter apart from the room.
 *
 * A fixed loudness threshold cannot do it. Someone talking across the room is
 * perfectly audible to a microphone - easily above any threshold low enough
 * to catch a reciter who goes quiet at the end of an ayah - so a fixed gate
 * either lets the room in or cuts the reciter off.
 *
 * What separates them is not absolute loudness but distance, and distance
 * shows up as a ratio: the person holding the device is many times louder at
 * the microphone than anyone else in the room. So the gate learns how loud
 * *this* reciter is and admits only what is within reach of that.
 *
 * The level decays, so it follows someone who moves the phone or tires
 * towards the end of a page rather than locking onto their loudest moment.
 */

/** Below this nothing is speech, however quiet the room is. */
const ABSOLUTE_FLOOR = 0.006;
/** Admitted audio must be at least this share of the reciter's own level. */
const RELATIVE_FLOOR = 0.22;
/** How fast the learned level falls when the reciter is not what is arriving. */
const DECAY_PER_BLOCK = 0.995;
/**
 * How fast it rises, per reference block. Quick, so the first words are not
 * clipped.
 *
 * Scaled like the other two rates, which it was not: a share of the gap
 * closed per *block* means a 48kHz context closes it three times as fast as
 * a 16kHz one, which is the browser difference this module's comment says it
 * has already fixed. The share is converted to a per-second rate and back,
 * so one block of 256ms moves the level as far as three of 85ms.
 */
const RISE = 0.35;
/**
 * The block these per-block rates were measured at: 4096 samples at 16kHz.
 *
 * A `ScriptProcessorNode` is sized in samples, not in time, so the same 4096
 * is 256ms on a 16kHz context and 85ms on the 48kHz one Firefox forces -
 * three times as many blocks per second, and therefore three times as much
 * decay and three times as much headroom to rise. The gate was learning a
 * different reciter on each browser. Both rates are scaled by how long the
 * block actually was, so they mean the same thing wherever they run.
 */
export const REFERENCE_BLOCK_SECONDS = 4096 / 16000;
/**
 * The most a single block can lift the level by.
 *
 * A cough or a knock on the phone is a block or two many times louder than
 * the reciter. Followed at full speed, two blocks at 0.4 lifted a reciter's
 * 0.05 to 0.25, setting the bar above their own voice - and since nothing it
 * rejected could bring the level back down, they were shut out for the rest
 * of the run with no error shown. Capped, the same cough moves the bar from
 * 0.011 to 0.025 and the reciter is still heard.
 */
const MAX_RISE_PER_BLOCK = 1.5;

export interface SpeechGate {
  /** The reciter's learned loudness, for display and for tests. */
  level: number;
  /** True while the gate has not yet heard anyone. */
  listening: boolean;
}

export function createSpeechGate(): SpeechGate {
  return { level: 0, listening: true };
}

/**
 * Decide whether a block of audio is the reciter, and learn from it.
 *
 * Mutates `gate`; returns true when the block should be passed on to the
 * recogniser.
 */
export function acceptSpeech(
  gate: SpeechGate,
  rms: number,
  blockSeconds: number,
): boolean {
  /* Both rates are per reference block, so scale them to this one. */
  const blocks = blockSeconds / REFERENCE_BLOCK_SECONDS;
  const decay = DECAY_PER_BLOCK ** blocks;
  const maxRise = MAX_RISE_PER_BLOCK ** blocks;

  if (rms < ABSOLUTE_FLOOR) {
    gate.level *= decay;
    return false;
  }

  /*
   * The first voice heard is taken to be the reciter: they started the run.
   *
   * Admitted, but it does not get to set the bar. The first sound after a tap
   * is as likely to be a pop or the phone being set down as it is to be a
   * word, and taking it at face value put the bar many times above the
   * reciter's own voice - from where, since nothing it rejected could bring
   * the bar down, they were locked out for half a minute with no error shown.
   * Seeded at the floor instead and left to the capped rise below, which
   * reaches an ordinary speaking level in about a second.
   */
  if (gate.listening) {
    gate.listening = false;
    gate.level = Math.min(rms, ABSOLUTE_FLOOR * MAX_RISE_PER_BLOCK);
    return true;
  }

  const admitted = rms >= gate.level * RELATIVE_FLOOR;

  if (rms > gate.level) {
    /* The share left unclosed compounds, so the rate scales the same way the
       decay does rather than multiplying the share itself. */
    const rise = 1 - (1 - RISE) ** blocks;
    gate.level = Math.min(
      gate.level + (rms - gate.level) * rise,
      gate.level * maxRise,
    );
  } else {
    /*
     * Anything quieter lets the level fall, rejected or not, at the same rate
     * silence does. A rejected block is by definition not the reciter, so it
     * is no reason to keep the bar where it is - and when only admitted audio
     * could lower it, a bar set too high could never come down again.
     */
    gate.level *= decay;
  }

  return admitted;
}
