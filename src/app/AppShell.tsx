import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  GraduationCap,
  LayoutGrid,
  Moon,
  Settings2,
  Sun,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ServiceWorkerUpdatePrompt } from "@/app/ServiceWorkerUpdatePrompt";
import {
  isQuranReaderPath,
  MushafReaderHeader,
  MushafReaderRail,
  MushafReaderProvider,
  PlaybackMiniPlayer,
  useMushafReader,
  useResumeReaderPath,
} from "@/features/quran-reader";
import { Button } from "@/shared/components/ui/button";
import { useTheme } from "@/shared/hooks/use-theme";
import { cn } from "@/shared/lib/utils";

const navigationItems = [
  {
    labelKey: "navigation.reader",
    icon: BookOpenText,
    section: "reader",
  },
  {
    to: "/index",
    labelKey: "navigation.index",
    icon: LayoutGrid,
    section: "index",
  },
  {
    to: "/quiz",
    labelKey: "navigation.review",
    icon: GraduationCap,
    section: "quiz",
  },
  {
    to: "/settings",
    labelKey: "navigation.more",
    icon: Settings2,
    section: "settings",
  },
] as const;

type NavSection = (typeof navigationItems)[number]["section"] | "home";

function getActiveSection(pathname: string): NavSection {
  if (pathname.startsWith("/quran")) return "reader";
  if (pathname.startsWith("/index")) return "index";
  if (pathname.startsWith("/quiz")) return "quiz";
  if (pathname.startsWith("/settings") || pathname.startsWith("/about")) {
    return "settings";
  }
  return "home";
}

function Brand() {
  const { t } = useTranslation("common");

  return (
    <Link
      to="/"
      className="inline-flex min-h-11 items-center gap-3 rounded-lg font-semibold"
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        <BookOpenText aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-bold">
          {t("appName")}
        </span>
        <span className="hidden truncate text-[0.68rem] font-normal text-muted-foreground lg:block">
          {t("appTagline")}
        </span>
      </span>
    </Link>
  );
}

function ThemeButton() {
  const { t } = useTranslation("common");
  const { theme, toggleTheme } = useTheme();
  const label =
    theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark");

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? (
        <Sun aria-hidden="true" className="h-5 w-5" />
      ) : (
        <Moon aria-hidden="true" className="h-5 w-5" />
      )}
    </Button>
  );
}

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const { pathname } = useLocation();
  const { t } = useTranslation("common");
  const { t: tA11y } = useTranslation("a11y");
  const resumeReaderPath = useResumeReaderPath();
  const activeSection = getActiveSection(pathname);

  return (
    <nav
      aria-label={
        mobile ? tA11y("mobileNavigation") : tA11y("desktopNavigation")
      }
      className={mobile ? "contents" : "mt-10 flex flex-1 flex-col gap-2"}
    >
      {navigationItems.map((item) => {
        const active = item.section === activeSection;
        const Icon = item.icon;
        const to = item.section === "reader" ? resumeReaderPath : item.to;

        return (
          <Link
            key={item.section}
            to={to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex min-h-11 items-center justify-center rounded-md text-label font-semibold transition-colors duration-fast ease-standard",
              mobile
                ? "flex-col gap-0.5 px-1 py-1.5 text-[0.68rem]"
                : "justify-start gap-3 px-3 py-2.5",
              active
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Shown for the moment before the reader publishes its own header, styled
 * identically to the real one so nothing visibly swaps in. It leads home
 * like the real header rather than back through history.
 */
function ReaderHeaderFallback() {
  const { t, i18n } = useTranslation("common");
  const HomeIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <header className="mushaf-reader-header">
      <div className="mx-auto flex max-w-content items-center justify-between gap-2 px-2 py-1 sm:px-4 sm:py-2">
        <Button asChild variant="ghost" size="icon">
          <Link to="/" aria-label={t("navigation.home")}>
            <HomeIcon aria-hidden="true" className="h-5 w-5" />
          </Link>
        </Button>
        <span className="font-bold">{t("navigation.reader")}</span>
        <ThemeButton />
      </div>
    </header>
  );
}

/**
 * The reader owns its content column but not the shell around it: the
 * sidebar keeps navigation reachable on desktop the same as every other
 * route, and the reader supplies only its own header and a full-bleed main
 * that manages its own scrolling.
 */
function ReaderContent({ children }: { children: ReactNode }) {
  const { header } = useMushafReader();

  return (
    <>
      {header ? <MushafReaderHeader {...header} /> : <ReaderHeaderFallback />}
      <main id="app-content" tabIndex={-1} className="editorial-main--reader">
        {children}
        {/*
          The rail is a sibling of the reader's own layout, not a child of it:
          that layout is the size container the mushaf page is measured
          against, so a rail inside it would be counted as room the page could
          spread into and would change the type size.
        */}
        {header ? (
          <MushafReaderRail
            currentSurah={header.currentSurah}
            onSurahSelect={header.onSurahSelect}
            mushafData={header.mushafData}
          />
        ) : null}
      </main>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { t: tA11y } = useTranslation("a11y");
  const isReader = isQuranReaderPath(pathname);

  return (
    <MushafReaderProvider>
      <div className="editorial-shell">
        <ServiceWorkerUpdatePrompt />
        <a className="skip-link" href="#app-content">
          {tA11y("skipToContent")}
        </a>

        <aside className="editorial-sidebar">
          <Brand />
          <Navigation />
          <div className="mt-auto flex items-center justify-end border-t border-border pt-4">
            <ThemeButton />
          </div>
        </aside>

        <div className="editorial-content-column">
          {isReader ? (
            <ReaderContent>{children}</ReaderContent>
          ) : (
            <>
              <header className="editorial-topbar">
                <Brand />
                <ThemeButton />
              </header>

              <main
                id="app-content"
                tabIndex={-1}
                className="editorial-main app-main-scroll"
              >
                {children}
              </main>

              {/*
                The mini player and the mobile nav share one fixed dock so the
                player stacks above the nav without either needing to know its
                height. The reader has no dock of its own here: its playback
                bar already covers this while reading, and phones keep the
                reader immersive without the app's own bottom nav crowding it.
              */}
              <div className="editorial-dock">
                <PlaybackMiniPlayer />
                <div className="editorial-bottom-nav">
                  <Navigation mobile />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </MushafReaderProvider>
  );
}
