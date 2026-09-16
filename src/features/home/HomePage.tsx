import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Flame,
  GraduationCap,
  LockKeyhole,
  Settings2,
  Sparkles,
  Target,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
import { Panel } from "@/shared/components/Panel";
import { Button } from "@/shared/components/ui/button";
import { DEMO_AYAH_LABEL, useSurahNames } from "@/domain/quran";
import { useQuizProgress } from "@/features/quiz";
import {
  useReaderPositionSnapshot,
  useResumeReaderPath,
} from "@/features/quran-reader";

export function HomePage() {
  const { t } = useTranslation("home");
  const { locale } = useLocale();
  const { surahName } = useSurahNames();
  const readerPath = useResumeReaderPath();
  const savedPosition = useReaderPositionSnapshot();
  const progress = useQuizProgress();

  const positionLine = savedPosition
    ? savedPosition.layout === "page"
      ? t("continue.pageDescription", {
          page: formatNumber(savedPosition.page, locale),
        })
      : savedPosition.ayah
        ? t("continue.ayahDescription", {
            surahName: surahName(savedPosition.surah),
            ayah: formatNumber(savedPosition.ayah, locale),
          })
        : t("continue.surahDescription", {
            surahName: surahName(savedPosition.surah),
          })
    : t("reader.description");

  return (
    <div className="space-y-6 md:space-y-10">
      {/*
        The identity is always here. It used to be swapped out for the resume
        card, so the moment anyone actually used the app it disappeared for
        good and the page's h1 became "Continue reading".
      */}
      <header>
        <p className="editorial-kicker inline-flex items-center gap-2">
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          {t("eyebrow")}
        </p>
        <h1 className="mt-3 text-balance text-title">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-balance text-body text-muted-foreground">
          {t("description")}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        {/*
          One reader action, not two. There used to be a resume button and a
          reader-card button side by side, differently labelled and pointing
          at the identical path.
        */}
        <Panel
          as="section"
          variant="hero"
          className="flex flex-col gap-5 text-start"
        >
          <div className="min-w-0">
            <p className="editorial-kicker">
              {savedPosition ? t("continue.label") : t("reader.label")}
            </p>
            <h2 className="mt-2 text-balance">
              {savedPosition ? t("continue.title") : t("reader.title")}
            </h2>
            <p className="mt-2 text-body text-muted-foreground">
              {positionLine}
            </p>
          </div>

          <Button asChild size="lg" className="w-full sm:w-fit">
            <Link to={readerPath}>
              {savedPosition ? t("continue.action") : t("reader.action")}
              <ArrowUpRight
                aria-hidden="true"
                className="h-4 w-4 rtl:-scale-x-100"
              />
            </Link>
          </Button>

          {/* The welcome ayah stays for a first visit and steps aside once
              there is a position to return to. */}
          {!savedPosition && (
            <figure className="border-t border-border-subtle pt-5">
              <blockquote
                lang="ar"
                dir="rtl"
                aria-label={DEMO_AYAH_LABEL}
                className="quran-snippet text-2xl leading-loose text-foreground sm:text-3xl"
              >
                {DEMO_AYAH_LABEL}
              </blockquote>
              <figcaption className="mt-2 text-label font-medium text-muted-foreground">
                {t("verseReference")}
              </figcaption>
            </figure>
          )}
        </Panel>

        <ReviewPanel progress={progress} />
      </div>

      <Panel
        variant="inset"
        className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-start"
      >
        <div className="flex items-start gap-3">
          <LockKeyhole
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-primary"
          />
          <div>
            <h2>{t("privacy.title")}</h2>
            <p className="mt-2 text-body text-muted-foreground">
              {t("privacy.description")}
            </p>
          </div>
        </div>
        <Button asChild variant="ghost" className="shrink-0">
          <Link to="/settings">
            <Settings2 aria-hidden="true" />
            {t("settingsLink")}
          </Link>
        </Button>
      </Panel>
    </div>
  );
}

/**
 * Streak, recent accuracy and the backlog of missed ayahs were all written to
 * storage after every session and never read back, so the app asked people to
 * memorize and then told them nothing about how it was going. This is the
 * strongest reason to open it tomorrow.
 */
function ReviewPanel({
  progress,
}: {
  progress: ReturnType<typeof useQuizProgress>;
}) {
  const { t } = useTranslation("home");
  const { locale } = useLocale();
  const hasHistory = progress.sessions > 0;

  return (
    <Panel as="section" className="flex flex-col gap-5">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-accent/15 text-[var(--accent-strong)]">
          <GraduationCap aria-hidden="true" className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="editorial-kicker">{t("quiz.label")}</p>
          <h2 className="mt-2">{t("progress.title")}</h2>
        </div>
      </div>

      {hasHistory ? (
        <dl className="grid grid-cols-2 gap-4">
          <Stat
            icon={<Flame aria-hidden="true" className="h-4 w-4" />}
            value={
              progress.streakDays > 0
                ? formatNumber(progress.streakDays, locale)
                : "—"
            }
            label={
              progress.streakDays > 0
                ? t("progress.streak")
                : t("progress.streakEmpty")
            }
          />
          <Stat
            value={
              progress.recentAccuracy === null
                ? "—"
                : // The percent sign is ٪ in Arabic, so it is part of the
                  // string rather than something appended to the number.
                  t("progress.percentage", {
                    count: formatNumber(
                      Math.round(progress.recentAccuracy * 100),
                      locale,
                    ),
                  })
            }
            label={t("progress.accuracy")}
          />
          <Stat
            className="col-span-2"
            icon={<Target aria-hidden="true" className="h-4 w-4" />}
            value={
              progress.weakVerseCount > 0
                ? formatNumber(progress.weakVerseCount, locale)
                : "—"
            }
            label={
              progress.weakVerseCount > 0
                ? t("progress.weak")
                : t("progress.weakEmpty")
            }
          />
        </dl>
      ) : (
        <p className="text-body text-muted-foreground">{t("progress.empty")}</p>
      )}

      <Button asChild variant="secondary" size="lg" className="w-full sm:w-fit">
        <Link to="/quiz">
          {progress.weakVerseCount > 0
            ? t("progress.review")
            : t("quiz.action")}
          <ArrowUpRight
            aria-hidden="true"
            className="h-4 w-4 rtl:-scale-x-100"
          />
        </Link>
      </Button>
    </Panel>
  );
}

function Stat({
  icon,
  value,
  label,
  className,
}: {
  icon?: ReactNode;
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-label text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-heading font-bold tabular-nums">{value}</dd>
    </div>
  );
}
