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
/* The rate the recogniser needs, so a reader diagnosing a microphone can say
   whether the browser honoured it without reaching inside this feature. */
export { PRACTICE_SAMPLE_RATE } from "@/features/recitation-practice/model/practiceConfig";
