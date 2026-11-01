import type {
  MisreadWord,
  RecitedMoment,
} from "@/features/recitation-practice/contract";
import { toBase64 } from "@/features/recitation-practice/services/base64";
import { safeStorage } from "@/shared/storage";

/*
 * Recitations kept on this device, so a reader can listen back to them.
 *
 * The same arrangement as recitation kept for offline listening
 * (`audioDownloads.ts` in the reader): the audio in the Cache API, where a
 * few megabytes a run is unremarkable, and a small index beside it in local
 * storage, where reading the list does not mean opening every recording.
 * Played back as a blob URL, which seeks natively.
 *
 * Nothing here leaves the device. The recording is the reader's own voice,
 * so it is kept only while they ask for it to be (see
 * `usePracticeKeepRecordings`), and only the most recent are kept at all.
 */
const RECORDINGS_CACHE = "artqiy-recitations";
/* Versioned: the shape of an entry is persisted, so a later change to it
   comes with a migration rather than a list that silently fails to parse. */
const INDEX_KEY = "artqiy.recitations.v1";
/** The synthetic URL each recording is stored under. */
const AUDIO_PATH = "/__artqiy/recitations/";

/**
 * How many recordings are kept; saving another removes the oldest.
 *
 * A minute is about 1.9MB, so twenty page-length runs is tens of megabytes,
 * not hundreds - small enough to keep without asking, and stated where the
 * list is shown so nobody is surprised when the oldest goes.
 */
export const KEEP_RECITATIONS = 20;

export interface SavedRecitation {
  id: string;
  recordedAt: string;
  /** The first and last ayah recited, as `surah:ayah`. */
  from: string;
  to: string;
  seconds: number;
  bytes: number;
  progressIndex: number;
  totalWords: number;
  stoppedShort: boolean;
  /** The words the verdict listed, and where in the audio each was said. */
  words: (MisreadWord & { moment: RecitedMoment | null })[];
  /** What the reader said about the verdict; absent until they say anything. */
  feedback?: RecitationFeedback;
}

/**
 * The reader's own word on the verdict.
 *
 * The one label nothing else can supply: every measurement of which marks
 * are right so far came from mistakes cut into other people's recitations,
 * and only the reciter knows which of theirs were real. Added to the v1
 * entry as an optional field, so entries saved before it still parse.
 */
export interface RecitationFeedback {
  /** For each listed word they answered, whether it really was a mistake. */
  words: Record<string, WordFeedback>;
  /** They made a mistake the list does not have. */
  missedMistake: boolean;
}

export type WordFeedback = "mistake" | "saidRight";

export const NO_FEEDBACK: RecitationFeedback = {
  words: {},
  missedMistake: false,
};

/** The feedback with one word's answer changed, or taken back. */
export function withWordFeedback(
  feedback: RecitationFeedback,
  location: string,
  value: WordFeedback | undefined,
): RecitationFeedback {
  const words = { ...feedback.words };
  if (value) words[location] = value;
  else delete words[location];
  return { ...feedback, words };
}

function isSavedRecitation(value: unknown): value is SavedRecitation {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<SavedRecitation>;
  return (
    typeof entry.id === "string" &&
    typeof entry.recordedAt === "string" &&
    typeof entry.from === "string" &&
    typeof entry.to === "string" &&
    typeof entry.seconds === "number" &&
    Array.isArray(entry.words)
  );
}

function isRecitationFeedback(value: unknown): value is RecitationFeedback {
  if (typeof value !== "object" || value === null) return false;
  const { words, missedMistake } = value as Partial<RecitationFeedback>;
  return (
    typeof missedMistake === "boolean" &&
    typeof words === "object" &&
    words !== null &&
    !Array.isArray(words) &&
    Object.values(words).every(
      (answer) => answer === "mistake" || answer === "saidRight",
    )
  );
}

function readIndex(): SavedRecitation[] {
  const raw = safeStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    /* Answers that do not parse are dropped and the recording kept: losing
       the label is better than losing the run, or crashing the list. */
    return parsed
      .filter(isSavedRecitation)
      .map((entry) =>
        entry.feedback === undefined || isRecitationFeedback(entry.feedback)
          ? entry
          : { ...entry, feedback: undefined },
      );
  } catch {
    return [];
  }
}

