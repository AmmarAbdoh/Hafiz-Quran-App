import { generateHiddenIndex } from "@/features/quiz/lib/question-utils";
import type {
  AudioIdentifyQuizQuestion,
  CompleteAyahQuizQuestion,
  FillBlankQuizQuestion,
  InfoQuizQuestion,
  QuizChoice,
  QuizQuestion,
} from "@/features/quiz/lib/quiz-types";
import {
  getAdjacentVersesInSurah,
  shuffleArray,
  toVerseKey,
} from "@/features/quiz/lib/versePool";
import { SURAH_NAMES } from "@/shared/constants/quran";
import { getVerseInfo } from "@/shared/services/quran-data";
import { normalizeArabicForMatch } from "@/shared/lib/arabic-normalize";
import type {
  MushafVerse,
  QuestionType,
  VerseInfoRecord,
} from "@/shared/types/quran";

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildChoices(
  correctId: string,
  correctLabel: string,
  distractors: Array<{ id: string; label: string }>,
  count = 4,
): QuizChoice[] {
  const unique = new Map<string, QuizChoice>();
  unique.set(correctId, { id: correctId, label: correctLabel });

  for (const item of shuffleArray(distractors)) {
    if (unique.size >= count) break;
    if (!unique.has(item.id)) {
      unique.set(item.id, item);
    }
  }

  while (unique.size < count && distractors.length > 0) {
    const filler = distractors[unique.size % distractors.length];
    if (filler && !unique.has(filler.id)) {
      unique.set(filler.id, filler);
    } else {
      break;
    }
  }

  return shuffleArray([...unique.values()]);
}

function splitAyahForCompletion(text: string): {
  prompt: string;
  continuation: string;
} {
  const words = text.trim().split(/\s+/);
  if (words.length <= 2) {
    return {
      prompt: words[0] ?? text,
      continuation: words.slice(1).join(" ") || text,
    };
  }

  const splitAt = Math.max(1, Math.floor(words.length * 0.45));
  return {
    prompt: words.slice(0, splitAt).join(" "),
    continuation: words.slice(splitAt).join(" "),
  };
}

function getInfoCorrectValue(
  type: InfoQuizQuestion["type"],
  verse: MushafVerse,
  records: VerseInfoRecord[],
): string {
  const info = getVerseInfo(verse.id, records);
  const mapping: Record<InfoQuizQuestion["type"], number> = {
    surah_name: 0,
    ayah_number: 1,
    juz_number: 2,
    hizb_number: 3,
    page_number: 4,
  };
  return String(info[mapping[type]]?.value ?? "");
}

function buildSearchLabel(verse: MushafVerse): string {
  const surahName = SURAH_NAMES[verse.sura_no - 1] ?? `سورة ${verse.sura_no}`;
  return `${verse.aya_text_emlaey} · ${surahName} ${verse.aya_no}`;
}

function generateFillBlank(
  verse: MushafVerse,
  pool: MushafVerse[],
  mushafData: MushafVerse[],
): FillBlankQuizQuestion {
  const { prev, next } = getAdjacentVersesInSurah(pool, mushafData, verse);
  const hiddenIndex = generateHiddenIndex(Boolean(prev), true, Boolean(next));
  const hiddenVerse =
    hiddenIndex === 0 ? prev! : hiddenIndex === 2 ? next! : verse;

  const searchOptions = shuffleArray(
    pool.map((item) => ({
      id: toVerseKey(item),
      label: buildSearchLabel(item),
    })),
  );

  return {
    id: createId(),
    type: "fill_blank",
    verse,
    verseKey: toVerseKey(verse),
    hiddenVerse,
    hiddenVerseKey: toVerseKey(hiddenVerse),
    page: hiddenVerse.page,
    searchOptions,
  };
}

function generateCompleteAyah(
  verse: MushafVerse,
  pool: MushafVerse[],
): CompleteAyahQuizQuestion {
  const { prompt, continuation } = splitAyahForCompletion(verse.aya_text);
  const correctId = toVerseKey(verse);

  const distractors = shuffleArray(
    pool
      .filter((item) => toVerseKey(item) !== correctId)
      .map((item) => {
        const parts = splitAyahForCompletion(item.aya_text);
        return {
          id: `${toVerseKey(item)}-cont`,
          label: parts.continuation,
        };
      }),
  ).slice(0, 12);

  const choices = buildChoices(
    `${correctId}-cont`,
    continuation,
    distractors,
  );

  return {
    id: createId(),
    type: "complete_ayah",
    verse,
    verseKey: toVerseKey(verse),
    promptText: prompt,
    choices,
    correctChoiceId: `${correctId}-cont`,
  };
}

function ayahSnippet(text: string, wordCount = 8): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= wordCount) return text.trim();
  return `${words.slice(0, wordCount).join(" ")} …`;
}

