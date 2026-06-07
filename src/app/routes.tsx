import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { HomePage } from "@/features/home/HomePage";
import { QuranReaderPage } from "@/features/quran-reader/QuranReaderPage";
import { QuizPage } from "@/features/quiz/QuizPage";
import { AboutPage } from "@/features/settings/AboutPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { legacyQuranPathRedirect } from "@/features/quran-reader/lib/quranReaderRoutes";

function LegacyQuranRedirect() {
  const { pathname } = useLocation();
  const target = legacyQuranPathRedirect(pathname);
  if (!target) return <Navigate to="/quran/1" replace />;
  return <Navigate to={target} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/quran" element={<Navigate to="/quran/1" replace />} />
      <Route
        path="/quran/scroll"
        element={<LegacyQuranRedirect />}
      />
      <Route path="/quran/scroll/:pageNumber" element={<LegacyQuranRedirect />} />
      <Route
        path="/quran/page/:pageNumber/surah/:surahNumber"
        element={<LegacyQuranRedirect />}
      />
      <Route path="/quran/page/:pageNumber" element={<LegacyQuranRedirect />} />
      <Route
        path="/quran/surah/:surahNumber/ayah/:ayahNumber"
        element={<QuranReaderPage />}
      />
      <Route path="/quran/surah/:surahNumber" element={<LegacyQuranRedirect />} />
      <Route path="/quran/:first/:second" element={<QuranReaderPage />} />
      <Route path="/quran/:first" element={<QuranReaderPage />} />
      <Route path="/quiz" element={<QuizPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/about" element={<AboutPage />} />
    </Routes>
  );
}
