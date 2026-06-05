const QURAN_COM_API = "https://api.quran.com/api/v4";
export const QURAN_COM_AYAH_AUDIO_BASE = "https://audio.qurancdn.com/";

export interface WordSegment {
  position: number;
  startMs: number;
  endMs: number;
  location: string;
}

export interface AyahChapterSegment {
  position: number;
  startMs: number;
  endMs: number;
}

export interface VerseAudioData {
  audioUrl: string;
  segments: WordSegment[];
  wordsByPosition: Map<number, string>;
}

export interface SurahTimestamp {
  verseKey: string;
  ayah: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  chapterSegments: AyahChapterSegment[];
}

export interface SurahAudioMeta {
  surahDurationMs: number;
  ayahTimestamps: SurahTimestamp[];
}

interface QuranComWord {
  position: number;
  location: string;
  char_type_name: string;
}

interface QuranComVerseResponse {
  verse: {
    verse_key: string;
    words?: QuranComWord[];
    audio?: {
      url: string;
      segments?: number[][];
    };
  };
}

interface QuranComChapterAudioResponse {
  audio_file: {
    timestamps: Array<{
      verse_key: string;
      timestamp_from: number;
      timestamp_to: number;
      duration: number;
      segments?: number[][];
    }>;
  };
}

/** Quran.com uses [index, position, startMs, endMs] or [position, startMs, endMs]. */
export function parseSegmentRow(
  row: number[],
): { position: number; startMs: number; endMs: number } | null {
  if (row.length >= 4) {
    const [, position, startMs, endMs] = row;
    if (
      typeof position !== "number" ||
      typeof startMs !== "number" ||
      typeof endMs !== "number"
    ) {
      return null;
    }
    return { position, startMs, endMs };
  }

  if (row.length === 3) {
    const [position, startMs, endMs] = row;
    if (
      typeof position !== "number" ||
      typeof startMs !== "number" ||
      typeof endMs !== "number"
    ) {
      return null;
    }
    return { position, startMs, endMs };
  }

  return null;
}

function buildWordsByPosition(words: QuranComWord[] | undefined): Map<number, string> {
  const map = new Map<number, string>();
  for (const word of words ?? []) {
    if (word.char_type_name === "end") continue;
    map.set(word.position, word.location);
  }
  return map;
}

function parseChapterAyahSegments(
  raw: number[][],
  timestampFrom: number,
  timestampTo: number,
): AyahChapterSegment[] {
  const parsed: AyahChapterSegment[] = [];

  for (let index = 0; index < raw.length; index += 1) {
    const row = raw[index]!;
    const segment = parseSegmentRow(row);

    if (segment) {
      const startMs = segment.startMs - timestampFrom;
      const endMs = segment.endMs - timestampFrom;
      if (endMs > 0 && startMs < timestampTo - timestampFrom) {
        parsed.push({
          position: segment.position,
          startMs: Math.max(0, startMs),
          endMs,
        });
      }
      continue;
    }

    if (row.length === 2) {
      const [position, absStart] = row;
      if (typeof position !== "number" || typeof absStart !== "number") continue;

      let absEnd = timestampTo;
      for (let nextIndex = index + 1; nextIndex < raw.length; nextIndex += 1) {
        const next = parseSegmentRow(raw[nextIndex]!);
        if (next && next.startMs > absStart) {
          absEnd = next.startMs;
          break;
        }
      }

      const startMs = absStart - timestampFrom;
      const endMs = absEnd - timestampFrom;
      if (endMs > 0) {
        parsed.push({
          position,
          startMs: Math.max(0, startMs),
          endMs,
        });
      }
    }
  }

  return parsed;
}

export function mergeWordSegments(
  verseSegments: WordSegment[],
  chapterSegments: AyahChapterSegment[],
  wordsByPosition: Map<number, string>,
): WordSegment[] {
  const merged = [...verseSegments];
  const seen = new Set(
    verseSegments.map(
      (segment) =>
        `${segment.position}:${segment.startMs}:${segment.endMs}:${segment.location}`,
    ),
  );

  for (const segment of chapterSegments) {
    const location = wordsByPosition.get(segment.position);
    if (!location) continue;

    const key = `${segment.position}:${segment.startMs}:${segment.endMs}:${location}`;
    if (seen.has(key)) continue;

    seen.add(key);
    merged.push({
      position: segment.position,
      startMs: segment.startMs,
      endMs: segment.endMs,
      location,
    });
  }

  merged.sort(
    (a, b) => a.startMs - b.startMs || a.position - b.position,
  );

  return merged;
}

export async function fetchVerseAudioData(
  verseKey: string,
  recitationId: number,
): Promise<VerseAudioData | null> {
  const response = await fetch(
    `${QURAN_COM_API}/verses/by_key/${encodeURIComponent(verseKey)}?words=true&audio=${recitationId}&word_fields=location,position,char_type_name`,
  );

  if (!response.ok) return null;

  const data = (await response.json()) as QuranComVerseResponse;
  const audio = data.verse.audio;
  if (!audio?.url) return null;

  const wordsByPosition = buildWordsByPosition(data.verse.words);
  const segments: WordSegment[] = [];

  for (const row of audio.segments ?? []) {
    const parsed = parseSegmentRow(row);
    if (!parsed) continue;

    const location = wordsByPosition.get(parsed.position);
    if (!location) continue;

    segments.push({
      position: parsed.position,
      startMs: parsed.startMs,
      endMs: parsed.endMs,
      location,
    });
  }

  return {
    audioUrl: `${QURAN_COM_AYAH_AUDIO_BASE}${audio.url}`,
    segments,
    wordsByPosition,
  };
}

export async function fetchSurahAudioMeta(
  surah: number,
  recitationId: number,
): Promise<SurahAudioMeta | null> {
  const response = await fetch(
    `${QURAN_COM_API}/chapter_recitations/${recitationId}/${surah}?segments=true`,
  );

  if (!response.ok) return null;

  const data = (await response.json()) as QuranComChapterAudioResponse;
  const timestamps = data.audio_file.timestamps ?? [];

  const ayahTimestamps: SurahTimestamp[] = timestamps.map((entry) => {
    const ayah = Number(entry.verse_key.split(":")[1]);
    return {
      verseKey: entry.verse_key,
      ayah,
      startMs: entry.timestamp_from,
      endMs: entry.timestamp_to,
      durationMs: entry.duration,
      chapterSegments: parseChapterAyahSegments(
        entry.segments ?? [],
        entry.timestamp_from,
        entry.timestamp_to,
      ),
    };
  });

  const surahDurationMs =
    ayahTimestamps.at(-1)?.endMs ??
    ayahTimestamps.reduce((sum, entry) => sum + entry.durationMs, 0);

  return { surahDurationMs, ayahTimestamps };
}

export function findActiveWordLocation(
  segments: WordSegment[],
  currentTimeMs: number,
): string | null {
  let best: WordSegment | null = null;

  for (const segment of segments) {
    if (currentTimeMs < segment.startMs || currentTimeMs > segment.endMs) {
      continue;
    }

    if (
      !best ||
      segment.startMs > best.startMs ||
      (segment.startMs === best.startMs &&
        segment.endMs - segment.startMs < best.endMs - best.startMs)
    ) {
      best = segment;
    }
  }

  return best?.location ?? null;
}
