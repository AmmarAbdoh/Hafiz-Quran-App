import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Moon, Settings, Sun } from "lucide-react";
import { MushafReaderHeader } from "@/features/quran-reader/components/MushafReaderHeader";
import { useMushafReader } from "@/features/quran-reader/context/MushafReaderContext";
import { Button } from "@/shared/components/ui/button";
import { useTheme } from "@/shared/hooks/use-theme";
import { cn } from "@/shared/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { header: mushafHeader } = useMushafReader();
  const isHome = location.pathname === "/";
  const isQuranReader = location.pathname === "/quran";
  const showMushafHeader = isQuranReader && mushafHeader !== null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        {showMushafHeader ? (
          <MushafReaderHeader
            {...mushafHeader}
            onBack={() => navigate(-1)}
          />
        ) : (
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <div className="flex items-center gap-3">
              {!isHome && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  aria-label="رجوع"
                >
                  <ArrowRight className="h-5 w-5" />
                </Button>
              )}
              <Link to="/" className="flex items-center gap-2 font-semibold">
                <BookOpen className="h-5 w-5 text-primary" />
                <span>حافظ القرآن</span>
              </Link>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
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
        )}
      </header>
      <main
        className={cn(
          isQuranReader
            ? "flex min-h-0 flex-1 flex-col overflow-hidden p-0"
            : "app-main-scroll mx-auto max-w-6xl flex-1 px-4 py-6",
        )}
      >
        {children}
      </main>
    </div>
  );
}
