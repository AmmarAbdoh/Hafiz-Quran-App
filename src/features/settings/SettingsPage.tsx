import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BookMarked,
  Database,
  Globe2,
  HardDrive,
  Info,
  Languages,
  Moon,
  Network,
  Palette,
  Radio,
  Sun,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { PracticePrivacyDisclosure, PracticeSettings } from "@practice/runtime";
import { formatNumber, useLocale } from "@/app/i18n";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { DEMO_AYAH_LABEL, RECITERS } from "@/domain/quran";
import { useReciter, useReciterPreview, useTafseer } from "@/domain/quran";
import { useTheme, type Theme } from "@/shared/hooks/use-theme";
import { cn } from "@/shared/lib/utils";
import { ReciterSelect } from "./components/ReciterSelect";
import { WordByWordLegendDialog } from "./components/WordByWordLegendDialog";

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const titleId = useId();

  return (
    <section
      className="editorial-panel editorial-panel--flush overflow-hidden"
      aria-labelledby={titleId}
    >
      <header className="flex items-start gap-4 border-b border-border/80 px-5 py-5 sm:px-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 id={titleId}>{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </header>
      <div className="space-y-5 px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

const tafseerTranslationKeys = {
  "1": "interpretation.options.one",
  "2": "interpretation.options.two",
  "3": "interpretation.options.three",
  "4": "interpretation.options.four",
  "5": "interpretation.options.five",
  "6": "interpretation.options.six",
  "7": "interpretation.options.seven",
  "8": "interpretation.options.eight",
} as const;

export function SettingsPage() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const { t: tA11y } = useTranslation("a11y");
  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const { reciter, setReciterId } = useReciter();
  const { tafseerId, setTafseerId } = useTafseer();
  const { preview, isPreviewPlaying } = useReciterPreview(reciter);
  const [wordByWordGuideOpen, setWordByWordGuideOpen] = useState(false);

  const chooseTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="mb-8">
        <p className="editorial-kicker">{tCommon("appName")}</p>
        <h1 className="mt-3 tracking-tight">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-body text-muted-foreground">
          {t("description")}
        </p>
      </header>

      <SettingsSection
        icon={Palette}
        title={t("appearance.title")}
        description={t("appearance.description")}
      >
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">
            {t("appearance.languageLabel")}
          </legend>
          <div
            className="grid grid-cols-2 gap-2 rounded-xl bg-muted/70 p-1.5"
            aria-label={tA11y("chooseLanguage")}
          >
            {(["ar", "en"] as const).map((language) => (
              <button
                key={language}
                type="button"
                onClick={() => setLocale(language)}
                aria-pressed={locale === language}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors",
                  locale === language
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Languages aria-hidden="true" className="h-4 w-4" />
                {language === "ar"
                  ? tCommon("language.arabic")
                  : tCommon("language.english")}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold">
            {t("appearance.themeLabel")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => chooseTheme("light")}
              aria-pressed={theme === "light"}
              className={cn(
                "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
                theme === "light"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <Sun aria-hidden="true" className="h-4 w-4" />
              {t("appearance.lightOption")}
            </button>
            <button
              type="button"
              onClick={() => chooseTheme("dark")}
              aria-pressed={theme === "dark"}
              className={cn(
                "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
                theme === "dark"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <Moon aria-hidden="true" className="h-4 w-4" />
              {t("appearance.darkOption")}
            </button>
          </div>
        </fieldset>
      </SettingsSection>

      <SettingsSection
        icon={Radio}
        title={t("recitation.title")}
        description={t("recitation.description")}
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="reciter-select">
              {t("recitation.reciterLabel")}
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 px-2 text-sm text-primary"
              onClick={() => setWordByWordGuideOpen(true)}
            >
              <Info aria-hidden="true" />
              {t("recitation.wordHighlightHelp")}
            </Button>
          </div>
          <ReciterSelect
            id="reciter-select"
            value={reciter.id}
            onValueChange={setReciterId}
            onWordHighlightGuideClick={() => setWordByWordGuideOpen(true)}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="min-h-12 w-full justify-between gap-3"
          onClick={preview}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Volume2
              aria-hidden="true"
              className={cn(
                "shrink-0",
                isPreviewPlaying && "animate-pulse text-primary",
              )}
            />
            <span>{t("recitation.preview")}</span>
          </span>
          <span
            lang="ar"
            dir="rtl"
            className="quran-snippet min-w-0 truncate text-base text-muted-foreground"
          >
            {DEMO_AYAH_LABEL}
          </span>
        </Button>
        <p className="text-caption text-muted-foreground">
          {t("recitation.count", {
            count: formatNumber(RECITERS.length, locale),
          })}
        </p>
      </SettingsSection>

      <SettingsSection
        icon={BookMarked}
        title={t("interpretation.title")}
        description={t("interpretation.description")}
      >
        <Label htmlFor="tafseer-select">{t("interpretation.label")}</Label>
        <select
          id="tafseer-select"
          value={tafseerId}
          onChange={(event) => setTafseerId(event.target.value)}
          className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
        >
          {Object.entries(tafseerTranslationKeys).map(([id, key]) => (
            <option key={id} value={id}>
              {t(key)}
            </option>
          ))}
        </select>
      </SettingsSection>

      <PracticeSettings />

      <SettingsSection
        icon={HardDrive}
        title={t("privacy.title")}
        description={t("privacy.description")}
      >
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <Database aria-hidden="true" className="h-4 w-4" />
          {t("privacy.noAccount")}
        </p>
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <Network
              aria-hidden="true"
              className="h-4 w-4 text-[var(--accent-strong)]"
            />
            {t("privacy.externalTitle")}
          </h3>
          <ul className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
            <li className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{t("privacy.quranData")}</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{t("privacy.audio")}</span>
            </li>
            <PracticePrivacyDisclosure />
          </ul>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Globe2}
        title={t("sources.title")}
        description={t("sources.description")}
      >
        <Button asChild variant="secondary" size="lg" className="w-full">
          <Link to="/about">{t("sources.action")}</Link>
        </Button>
      </SettingsSection>

      <WordByWordLegendDialog
        open={wordByWordGuideOpen}
        onOpenChange={setWordByWordGuideOpen}
        reciterId={reciter.id}
      />
    </div>
  );
}
