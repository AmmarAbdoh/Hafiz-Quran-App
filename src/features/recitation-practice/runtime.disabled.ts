import { Fragment, createElement } from "react";
import type {
  RecitationPracticeProviderProps,
  RecitationPracticeTelemetry,
  RecitationPracticeValue,
} from "@/features/recitation-practice/contract";
import {
  initialRecitationPracticeState,
  initialRecitationPracticeTelemetry,
} from "@/features/recitation-practice/model/practiceState";

const doNothing = () => undefined;
const resolveWithoutStarting = () => Promise.resolve();

const disabledValue: RecitationPracticeValue = Object.freeze({
  ...initialRecitationPracticeState,
  hideAyat: true,
  toggleHideAyat: doNothing,
  startPractice: resolveWithoutStarting,
  stopPractice: doNothing,
  togglePractice: resolveWithoutStarting,
});

const disabledTelemetry: RecitationPracticeTelemetry = Object.freeze({
  ...initialRecitationPracticeTelemetry,
});

export const RECITATION_PRACTICE_AVAILABLE = false;

export function PracticeSettings() {
  return null;
}

export function PracticePrivacyDisclosure() {
  return null;
}

export function RecitationPracticeProvider({
  children,
}: RecitationPracticeProviderProps) {
  return createElement(Fragment, null, children);
}

export function useRecitationPractice(): RecitationPracticeValue {
  return disabledValue;
}

export function useRecitationPracticeTelemetry(): RecitationPracticeTelemetry {
  return disabledTelemetry;
}
