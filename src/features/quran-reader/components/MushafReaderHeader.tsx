import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  List,
  Moon,
  Palette,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { TajweedColorDrawer } from "@/features/quran-reader/components/TajweedColorDrawer";
import type { MushafReaderHeaderState } from "@/features/quran-reader/context/MushafReaderContext";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import { useTheme } from "@/shared/hooks/use-theme";

interface MushafReaderHeaderProps extends MushafReaderHeaderState {
  onBack: () => void;
}

export function MushafReaderHeader({
  surahName,
  tajweedColored,
  legendOpen,
  onTajweedColoredChange,
  onLegendToggle,
  onOpenLegendGuide,
  onOpenSurahDrawer,
  onOpenAyahSearch,
  onBack,
}: MushafReaderHeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div>
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:h-16">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex items-center justify-start gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={onBack}
              aria-label="رجوع"
            >
              <ArrowRight className="h-5 w-5" />
            </Button>

            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-foreground transition-colors hover:bg-muted sm:flex"
              title="الرئيسية"
            >
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="hidden md:inline">حافظ القرآن</span>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenSurahDrawer}
              className="h-9 shrink-0 gap-1.5 px-2"
            >
              <List className="h-4 w-4" />
              <span className="hidden text-xs sm:inline">السور</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenAyahSearch}
              className="h-9 shrink-0 gap-1.5 px-2"
            >
              <Search className="h-4 w-4" />
              <span className="hidden text-xs sm:inline">بحث آية</span>
            </Button>
          </div>

          <div className="min-w-0 max-w-[10rem] px-1 text-center sm:max-w-md">
            <p className="truncate text-sm font-semibold leading-tight sm:text-base">
              {surahName}
            </p>
          </div>

          <div className="flex items-center justify-end gap-0.5">
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
        open={legendOpen}
        visible={tajweedColored}
        onToggle={onLegendToggle}
        onOpenLegendGuide={onOpenLegendGuide}
      />
    </div>
  );
}
