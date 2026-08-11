import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";

export interface QuizQuestionViewProps {
  mushafData: MushafVerse[];
  verseInfoRecords: VerseInfoRecord[];
  answered: boolean;
  isCorrect: boolean | null;
  selectedChoiceId: string | null;
  streak: number;
  onSubmit: (choiceId: string) => void;
  onNext: () => void;
}
