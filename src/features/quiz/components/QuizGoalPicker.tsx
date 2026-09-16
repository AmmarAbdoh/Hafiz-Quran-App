import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CalendarCheck,
  Sliders,
  Target,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSurahNames } from "@/domain/quran";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/lib/utils";
import { useQuizFormatters } from "../hooks/useQuizFormatters";
import type { QuizGoalId, ReadingPosition } from "../model/quizGoals";

interface QuizGoalPickerProps {
  position: ReadingPosition | null;
  weakVerseCount: number;
  surahNumber: number;
  onSurahNumberChange: (surah: number) => void;
  onStart: (goal: QuizGoalId) => void;
}

/**
 * Nine concepts used to stand between opening this page and answering a
 * question - scope, scope mode, juz by incipit, hizb, question type, recall
 * versus location grouping, preset level, session mode, and pool versus count.
 * A goal names none of them; it states what the learner wants and derives the
 * rest. The manual wizard is still here, as one of the goals.
 */
export function QuizGoalPicker({
  position,
  weakVerseCount,
  surahNumber,
  onSurahNumberChange,
  onStart,
}: QuizGoalPickerProps) {
  const { t } = useTranslation("quiz");
  const { formatNumber } = useQuizFormatters();
  const { names, surahName } = useSurahNames();

  const todayDescription = !position
    ? t("goals.today.fallback")
    : position.layout === "page"
      ? t("goals.today.page", { page: formatNumber(position.page) })
      : t("goals.today.surah", { surahName: surahName(position.surah) });

  return (
    <section aria-labelledby="quiz-goals-title" className="space-y-4">
      <div>
        <h2 id="quiz-goals-title">{t("goals.title")}</h2>
        <p className="mt-2 text-body text-muted-foreground">
          {t("goals.description")}
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        <GoalCard
          icon={<CalendarCheck aria-hidden="true" className="h-5 w-5" />}
          title={t("goals.today.title")}
          description={todayDescription}
          actionLabel={t("goals.start")}
          onStart={() => onStart("today")}
        />

        <GoalCard
          icon={<Target aria-hidden="true" className="h-5 w-5" />}
          title={t("goals.weak.title")}
          description={
            weakVerseCount > 0
              ? t("goals.weak.description", {
                  count: weakVerseCount,
                  formattedCount: formatNumber(weakVerseCount),
                })
              : t("goals.weak.empty")
          }
          actionLabel={t("goals.start")}
          // Nothing missed yet means there is nothing to drill, and a button
          // that starts an empty quiz is a button that does nothing.
          disabled={weakVerseCount === 0}
          onStart={() => onStart("weak")}
        />

        <GoalCard
          icon={<BookOpen aria-hidden="true" className="h-5 w-5" />}
          title={t("goals.surah.title")}
          description={t("goals.surah.description")}
          actionLabel={t("goals.start")}
          onStart={() => onStart("surah")}
        >
          {/* SearchableSelect renders a trigger button, not a native select,
              so the picker needs a real label bound to it - an aria-label prop
              would be dropped, since it takes none. */}
          <div className="space-y-2">
            <Label htmlFor="quiz-goal-surah">{t("goals.surah.picker")}</Label>
            <SearchableSelect
              id="quiz-goal-surah"
              value={String(surahNumber)}
              options={names.map((name, index) => ({
                value: String(index + 1),
                label: `${formatNumber(index + 1)} · ${name}`,
              }))}
              onValueChange={(value) => onSurahNumberChange(Number(value))}
              placeholder={t("goals.surah.picker")}
              searchPlaceholder={t("goals.surah.picker")}
              emptyMessage={t("goals.surah.empty")}
            />
          </div>
        </GoalCard>

        <GoalCard
          icon={<Sliders aria-hidden="true" className="h-5 w-5" />}
          title={t("goals.manual.title")}
          description={t("goals.manual.description")}
          actionLabel={t("goals.manual.title")}
          onStart={() => onStart("manual")}
        />
      </ul>
    </section>
  );
}

function GoalCard({
  icon,
  title,
  description,
  actionLabel,
  disabled,
  onStart,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  disabled?: boolean;
  onStart: () => void;
  children?: ReactNode;
}) {
  return (
    <li className="editorial-panel flex flex-col gap-4">
      <div className="flex items-start gap-3">
        {/* Only the badge dims. The line saying why a goal is unavailable has
            to stay readable - it is the one thing worth reading on it - and
            fading the card took it to 2.67:1 against the panel. */}
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary",
            disabled && "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-subheading font-semibold">{title}</h3>
          <p className="mt-1 text-label text-muted-foreground">{description}</p>
        </div>
      </div>

      {children}

      <Button
        type="button"
        size="lg"
        className="mt-auto w-full sm:w-fit"
        disabled={disabled}
        onClick={onStart}
      >
        {actionLabel}
        {/* Visually one word, but three cards would otherwise offer three
            buttons all named "Start". The goal is appended rather than
            replacing it so the accessible name still contains what is seen. */}
        {actionLabel !== title && <span className="sr-only">: {title}</span>}
        <ArrowUpRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" />
      </Button>
    </li>
  );
}
