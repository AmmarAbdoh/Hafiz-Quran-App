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
      className="min-h-11 min-w-11"
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
              "relative inline-flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold transition-colors",
              mobile
                ? "flex-col gap-0.5 px-1 py-1.5 text-[0.68rem]"
                : "justify-start gap-3 px-3 py-2.5",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
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

function ReaderShell({ children }: { children: ReactNode }) {
  const { header } = useMushafReader();
  const { t, i18n } = useTranslation("common");
  const { t: tA11y } = useTranslation("a11y");

  return (
    <div className="reader-shell">
      <a className="skip-link" href="#app-content">
        {tA11y("skipToContent")}
      </a>
      {header ? (
        <MushafReaderHeader {...header} />
      ) : (
        // Shown for the moment before the reader publishes its own header, so it
        // leads home like the real one rather than back through history.
        <header className="editorial-topbar editorial-topbar--reader">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
          >
            <Link to="/" aria-label={t("navigation.home")}>
              {i18n.dir() === "rtl" ? (
                <ArrowRight aria-hidden="true" />
              ) : (
                <ArrowLeft aria-hidden="true" />
              )}
            </Link>
          </Button>
          <span className="font-bold">{t("navigation.reader")}</span>
          <ThemeButton />
        </header>
      )}
      <main id="app-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { t: tA11y } = useTranslation("a11y");

  if (isQuranReaderPath(pathname)) {
    return (
      <MushafReaderProvider>
        <ServiceWorkerUpdatePrompt />
        <ReaderShell>{children}</ReaderShell>
      </MushafReaderProvider>
    );
  }

  return (
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
          The mini player and the mobile nav share one fixed dock so the player
          stacks above the nav without either needing to know its height.
        */}
        <div className="editorial-dock">
          <PlaybackMiniPlayer />
          <div className="editorial-bottom-nav">
            <Navigation mobile />
          </div>
        </div>
      </div>
    </div>
  );
}
