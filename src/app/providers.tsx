import { MushafReaderProvider } from "@/features/quran-reader/context/MushafReaderContext";
import { QuranDataProvider } from "@/features/quran-reader/context/QuranDataContext";
import { QuranPlaybackProvider } from "@/features/quran-reader/context/QuranPlaybackContext";
import { RecitationPracticeProvider } from "@/features/quran-reader/context/RecitationPracticeContext";
import { ReciterProvider } from "@/shared/hooks/use-reciter";
import { ThemeProvider } from "@/shared/hooks/use-theme";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QuranDataProvider>
        <ReciterProvider>
          <QuranPlaybackProvider>
            <RecitationPracticeProvider>
              <MushafReaderProvider>{children}</MushafReaderProvider>
            </RecitationPracticeProvider>
          </QuranPlaybackProvider>
        </ReciterProvider>
      </QuranDataProvider>
    </ThemeProvider>
  );
}
