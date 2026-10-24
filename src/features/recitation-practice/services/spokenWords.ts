/*
 * What a page sounds like, in the units a recitation can be followed by.
 *
 * The recogniser emits phonemes; the page holds words. This joins the two,
 * using the canonical phonemisation that ships with the model rather than
 * phonemising anything here. Both large files are fetched once and kept,
 * because a reader turns pages.
 */
import type { MushafWord } from "@/domain/quran";
import {
  parseTokenTable,
  type PhonemeTokenTable,
} from "@/features/recitation-practice/model/phonemeTokens";
import {
  buildSpokenWords,
  mushafPositions,
  type ScorableWord,
} from "@/features/recitation-practice/model/wordPhonemes";
import {
  PRACTICE_PHONEMES_URL,
  PRACTICE_TOKENS_URL,
} from "@/features/recitation-practice/model/practiceConfig";
import {
  modelFileRequest,
  modelFileResponse,
} from "@/features/recitation-practice/services/modelFile";
import { fetchVerseWordTexts } from "@/features/recitation-practice/services/pageWordText";

interface AyahPhonemes {
  aya_text: string;
  aya_phoneme: string;
  aya_phonemes_list: string[];
}

let tokenTable: Promise<PhonemeTokenTable> | null = null;
let phonemeTable: Promise<Record<string, AyahPhonemes>> | null = null;

function loadTokenTable(reload: boolean): Promise<PhonemeTokenTable> {
  if (reload) tokenTable = null;
  tokenTable ??= fetch(PRACTICE_TOKENS_URL, modelFileRequest(reload))
    .then((response) => modelFileResponse(response, "symbol table").text())
    .then(parseTokenTable)
    .catch((error: unknown) => {
      tokenTable = null;
      throw error;
    });
  return tokenTable;
}

function loadPhonemeTable(
  reload: boolean,
): Promise<Record<string, AyahPhonemes>> {
  if (reload) phonemeTable = null;
  phonemeTable ??= fetch(PRACTICE_PHONEMES_URL, modelFileRequest(reload))
    .then(
      (response) =>
        modelFileResponse(response, "phoneme table").json() as Promise<
          Record<string, AyahPhonemes>
        >,
    )
    .catch((error: unknown) => {
      phonemeTable = null;
      throw error;
    });
  return phonemeTable;
}

/**
 * The sounds a page asks for, in order, each carrying the words it covers.
 *
 * A verse is grouped whole even when the page holds only part of it - the
 * phonological boundaries depend on the whole ayah - and then only the sounds
 * that touch this page are kept.
 *
 * `reload` fetches both tables past the browser's copies, after the reader
 * asked for the model to be downloaded again.
 */
export async function buildPageSpokenWords(
  pageWords: readonly MushafWord[],
  { reload = false }: { reload?: boolean } = {},
): Promise<ScorableWord[]> {
  const recitable = pageWords.filter((word) => word.char_type !== "end");
  if (recitable.length === 0) return [];

  const [{ inventory, symbols }, phonemes] = await Promise.all([
    loadTokenTable(reload),
    loadPhonemeTable(reload),
  ]);
  const idOf = new Map<string, number>();
  symbols.forEach((symbol, id) => {
    if (symbol && symbol !== "<blank>") idOf.set(symbol, id);
  });

  const byVerse = new Map<string, MushafWord[]>();
  for (const word of recitable) {
    const existing = byVerse.get(word.verse_key);
    if (existing) existing.push(word);
    else byVerse.set(word.verse_key, [word]);
  }

  const spoken: ScorableWord[] = [];
  for (const [verseKey, words] of byVerse) {
    const ayah = phonemes[verseKey];
    if (!ayah) continue;

    // Positions on the page, so a verse split across two pages keeps only its
    // own half on each.
    const onThisPage = new Map(words.map((word) => [word.word, word.location]));
    const pageLocations = new Set(onThisPage.values());
    const datasetWords = ayah.aya_text.trim().split(/\s+/);
    const positions = mushafPositions(
      datasetWords,
      await fetchVerseWordTexts(verseKey),
    );
    const written = datasetWords.map((text, index) => {
      const position = positions[index]!;
      return {
        location: onThisPage.get(position) ?? `${verseKey}:${position}`,
        text,
      };
    });

    for (const sound of buildSpokenWords(
      written,
      ayah.aya_phonemes_list,
      inventory,
    )) {
      // A mushaf word the dataset splits in two can appear twice in a sound.
      const here = [...new Set(sound.locations)].filter((location) =>
        pageLocations.has(location),
      );
      if (here.length === 0) continue;
      spoken.push({
        ...sound,
        locations: here,
        ids: sound.units
          .map((unit) => idOf.get(unit))
          .filter((id): id is number => id !== undefined),
      });
    }
  }

  return spoken;
}
