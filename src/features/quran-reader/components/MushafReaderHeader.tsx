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
import { useSurahNames } from "@/domain/quran";
import type { MushafReaderHeaderState } from "@/features/quran-reader/context/MushafReaderContext";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { MushafLayoutMode } from "@/features/quran-reader/model/quranReaderRoutes";
import { RECITATION_PRACTICE_AVAILABLE as RECITATION_PRACTICE_ENABLED } from "@practice/runtime";
import { useTheme } from "@/shared/hooks/use-theme";

type MushafReaderHeaderProps = MushafReaderHeaderState;

export function MushafReaderHeader({
  surahLabel,
  layoutMode,
  practiceActive,
  practiceLoading,
  onLayoutModeChange,
  onOpenSurahDrawer,
  onOpenAyahSearch,
  onOpenListenOptions,
  onOpenReadingPreferences,
  onTogglePractice,
}: MushafReaderHeaderProps) {
  const { t, i18n } = useTranslation(["reader", "common"]);
  const { language: surahLanguage } = useSurahNames();
  const { theme, toggleTheme } = useTheme();
  const rtl = i18n.dir() === "rtl";
  const HomeIcon = rtl ? ArrowRight : ArrowLeft;
  const layoutOptions: {
    value: MushafLayoutMode;
    label: string;
    hint: string;
  }[] = [
    { value: "page", label: t("layout.page"), hint: t("layout.pageHint") },
    { value: "surah", label: t("layout.surah"), hint: t("layout.surahHint") },
  ];

  return (
    <header className="mushaf-reader-header">
      <div className="mx-auto grid max-w-content grid-cols-[auto_1fr_auto] items-center gap-1 px-2 py-1 sm:gap-2 sm:px-4 sm:py-2">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link to="/" aria-label={t("header.home")} title={t("header.home")}>
            <HomeIcon className="h-5 w-5" aria-hidden />
          </Link>
        </Button>

        {/*
          The surah, and nothing else. The page number is stated continuously
          in the folio line at the foot of the page - inside the navigation
          pill when that is shown, standing alone when it is not - so printing
          it here as well said the same thing twice on one screen and crowded
          the one line that names the reading.

          It is the page's h1. The reader had no heading of any level, so the
          app's main surface gave a screen reader nothing to orient by and
          nothing to jump to.
        */}
        <h1 className="flex min-w-0 items-center justify-center text-body">
          <bdi
            dir={surahLanguage === "ar" ? "rtl" : "ltr"}
            lang={surahLanguage}
            className="truncate font-semibold text-foreground"
          >
            {surahLabel || t("navigation.reader", { ns: "common" })}
          </bdi>
        </h1>

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
              Layout decides how the reader is moved through - a page turns on
              a swipe, a surah scrolls - and it used to sit three levels down,
              inside the preferences sheet, stating only "Surah" or "Page".
              Opening this menu now shows which one is in force and what each
              one does.
            */}
            <DropdownMenuLabel>{t("layout.label")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={layoutMode}
              onValueChange={(value) =>
                onLayoutModeChange(value as MushafLayoutMode)
              }
            >
              {layoutOptions.map((option) => (
                <DropdownMenuRadioItem
                  key={option.value}
                  value={option.value}
                  /* The name and the hint are separate blocks, and the
                     accessible name computed from them runs the two together
                     with no pause - "PageOne mushaf page". Composing it here
                     keeps the two apart. */
                  aria-label={`${option.label}. ${option.hint}`}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{option.label}</span>
                    <span className="truncate text-muted-foreground">
                      {option.hint}
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />

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