function writeIndex(entries: SavedRecitation[]): void {
  safeStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

async function openCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(RECORDINGS_CACHE);
  } catch {
    return null;
  }
}

/** Newest first. */
export function listRecitations(): SavedRecitation[] {
  return readIndex().sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

/**
 * Keep a recitation, and let the oldest go once there are too many.
 *
 * The audio is written before the index, so a failure part way leaves an
 * unlisted file rather than a listed recording with nothing behind it.
 */
export async function saveRecitation(
  entry: SavedRecitation,
  wav: Blob,
): Promise<void> {
  const cache = await openCache();
  if (!cache) throw new Error("Cache storage is unavailable");
  await cache.put(
    AUDIO_PATH + entry.id,
    new Response(wav, { headers: { "content-type": "audio/wav" } }),
  );
  const entries = [
    entry,
    ...listRecitations().filter((e) => e.id !== entry.id),
  ];
  const kept = entries.slice(0, KEEP_RECITATIONS);
  writeIndex(kept);
  await Promise.all(
    entries
      .slice(KEEP_RECITATIONS)
      .map((old) => cache.delete(AUDIO_PATH + old.id)),
  );
}

/** The recording's audio, or null when the browser no longer has it. */
export async function recitationAudio(id: string): Promise<Blob | null> {
  const response = await cachedAudio(id);
  return response ? await response.blob() : null;
}

async function cachedAudio(id: string): Promise<Response | null> {
  const cache = await openCache();
  return (await cache?.match(AUDIO_PATH + id)) ?? null;
}

/**
 * Change what the reader said about a kept recitation, and return it.
 *
 * The change is applied to what is stored, not to a copy a screen read
 * earlier: the summary and the recordings in settings both answer for the
 * same run, and one must not write back over an answer given in the other.
 *
 * Returns null, storing nothing, when it is no longer kept: the label is
 * only worth having beside the audio it describes.
 */
export function updateRecitationFeedback(
  id: string,
  change: (current: RecitationFeedback) => RecitationFeedback,
): RecitationFeedback | null {
  const entries = readIndex();
  const entry = entries.find((e) => e.id === id);
  if (!entry) return null;
  entry.feedback = change(entry.feedback ?? NO_FEEDBACK);
  writeIndex(entries);
  return entry.feedback;
}

/**
 * One file holding a kept recitation: what was judged, what the reader said
 * about it, and the audio - so it can be sent to whoever is improving the
 * checker. Null when the browser no longer has the audio.
 *
 * JSON with the audio inside, rather than two files, because what someone
 * sends has to arrive whole; a label without its recording is useless, and
 * so is the reverse.
 */
export async function exportRecitation(id: string): Promise<Blob | null> {
  const entry = readIndex().find((e) => e.id === id);
  const audio = entry ? await cachedAudio(id) : null;
  if (!entry || !audio) return null;
  const base64 = toBase64(new Uint8Array(await audio.arrayBuffer()));
  /*
   * In parts, with the audio spliced in rather than passed through
   * `JSON.stringify`: base64 needs no escaping, and stringifying it would
   * make one more copy of a recording that is already tens of megabytes on
   * a long run - on a phone, the copy that runs out of memory.
   */
  const head = JSON.stringify({
    format: "artqiy-recitation",
    version: 1,
    recitation: entry,
    audio: { type: "audio/wav" },
  });
  return new Blob([head.slice(0, -2), ',"base64":"', base64, '"}}'], {
    type: "application/json",
  });
}

export async function deleteRecitation(id: string): Promise<void> {
  writeIndex(readIndex().filter((entry) => entry.id !== id));
  const cache = await openCache();
  await cache?.delete(AUDIO_PATH + id);
}

export async function deleteAllRecitations(): Promise<void> {
  writeIndex([]);
  if (typeof caches === "undefined") return;
  try {
    await caches.delete(RECORDINGS_CACHE);
  } catch {
    /* The list is already empty, which is what the reader asked for. */
  }
}
