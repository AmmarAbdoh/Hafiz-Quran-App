import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

const HELP_ITEMS = [
  "scope",
  "types",
  "session",
  "feedback",
  "history",
] as const;

/**
 * Native disclosure: the quiz needs an explanation on first visit, and no room
 * taken once it is understood.
 */
export function QuizHelpPanel() {
  const { t } = useTranslation("quiz");

  return (
    <details className="editorial-panel--inset rounded-xl [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold marker:content-none">
        <HelpCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {t("help.title")}
      </summary>
      <p className="mt-3 text-sm text-muted-foreground">{t("help.intro")}</p>
      <dl className="mt-3 space-y-2.5 text-sm">
        {HELP_ITEMS.map((item) => (
          <div key={item}>
            <dt className="font-semibold">{t(`help.items.${item}.title`)}</dt>
            <dd className="mt-0.5 text-muted-foreground">
              {t(`help.items.${item}.body`)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
