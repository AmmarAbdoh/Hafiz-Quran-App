import { useEffect, useState } from "react";
import {
  checkFillBlankAnswer,
  generateHiddenIndex,
  getHiddenPlaceholder,
} from "@/features/quiz/lib/question-utils";
import { QuizFeedback } from "@/features/quiz/components/QuizFeedback";
import { SearchDropdown } from "@/shared/components/SearchDropdown";
import {
  getPrevAndNextVerse,
  getVerseInfo,
  loadImlaeiVerses,
  loadUthmaniVerses,
  loadVerseInfoRecords,
} from "@/shared/services/quran-data";
import { cn } from "@/shared/lib/utils";
import type { UthmaniVerse, VerseInfoItem } from "@/shared/types/quran";

interface FillBlankQuestionProps {
  verse: UthmaniVerse;
  onNext: () => void;
}

export function FillBlankQuestion({ verse, onNext }: FillBlankQuestionProps) {
  const [prevVerse, setPrevVerse] = useState<UthmaniVerse | null>(null);
  const [nextVerse, setNextVerse] = useState<UthmaniVerse | null>(null);
  const [hiddenIndex, setHiddenIndex] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [imlaeiMap, setImlaeiMap] = useState<Record<string, string>>({});
  const [searchOptions, setSearchOptions] = useState<string[]>([]);
  const [verseInfo, setVerseInfo] = useState<VerseInfoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const coveredVerse =
    hiddenIndex === 0 ? prevVerse : hiddenIndex === 2 ? nextVerse : verse;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [allVerses, imlaeiVerses, records] = await Promise.all([
        loadUthmaniVerses(),
        loadImlaeiVerses(),
        loadVerseInfoRecords(),
      ]);

      if (cancelled) return;

      const [prev, next] = getPrevAndNextVerse(verse, allVerses);
      setPrevVerse(prev);
      setNextVerse(next);

      const index = generateHiddenIndex(!!prev, true, !!next);
      setHiddenIndex(index);

      const map: Record<string, string> = {};
      for (const v of imlaeiVerses) {
        map[v.verse_key] = v.text_imlaei;
      }
      setImlaeiMap(map);
      setSearchOptions(imlaeiVerses.map((v) => v.text_imlaei));

      const covered =
        index === 0 ? prev : index === 2 ? next : verse;
      if (covered) {
        setVerseInfo(getVerseInfo(covered.id, records));
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [verse]);

  const handleAnswer = (selectedText: string) => {
    if (!coveredVerse) return;
    const correctText = imlaeiMap[coveredVerse.verse_key] ?? "";
    setIsCorrect(checkFillBlankAnswer(selectedText, correctText));
  };

  const renderVerse = (
    v: UthmaniVerse | null,
    index: number,
  ) => {
    if (!v) return null;
    const ayahNo = v.verse_key.split(":")[1];
    const isHidden = hiddenIndex === index;
    const imlaeiText = imlaeiMap[v.verse_key] ?? "";

    return (
      <span className="inline">
        <span
          className={cn(
            "quran-text font-mushaf text-xl leading-loose",
            isHidden && isCorrect === true && "text-green-600",
            isHidden && isCorrect === false && "text-red-600 line-through",
          )}
        >
          {isHidden && isCorrect === null
            ? getHiddenPlaceholder(imlaeiText.length)
            : v.text_uthmani}
        </span>
        <span className="mx-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-xs text-accent">
          {ayahNo}
        </span>
      </span>
    );
  };

  if (loading || hiddenIndex === null) {
    return <div className="text-center py-8">تحميل...</div>;
  }

  return (
    <div className="text-center leading-loose">
      {renderVerse(prevVerse, 0)}
      {renderVerse(verse, 1)}
      {renderVerse(nextVerse, 2)}

      {isCorrect === null && (
        <SearchDropdown
          placeholder="ابحث عن الاية..."
          options={searchOptions}
          selectedLabel="الاية المختارة"
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