function generateAudioIdentify(
  verse: MushafVerse,
  pool: MushafVerse[],
  mushafData: MushafVerse[],
): AudioIdentifyQuizQuestion {
  const surahVerses = mushafData
    .filter((item) => item.sura_no === verse.sura_no)
    .sort((a, b) => a.aya_no - b.aya_no);
  const index = surahVerses.findIndex((item) => item.aya_no === verse.aya_no);
  const nextVerse = surahVerses[index + 1] ?? null;

  // The last ayah of a surah has no "next ayah" — fall back to the surah prompt.
  const useSurahPrompt = nextVerse === null || Math.random() < 0.5;

  if (useSurahPrompt) {
    const correctId = String(verse.sura_no);
    const poolSurahs = [...new Set(pool.map((item) => item.sura_no))].filter(
      (surah) => surah !== verse.sura_no,
    );
    // Prefer surahs from the quiz scope, then fill from the whole mushaf so
    // single-surah scopes still produce a real question.
    const fillerSurahs = Array.from({ length: 114 }, (_, i) => i + 1).filter(
      (surah) => surah !== verse.sura_no && !poolSurahs.includes(surah),
    );
    const distractors = [
      ...shuffleArray(poolSurahs),
      ...shuffleArray(fillerSurahs),
    ].map((surah) => ({
      id: String(surah),
      label: SURAH_NAMES[surah - 1] ?? `سورة ${surah}`,
    }));

    return {
      id: createId(),
      type: "audio_identify",
      verse,
      verseKey: toVerseKey(verse),
      audioPrompt: "surah",
      choices: buildChoices(
        correctId,
        SURAH_NAMES[verse.sura_no - 1] ?? `سورة ${verse.sura_no}`,
        distractors,
      ),
      correctChoiceId: correctId,
    };
  }

  const correctId = toVerseKey(nextVerse);
  const distractors = shuffleArray(
    pool.filter(
      (item) =>
        toVerseKey(item) !== correctId && toVerseKey(item) !== toVerseKey(verse),
    ),
  )
    .slice(0, 12)
    .map((item) => ({
      id: toVerseKey(item),
      label: ayahSnippet(item.aya_text_emlaey),
    }));

  return {
    id: createId(),
    type: "audio_identify",
    verse,
    verseKey: toVerseKey(verse),
    audioPrompt: "next_ayah",
    choices: buildChoices(
      correctId,
      ayahSnippet(nextVerse.aya_text_emlaey),
      distractors,
    ),
    correctChoiceId: correctId,
  };
}

function generateInfoQuestion(
  verse: MushafVerse,
  pool: MushafVerse[],
  records: VerseInfoRecord[],
  type: InfoQuizQuestion["type"],
): InfoQuizQuestion {
  const correctValue = getInfoCorrectValue(type, verse, records);
  const correctId = correctValue;

  let prompt = "";
  const distractors: Array<{ id: string; label: string }> = [];

  switch (type) {
    case "surah_name":
      prompt = "ما اسم السورة لهذه الآية؟";
      for (const surah of new Set(pool.map((item) => item.sura_no))) {
        if (String(surah) === correctId) continue;
        distractors.push({
          id: SURAH_NAMES[surah - 1] ?? String(surah),
          label: SURAH_NAMES[surah - 1] ?? `سورة ${surah}`,
        });
      }
      break;
    case "ayah_number":
      prompt = "ما رقم هذه الآية في سورتها؟";
      for (let ayah = 1; ayah <= 286; ayah += 1) {
        if (String(ayah) === correctId) continue;
        distractors.push({ id: String(ayah), label: String(ayah) });
      }
      break;
    case "juz_number":
      prompt = "ما رقم الجزء؟";
      for (let juz = 1; juz <= 30; juz += 1) {
        if (String(juz) === correctId) continue;
        distractors.push({ id: String(juz), label: String(juz) });
      }
      break;
    case "hizb_number":
      prompt = "ما رقم الحزب؟";
      for (let hizb = 1; hizb <= 60; hizb += 1) {
        if (String(hizb) === correctId) continue;
        distractors.push({ id: String(hizb), label: String(hizb) });
      }
      break;
    case "page_number":
      prompt = "ما رقم الصفحة في المصحف؟";
      for (let page = 1; page <= 604; page += 1) {
        if (String(page) === correctId) continue;
        distractors.push({ id: String(page), label: String(page) });
      }
      break;
  }

  return {
    id: createId(),
    type,
    verse,
    verseKey: toVerseKey(verse),
    prompt,
    choices: buildChoices(correctId, correctValue, shuffleArray(distractors)),
    correctChoiceId: correctId,
  };
}

export function generateQuizQuestion(input: {
  verse: MushafVerse;
  questionType: QuestionType;
  pool: MushafVerse[];
  mushafData: MushafVerse[];
  verseInfoRecords: VerseInfoRecord[];
}): QuizQuestion {
  const { verse, questionType, pool, mushafData, verseInfoRecords } = input;

  switch (questionType) {
    case "fill_blank":
      return generateFillBlank(verse, pool, mushafData);
    case "complete_ayah":
      return generateCompleteAyah(verse, pool);
    case "audio_identify":
      return generateAudioIdentify(verse, pool, mushafData);
    default:
      return generateInfoQuestion(
        verse,
        pool,
        verseInfoRecords,
        questionType,
      );
  }
}

export function getCorrectChoiceId(question: QuizQuestion): string {
  if (question.type === "fill_blank") {
    return question.hiddenVerseKey;
  }
  return question.correctChoiceId;
}

export function checkQuizAnswer(
  question: QuizQuestion,
  selectedChoiceId: string,
  pool: MushafVerse[],
): boolean {
  const correctId = getCorrectChoiceId(question);

  if (question.type === "fill_blank") {
    if (selectedChoiceId === correctId) return true;

    const selectedVerse = pool.find(
      (verse) => toVerseKey(verse) === selectedChoiceId,
    );
    const correctVerse = question.hiddenVerse;

    if (!selectedVerse) return false;

    return (
      normalizeArabicForMatch(selectedVerse.aya_text_emlaey) ===
      normalizeArabicForMatch(correctVerse.aya_text_emlaey)
    );
  }

  return selectedChoiceId === correctId;
}
