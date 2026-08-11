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
import { TajweedColorLegendDialog } from "@/features/quran-reader/components/TajweedColorLegendDialog";
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
    <header className="mushaf-reader-header">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <Link
          to="/"
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          aria-label={t("header.home")}
          title={t("header.home")}
        >
          <BookOpen className="h-4 w-4 text-primary" aria-hidden />
          <span className="hidden sm:inline">{t("header.appName")}</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            asChild
          >
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
            className="min-h-11 min-w-11"
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

      <div className="border-t border-border/80 bg-mushaf-header-panel/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-2.5 sm:justify-between">
          <MushafLayoutSwitcher
            layoutMode={layoutMode}
            onLayoutModeChange={onLayoutModeChange}
          />

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenListenOptions}
              className="min-h-11 shrink-0 gap-1.5 px-3"
              aria-label={t("header.listen")}
            >
              <Volume2 className="h-4 w-4" aria-hidden />
              <span>{t("header.listen")}</span>
            </Button>

            <div className="inline-flex items-center rounded-full bg-muted/60 p-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenSurahDrawer}
                className="min-h-11 shrink-0 gap-1.5 rounded-s-full px-3"
                aria-label={t("header.surahs")}
              >
                <List className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{t("header.surahs")}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenAyahSearch}
                className="min-h-11 shrink-0 gap-1.5 rounded-e-full px-3"
                aria-label={t("header.searchAyah")}
              >
                <Search className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">
                  {t("header.searchAyah")}
                </span>
              </Button>
            </div>

            {RECITATION_PRACTICE_ENABLED && (
              <Button
                variant={practiceActive ? "default" : "ghost"}
                size="sm"
                onClick={onTogglePractice}
                disabled={practiceLoading && !practiceActive}
                className="min-h-11 shrink-0 gap-1.5 px-3"
                aria-label={t("header.practiceHint")}
                title={t("header.practiceHint")}
              >
                {practiceLoading && !practiceActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Mic className="h-4 w-4" aria-hidden />
                )}
                <span>{t("header.practice")}</span>
              </Button>
            )}

            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-0.5">
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
                className="cursor-pointer px-1 text-sm font-medium"
              >
                {t("header.tajweedColored")}
              </Label>
              {tajweedColored && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-9 gap-1 px-2"
                  onClick={() => onLegendPinnedChange(true)}
                  aria-label={t("tajweed.showMeaning")}
                >
                  <Palette className="h-4 w-4 text-primary" aria-hidden />
                  <span className="text-caption">{t("tajweed.meaning")}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {tajweedColored && (
        <TajweedColorLegendDialog
          open={legendPinned}
          onOpenChange={onLegendPinnedChange}
          onOpenLegendGuide={onOpenLegendGuide}
        />
      )}
    </header>
  );
}
