import { Routes, Route } from "react-router-dom";
import { HomePage } from "@/features/home/HomePage";
import { QuranReaderPage } from "@/features/quran-reader/QuranReaderPage";
import { QuizPage } from "@/features/quiz/QuizPage";
import { AboutPage } from "@/features/settings/AboutPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/quran" element={<QuranReaderPage />} />
      <Route path="/quiz" element={<QuizPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/about" element={<AboutPage />} />
    </Routes>
  );
}
