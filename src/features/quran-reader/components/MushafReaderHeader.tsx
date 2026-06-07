import { Link } from "react-router-dom";
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
import { RECITATION_PRACTICE_ENABLED } from "@/shared/constants/feature-flags";
import { useTheme } from "@/shared/hooks/use-theme";

interface MushafReaderHeaderProps extends MushafReaderHeaderState {}

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
  const { theme, toggleTheme } = useTheme();

  return (
    <div>
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:h-16">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex min-w-0 items-center justify-start gap-0.5">
            <Link
              to="/"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              title="الرئيسية"
            >
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="hidden md:inline">حافظ القرآن</span>
            </Link>

            <div className="flex items-center gap-1" dir="ltr">
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenListenOptions}
                className="h-9 shrink-0 gap-1.5 px-2"
              >
                <Volume2 className="h-4 w-4" />
                <span className="hidden text-xs sm:inline">استماع</span>
              </Button>

              <div className="inline-flex items-center rounded-full bg-muted/50 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onOpenSurahDrawer}
                  className="h-8 shrink-0 gap-1.5 rounded-s-full px-2.5"
                >
                  <List className="h-4 w-4" />
                  <span className="hidden text-xs sm:inline">السور</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onOpenAyahSearch}
                  className="h-8 shrink-0 gap-1.5 rounded-e-full px-2.5"
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden text-xs sm:inline">بحث آية</span>
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
                className="h-9 shrink-0 gap-1.5 px-2"
                title="تسميع — مطابقة تلاوتك مع الصفحة"
              >
                {practiceLoading && !practiceActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                <span className="hidden text-xs sm:inline">تسميع</span>
              </Button>
            )}

            <Checkbox
              id="tajweed-colored"
              checked={tajweedColored}
              onCheckedChange={(checked) =>
                onTajweedColoredChange(checked === true)
              }
            />
            <Label
              htmlFor="tajweed-colored"
              className="flex cursor-pointer items-center"
              title="تجويد ملوّن"
            >
              <Palette className="h-4 w-4 text-primary" />
            </Label>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              asChild
              aria-label="الإعدادات"
            >
              <Link to="/settings">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={toggleTheme}
              aria-label="تبديل الوضع"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <TajweedColorDrawer
        visible={tajweedColored}
        pinned={legendPinned}
        onPinnedChange={onLegendPinnedChange}
        onOpenLegendGuide={onOpenLegendGuide}
      />
    </div>
  );
}
