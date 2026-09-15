import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  List,
  Loader2,
  Mic,
  Moon,
  MoreHorizontal,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  Volume2,
} from "lucide-react";
import { formatNumber, useLocale } from "@/app/i18n";
import { useSurahNames } from "@/domain/quran";
import type { MushafReaderHeaderState } from "@/features/quran-reader/context/MushafReaderContext";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { RECITATION_PRACTICE_AVAILABLE as RECITATION_PRACTICE_ENABLED } from "@practice/runtime";
import { useTheme } from "@/shared/hooks/use-theme";

type MushafReaderHeaderProps = MushafReaderHeaderState;

export function MushafReaderHeader({
  surahLabel,
  page,
  practiceActive,
  practiceLoading,
  onOpenSurahDrawer,
  onOpenAyahSearch,
  onOpenListenOptions,
  onOpenReadingPreferences,
  onTogglePractice,
}: MushafReaderHeaderProps) {
  const { t, i18n } = useTranslation("reader");
  const { locale } = useLocale();
  const { language: surahLanguage } = useSurahNames();
  const { theme, toggleTheme } = useTheme();
  const rtl = i18n.dir() === "rtl";
  const HomeIcon = rtl ? ArrowRight : ArrowLeft;

  return (
    <header className="mushaf-reader-header">
      <div className="mx-auto grid max-w-content grid-cols-[auto_1fr_auto] items-center gap-1 px-2 py-1 sm:gap-2 sm:px-4 sm:py-2">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link to="/" aria-label={t("header.home")} title={t("header.home")}>
            <HomeIcon className="h-5 w-5" aria-hidden />
          </Link>
        </Button>

        {/* Names the reading; the juz, hizb and progress sit in the folio line
            at the foot of the page so neither line is crowded. */}
        <p className="flex min-w-0 items-center justify-center gap-1.5 text-label text-muted-foreground">
          {surahLabel ? (
            <>
              <bdi
                dir={surahLanguage === "ar" ? "rtl" : "ltr"}
                lang={surahLanguage}
                className="truncate font-semibold text-foreground"
              >
                {surahLabel}
              </bdi>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span className="shrink-0">
            {t("status.page", { page: formatNumber(page, locale) })}
          </span>
        </p>

        <DropdownMenu dir={i18n.dir()}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="justify-self-end"
              aria-label={t("header.more")}
              title={t("header.more")}
            >
              {/* Not SlidersHorizontal: that is the Preferences item's own
                  icon, one level down inside this very menu. */}
              <MoreHorizontal className="h-5 w-5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align={rtl ? "start" : "end"}>
            {/*
              Radix hands onSelect the select event. The reader's listen action
              takes an optional preset, so it has to be called with no argument
              or the event stands in for the current page and surah.
            */}
            <DropdownMenuItem onSelect={() => onOpenListenOptions()}>
              <Volume2 className="h-4 w-4 shrink-0" aria-hidden />
              {t("header.listen")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenSurahDrawer}>
              <List className="h-4 w-4 shrink-0" aria-hidden />
              {t("header.surahs")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenAyahSearch}>
              <Search className="h-4 w-4 shrink-0" aria-hidden />
              {t("header.searchAyah")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={onOpenReadingPreferences}>
              <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
              {t("preferences.title")}
            </DropdownMenuItem>

            {RECITATION_PRACTICE_ENABLED && (
              <DropdownMenuItem
                onSelect={onTogglePractice}
                disabled={practiceLoading && !practiceActive}
              >
                {practiceLoading && !practiceActive ? (
                  <Loader2
                    className="h-4 w-4 shrink-0 animate-spin"
                    aria-hidden
                  />
                ) : (
                  <Mic className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {t("header.practice")}
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={toggleTheme}>
              {theme === "dark" ? (
                <Sun className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Moon className="h-4 w-4 shrink-0" aria-hidden />
              )}
              {theme === "dark"
                ? t("header.switchToLight")
                : t("header.switchToDark")}
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings className="h-4 w-4 shrink-0" aria-hidden />
                {t("header.settings")}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
