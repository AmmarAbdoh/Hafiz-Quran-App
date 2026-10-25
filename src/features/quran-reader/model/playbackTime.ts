import type { SurahTimestamp } from "@/domain/quran";

export interface PlaybackTime {
  /** Position inside the ayah currently sounding. */
  ayahMs: number;
  ayahDurationMs: number;
  /**
   * Position across the whole listening session, and its length.
   *
   * Null when the session's length is not knowable: playback is one audio
   * file per ayah, so a total only exists once every ayah ahead has a
   * published duration. Everyayah recitations have none, so the bar falls
   * back to the current ayah alone rather than inventing a total.
   */
  sessionMs: number | null;
  sessionTotalMs: number | null;
}

export const emptyPlaybackTime: PlaybackTime = {
  ayahMs: 0,
  ayahDurationMs: 0,
  sessionMs: null,
  sessionTotalMs: null,
};

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";

/** `m:ss`, or `h:mm:ss` once a session runs past an hour. */
export function formatClock(ms: number, locale: string): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);

  const plain =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;

  // Padded, so the digits are mapped rather than formatted - Intl would drop
  // the leading zero that keeps the clock from jittering as it ticks.
  return locale.startsWith("ar")
    ? plain.replace(/\d/g, (digit) => ARABIC_INDIC[Number(digit)] ?? digit)
    : plain;
}

function durationFor(
  timestamps: Map<number, SurahTimestamp[]>,
  surah: number,
  ayah: number,
): number | null {
  const entry = timestamps.get(surah)?.find((item) => item.ayah === ayah);
  return entry && entry.durationMs > 0 ? entry.durationMs : null;
}

/**
 * Where the session stands, when every ayah in it has a known length.
 *
 * One missing duration gives up entirely rather than reporting a total that
 * is quietly short - a progress bar that lies about how much is left is worse
 * than one that is not shown.
 */
export function computeSessionTime({
  playlist,
  index,
  ayahMs,
  timestamps,
}: {
  playlist: ReadonlyArray<{ surah: number; ayah: number }>;
  index: number;
  ayahMs: number;
  timestamps: Map<number, SurahTimestamp[]>;
}): { sessionMs: number | null; sessionTotalMs: number | null } {
  if (playlist.length === 0) return { sessionMs: null, sessionTotalMs: null };

  let total = 0;
  let before = 0;
  for (const [position, item] of playlist.entries()) {
    const duration = durationFor(timestamps, item.surah, item.ayah);
    if (duration === null) return { sessionMs: null, sessionTotalMs: null };
    total += duration;
    if (position < index) before += duration;
  }

  return {
    sessionMs: Math.min(total, before + Math.max(0, ayahMs)),
    sessionTotalMs: total,
  };
}

/**
 * The playlist item at a point along the session, from 0 at its start to 1
 * at its end - where tapping the progress line lands.
 *
 * By running time when every ayah's length is known and by count otherwise:
 * the same two ways the line itself is drawn, so the ayah a tap lands on is
 * the one drawn under the finger.
 */
export function playlistIndexAt({
  playlist,
  fraction,
  timestamps,
}: {
  playlist: ReadonlyArray<{ surah: number; ayah: number }>;
  fraction: number;
  timestamps: Map<number, SurahTimestamp[]>;
}): number {
  const last = playlist.length - 1;
  if (last < 0) return 0;
  const at = Math.min(1, Math.max(0, fraction));

  const durations = playlist.map((item) =>
    durationFor(timestamps, item.surah, item.ayah),
  );
  if (durations.every((duration) => duration !== null)) {
    const total = durations.reduce<number>(
      (sum, duration) => sum + duration,
      0,
    );
    let elapsed = 0;
    for (const [index, duration] of durations.entries()) {
      elapsed += duration;
      if (at * total < elapsed) return index;
    }
    return last;
  }
  return Math.min(last, Math.floor(at * playlist.length));
}
