import type { ReciterOption } from "@/shared/constants/reciters";
import { SURAH_AYAH_COUNTS } from "@/shared/constants/reciters";

/** Ayah-level recitation via everyayah.com. */
export const AYAH_AUDIO_BASE = "https://everyayah.com/data";

/** Ayah-level recitation via islamic.app CDN (free, no API key). */
export const ISLAMIC_APP_AUDIO_BASE = "https://cdn.islamic.app/quran/audio";

/** Word-by-word audio from Quran Foundation CDN. */
export const WORD_AUDIO_BASE = "https://verses.quran.foundation/";

export function toGlobalAyahNumber(surah: number, ayah: number): number {
  if (surah < 1 || surah > SURAH_AYAH_COUNTS.length) {
    throw new Error(`Invalid surah number: ${surah}`);
  }

  const maxAyah = SURAH_AYAH_COUNTS[surah - 1]!;
  if (ayah < 1 || ayah > maxAyah) {
    throw new Error(`Invalid ayah number: ${surah}:${ayah}`);
  }

  let offset = 0;
  for (let index = 0; index < surah - 1; index += 1) {
    offset += SURAH_AYAH_COUNTS[index]!;
  }

  return offset + ayah;
}

export function getAyahAudioUrl(
  reciter: ReciterOption,
  surah: number,
  ayah: number,
): string {
  if (reciter.source === "islamicapp" && reciter.slug) {
    const globalAyah = toGlobalAyahNumber(surah, ayah);
    return `${ISLAMIC_APP_AUDIO_BASE}/${reciter.slug}/${globalAyah}.mp3`;
  }

  const folder = reciter.folder;
  if (!folder) {
    throw new Error(`Reciter ${reciter.id} has no audio folder configured`);
  }

  const surahPart = String(surah).padStart(3, "0");
  const ayahPart = String(ayah).padStart(3, "0");
  return `${AYAH_AUDIO_BASE}/${folder}/${surahPart}${ayahPart}.mp3`;
}

export function getWordAudioUrl(sura: number, aya: number, word: number): string {
  const surahPart = String(sura).padStart(3, "0");
  const ayahPart = String(aya).padStart(3, "0");
  const wordPart = String(word).padStart(3, "0");
  return `${WORD_AUDIO_BASE}wbw/${surahPart}_${ayahPart}_${wordPart}.mp3`;
}
