import { useTranslation } from "react-i18next";
import type { WordFeedback } from "@/features/recitation-practice/services/recitationHistory";
import { cn } from "@/shared/lib/utils";

/*
 * The reader's word on the verdict, asked where the verdict is read.
 *
 * Shared by the summary after a run and the kept recordings in settings,
 * which both apply each answer to the stored one (`updateRecitationFeedback`)
 * so neither writes over the other's. Pressing the chosen answer again takes
 * it back: a mis-tap must not become a label.
 */

const ANSWERS = [
  { value: "mistake", label: "practice.feedback.mistake" },
  { value: "saidRight", label: "practice.feedback.saidRight" },
] as const satisfies readonly { value: WordFeedback; label: string }[];

/** "My mistake" or "I said it right", for one listed word. */
export function WordFeedbackChoice({
  word,
  value,
  onChange,
}: {
  word: string;
  value: WordFeedback | undefined;
  onChange: (value: WordFeedback | undefined) => void;
}) {
  const { t } = useTranslation("reader");
  return (
    <div
      role="group"
      aria-label={t("practice.feedback.question", { word })}
      className="flex flex-wrap gap-1.5"
    >
      {ANSWERS.map((answer) => (
        <FeedbackToggle
          key={answer.value}
          pressed={value === answer.value}
          onPressedChange={(pressed) =>
            onChange(pressed ? answer.value : undefined)
          }
          /* The visible words first, then the word it answers for: someone
             using voice control says what they see (WCAG 2.5.3). */
          aria-label={t("practice.feedback.answerFor", {
            answer: t(answer.label),
            word,
          })}
          tone={answer.value === "mistake" ? "mistake" : "right"}
        >
          {t(answer.label)}
        </FeedbackToggle>
      ))}
    </div>
  );
}

/** "I made a mistake that is not listed", for the run as a whole. */
export function MissedMistakeToggle({
  pressed,
  onPressedChange,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}) {
  const { t } = useTranslation("reader");
  return (
    <FeedbackToggle
      pressed={pressed}
      onPressedChange={onPressedChange}
      tone="mistake"
    >
      {t("practice.feedback.missed")}
    </FeedbackToggle>
  );
}

function FeedbackToggle({
  pressed,
  onPressedChange,
  tone,
  children,
  "aria-label": ariaLabel,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  tone: "mistake" | "right";
  children: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "min-h-9 rounded-full border px-3 text-label font-medium transition-colors duration-fast ease-standard",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !pressed &&
          "border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground",
        pressed &&
          tone === "mistake" &&
          "border-destructive bg-destructive/10 text-destructive",
        pressed &&
          tone === "right" &&
          "border-success bg-success/15 text-success",
      )}
    >
      {children}
    </button>
  );
}
