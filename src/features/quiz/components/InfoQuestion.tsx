import { useEffect, useState } from "react";
import { checkInfoAnswer } from "@/features/quiz/lib/question-utils";
import { QuizFeedback } from "@/features/quiz/components/QuizFeedback";
import { SearchDropdown } from "@/shared/components/SearchDropdown";
import { SURAH_NAMES } from "@/shared/constants/quran";
import { getVerseInfo, loadVerseInfoRecords } from "@/shared/services/quran-data";
import type {
  QuestionType,
  UthmaniVerse,
  VerseInfoItem,
} from "@/shared/types/quran";

interface InfoQuestionProps {
  verse: UthmaniVerse;
  questionType: QuestionType;
  onNext: () => void;
}

function getSearchOptions(type: QuestionType): string[] {
  switch (type) {
    case "surah_name":
      return [...SURAH_NAMES];
    case "ayah_number":
      return Array.from({ length: 286 }, (_, i) => String(i + 1));
    case "juz_number":
      return Array.from({ length: 30 }, (_, i) => String(i + 1));
    case "hizb_number":
      return Array.from({ length: 60 }, (_, i) => String(i + 1));
    case "page_number":
      return Array.from({ length: 604 }, (_, i) => String(i + 1));
    default:
      return [];
  }
}

function getQuestionContent(
  type: QuestionType,
  verse: UthmaniVerse,
  info: VerseInfoItem[],
) {
  const surahName = info[0]?.value ?? "";

  switch (type) {
    case "surah_name":
      return (
        <>
          <p className="mb-4 text-muted-foreground">ما هو اسم السورة لهذه الاية:</p>
          <p className="quran-text font-mushaf text-xl">{verse.text_uthmani}</p>
        </>
      );
    case "ayah_number":
      return (
        <>
          <p className="mb-4 text-muted-foreground">ما هو رقم هذه الاية:</p>
          <p className="quran-text font-mushaf text-xl mb-2">{verse.text_uthmani}</p>
          <p className="text-sm text-muted-foreground">في سورة: {surahName}</p>
        </>
      );
    case "juz_number":
      return (
        <>
          <p className="mb-4 text-muted-foreground">ما هو رقم الجزء للآية:</p>
          <p className="quran-text font-mushaf text-xl mb-2">{verse.text_uthmani}</p>
          <p className="text-sm text-muted-foreground">في سورة: {surahName}</p>
        </>
      );
    case "hizb_number":
      return (
        <>
          <p className="mb-4 text-muted-foreground">ما هو رقم الحزب للآية:</p>
          <p className="quran-text font-mushaf text-xl mb-2">{verse.text_uthmani}</p>
          <p className="text-sm text-muted-foreground">في سورة: {surahName}</p>
        </>
      );
    case "page_number":
      return (
        <>
          <p className="mb-4 text-muted-foreground">ما هو رقم الصفحة للآية:</p>
          <p className="quran-text font-mushaf text-xl mb-2">{verse.text_uthmani}</p>
          <p className="text-sm text-muted-foreground">في سورة: {surahName}</p>
        </>
      );
    default:
      return null;
  }
}

function getCorrectAnswer(
  type: QuestionType,
  info: VerseInfoItem[],
): string {
  const mapping: Record<QuestionType, number> = {
    surah_name: 0,
    ayah_number: 1,
    juz_number: 2,
    hizb_number: 3,
    page_number: 4,
    fill_blank: -1,
  };
  const index = mapping[type];
  return String(info[index]?.value ?? "");
}

export function InfoQuestion({
  verse,
  questionType,
  onNext,
}: InfoQuestionProps) {
  const [verseInfo, setVerseInfo] = useState<VerseInfoItem[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVerseInfoRecords().then((records) => {
      setVerseInfo(getVerseInfo(verse.id, records));
      setLoading(false);
    });
  }, [verse]);

  const handleAnswer = (answer: string) => {
    setIsCorrect(checkInfoAnswer(answer, getCorrectAnswer(questionType, verseInfo)));
  };

  if (loading) {
    return <div className="text-center py-8">تحميل...</div>;
  }

  return (
    <div className="text-center">
      <div className="mb-6">{getQuestionContent(questionType, verse, verseInfo)}</div>

      {isCorrect === null && (
        <SearchDropdown
          placeholder="ابحث..."
          options={getSearchOptions(questionType)}
          onConfirm={handleAnswer}
        />
      )}

      {isCorrect !== null && (
        <QuizFeedback
          isCorrect={isCorrect}
          verseInfo={verseInfo}
          onNext={onNext}
        />
      )}
    </div>
  );
}
