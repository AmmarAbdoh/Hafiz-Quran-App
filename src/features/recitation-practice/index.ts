export {
  RecitationPracticeProvider,
  useRecitationPractice,
  useRecitationPracticeTelemetry,
} from "@/features/recitation-practice/hooks/RecitationPracticeContext";
export {
  PracticePrivacyDisclosure,
  PracticeSettings,
} from "@/features/recitation-practice/components/PracticeSettings";
export { PracticeSummary } from "@/features/recitation-practice/components/PracticeSummary";
export { RecitationHistory } from "@/features/recitation-practice/components/RecitationHistory";
export type { StartingPage } from "@/features/recitation-practice/contract";
/* The rate the recogniser needs, so a reader diagnosing a microphone can say
   whether the browser honoured it without reaching inside this feature. */
export { PRACTICE_SAMPLE_RATE } from "@/features/recitation-practice/model/practiceConfig";
/* So the debug readout can write what was heard as letters, as the summary
   does, rather than in the model's phonetic alphabet. */
export { phonemesAsLetters } from "@/features/recitation-practice/model/phonemeText";
