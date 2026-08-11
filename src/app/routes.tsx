import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { QuranDataProvider } from "@/domain/quran";
import {
  legacyQuranPathRedirect,
  normalizeCanonicalReaderPath,
} from "@/features/quran-reader";
import { NotFoundPage } from "@/app/NotFoundPage";
import { RouteLoadingState } from "@/app/RouteLoadingState";

const HomePage = lazy(() =>
  import("@/features/home").then(({ HomePage: component }) => ({
    default: component,
  })),
);
const QuranReaderPage = lazy(() =>
  import("@/features/quran-reader/QuranReaderPage").then(
    ({ QuranReaderPage: component }) => ({ default: component }),
  ),
);
const QuranReaderRoute = lazy(() =>
  import("@/features/quran-reader/QuranReaderRoute").then(
    ({ QuranReaderRoute: component }) => ({ default: component }),
  ),
);
const QuizPage = lazy(() =>
  import("@/features/quiz").then(({ QuizPage: component }) => ({
    default: component,
  })),
);
const AboutPage = lazy(() =>
  import("@/features/settings").then(({ AboutPage: component }) => ({
    default: component,
  })),
);
const SettingsPage = lazy(() =>
  import("@/features/settings").then(({ SettingsPage: component }) => ({
    default: component,
  })),
);

function LegacyQuranRedirect() {
  const { pathname } = useLocation();
  const target = legacyQuranPathRedirect(pathname);
  return <Navigate to={target ?? "/quran/page/1"} replace />;
}

function CanonicalReaderGuard() {
  const { pathname } = useLocation();
  const target = normalizeCanonicalReaderPath(pathname);
  return target ? <Navigate to={target} replace /> : <Outlet />;
}

function QuranDataProviders() {
  return (
    <QuranDataProvider>
      <Outlet />
    </QuranDataProvider>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingState />}>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route
          path="/quran"
          element={<Navigate to="/quran/page/1" replace />}
        />
        <Route element={<CanonicalReaderGuard />}>
          <Route element={<QuranReaderRoute />}>
            <Route
              path="/quran/page/:pageNumber"
              element={<QuranReaderPage />}
            />
            <Route
              path="/quran/surah/:surahNumber"
              element={<QuranReaderPage />}
            />
            <Route
              path="/quran/surah/:surahNumber/ayah/:ayahNumber"
              element={<QuranReaderPage />}
            />
          </Route>
        </Route>

        <Route path="/quran/scroll" element={<LegacyQuranRedirect />} />
        <Route
          path="/quran/scroll/:pageNumber"
          element={<LegacyQuranRedirect />}
        />
        <Route
          path="/quran/page/:pageNumber/surah/:surahNumber"
          element={<LegacyQuranRedirect />}
        />
        <Route path="/quran/:first/:second" element={<LegacyQuranRedirect />} />
        <Route path="/quran/:first" element={<LegacyQuranRedirect />} />

        <Route element={<QuranDataProviders />}>
          <Route path="/quiz" element={<QuizPage />} />
        </Route>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
