import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpenText,
  GraduationCap,
  LockKeyhole,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { DEMO_AYAH_LABEL } from "@/domain/quran";

export function HomePage() {
  const { t } = useTranslation("home");

  return (
    <div className="space-y-8 md:space-y-12">
      <section className="editorial-panel editorial-panel--hero relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-[12%] top-0 -z-10 h-px bg-gradient-to-r from-transparent via-accent to-transparent"
        />
        <p className="editorial-kicker inline-flex items-center gap-2">
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          {t("eyebrow")}
        </p>
        <h1 className="mx-auto mt-5 max-w-3xl text-balance text-display">
          {t("title")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-body text-muted-foreground">
          {t("description")}
        </p>

        <div
          className="editorial-rule mx-auto my-8 max-w-xl"
          aria-hidden="true"
        >
          <span className="h-1.5 w-1.5 rotate-45 bg-accent" />
        </div>

        <figure>
          <blockquote
            lang="ar"
            dir="rtl"
            aria-label={DEMO_AYAH_LABEL}
            className="quran-snippet text-3xl leading-loose text-foreground sm:text-4xl"
          >
            {DEMO_AYAH_LABEL}
          </blockquote>
          <figcaption className="mt-2 text-caption font-medium text-muted-foreground">
            {t("verseReference")}
          </figcaption>
        </figure>
      </section>

      <section
        aria-label={t("reader.title")}
        className="grid gap-5 md:grid-cols-2"
      >
        <article className="editorial-panel group flex flex-col">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <BookOpenText aria-hidden="true" className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="editorial-kicker">{t("reader.label")}</p>
              <h2 className="mt-2">{t("reader.title")}</h2>
            </div>
          </div>
          <p className="mt-5 text-body text-muted-foreground">
            {t("reader.description")}
          </p>
          <Button asChild size="lg" className="mt-6 w-full sm:mt-auto sm:w-fit">
            <Link to="/quran/page/1">
              {t("reader.action")}
              <ArrowUpRight
                aria-hidden="true"
                className="h-4 w-4 rtl:-scale-x-100"
              />
            </Link>
          </Button>
        </article>

        <article className="editorial-panel group flex flex-col">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/15 text-[var(--accent-strong)]">
              <GraduationCap aria-hidden="true" className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="editorial-kicker">{t("quiz.label")}</p>
              <h2 className="mt-2">{t("quiz.title")}</h2>
            </div>
          </div>
          <p className="mt-5 text-body text-muted-foreground">
            {t("quiz.description")}
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="mt-6 w-full sm:mt-auto sm:w-fit"
          >
            <Link to="/quiz">
              {t("quiz.action")}
              <ArrowUpRight
                aria-hidden="true"
                className="h-4 w-4 rtl:-scale-x-100"
              />
            </Link>
          </Button>
        </article>
      </section>

      <section className="editorial-panel editorial-panel--inset flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-start">
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
        <Button asChild variant="ghost" className="min-h-11 shrink-0">
          <Link to="/settings">
            <Settings2 aria-hidden="true" />
            {t("settingsLink")}
          </Link>
        </Button>
      </section>
    </div>
  );
}
