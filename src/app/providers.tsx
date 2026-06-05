import { MushafReaderProvider } from "@/features/quran-reader/context/MushafReaderContext";
import { QuranPlaybackProvider } from "@/features/quran-reader/context/QuranPlaybackContext";
import { ReciterProvider } from "@/shared/hooks/use-reciter";
import { ThemeProvider } from "@/shared/hooks/use-theme";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ReciterProvider>
        <QuranPlaybackProvider>
          <MushafReaderProvider>{children}</MushafReaderProvider>
        </QuranPlaybackProvider>
      </ReciterProvider>
    </ThemeProvider>
  );
}
