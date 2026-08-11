import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  List,
  Loader2,
  Mic,
  Moon,
  Palette,
  Search,
  Settings,
  Sun,
  Volume2,
} from "lucide-react";
import { MushafLayoutSwitcher } from "@/features/quran-reader/components/MushafLayoutSwitcher";
import { TajweedColorDrawer } from "@/features/quran-reader/components/TajweedColorDrawer";
import type { MushafReaderHeaderState } from "@/features/quran-reader/context/MushafReaderContext";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import { RECITATION_PRACTICE_AVAILABLE as RECITATION_PRACTICE_ENABLED } from "@practice/runtime";
import { useTheme } from "@/shared/hooks/use-theme";

type MushafReaderHeaderProps = MushafReaderHeaderState;

export function MushafReaderHeader({
  tajweedColored,
  legendPinned,
  layoutMode,
  practiceActive,
  practiceLoading,
  onTajweedColoredChange,
  onLegendPinnedChange,
  onLayoutModeChange,
  onOpenLegendGuide,
  onOpenSurahDrawer,
  onOpenAyahSearch,
  onOpenListenOptions,
  onTogglePractice,
}: MushafReaderHeaderProps) {
  const { t } = useTranslation("reader");
  const { theme, toggleTheme } = useTheme();

  return (
    <div>
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:h-16">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex min-w-0 items-center justify-start gap-0.5">
            <Link
              to="/"
              className="flex min-h-11 min-w-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              aria-label={t("header.home")}
              title={t("header.home")}
            >
              <BookOpen className="h-4 w-4 text-primary" aria-hidden />
              <span className="hidden md:inline">{t("header.appName")}</span>
            </Link>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenListenOptions}
                className="min-h-11 min-w-11 shrink-0 gap-1.5 px-2"
                aria-label={t("header.listen")}
              >
                <Volume2 className="h-4 w-4" aria-hidden />
                <span className="hidden text-xs sm:inline">
                  {t("header.listen")}
                </span>
              </Button>

              <div className="inline-flex items-center rounded-full bg-muted/50 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onOpenSurahDrawer}
                  className="min-h-11 min-w-11 shrink-0 gap-1.5 rounded-s-full px-2.5"
                  aria-label={t("header.surahs")}
                >
                  <List className="h-4 w-4" aria-hidden />
                  <span className="hidden text-xs sm:inline">
                    {t("header.surahs")}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onOpenAyahSearch}
                  className="min-h-11 min-w-11 shrink-0 gap-1.5 rounded-e-full px-2.5"
                  aria-label={t("header.searchAyah")}
                >
                  <Search className="h-4 w-4" aria-hidden />
                  <span className="hidden text-xs sm:inline">
                    {t("header.searchAyah")}
                  </span>
                </Button>
              </div>
            </div>
          </div>

          <MushafLayoutSwitcher
            layoutMode={layoutMode}
            onLayoutModeChange={onLayoutModeChange}
          />

          <div className="flex items-center justify-end gap-0.5">
            {RECITATION_PRACTICE_ENABLED && (
              <Button
                variant={practiceActive ? "default" : "ghost"}
                size="sm"
                onClick={onTogglePractice}
                disabled={practiceLoading && !practiceActive}
                className="min-h-11 shrink-0 gap-1.5 px-2"
                aria-label={t("header.practiceHint")}
                title={t("header.practiceHint")}
              >
                {practiceLoading && !practiceActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Mic className="h-4 w-4" aria-hidden />
                )}
                <span className="hidden text-xs sm:inline">
                  {t("header.practice")}
                </span>
              </Button>
            )}

            <Checkbox
              id="tajweed-colored"
              checked={tajweedColored}
              aria-label={t("header.tajweedColored")}
              onCheckedChange={(checked) =>
                onTajweedColoredChange(checked === true)
              }
            />
            <Label
              htmlFor="tajweed-colored"
              className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center"
              title={t("header.tajweedColored")}
            >
              <Palette className="h-4 w-4 text-primary" aria-hidden />
            </Label>

            <Button variant="ghost" size="icon" className="h-11 w-11" asChild>
              <Link
                to="/settings"
                aria-label={t("header.settings")}
                title={t("header.settings")}
              >
                <Settings className="h-5 w-5" aria-hidden />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? t("header.switchToLight")
                  : t("header.switchToDark")
              }
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" aria-hidden />
              ) : (
                <Moon className="h-5 w-5" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      </div>

      <TajweedColorDrawer
        visible={tajweedColored}
        open={legendPinned}
        onOpenChange={onLegendPinnedChange}
        onOpenLegendGuide={onOpenLegendGuide}
      />
    </div>
  );
}
