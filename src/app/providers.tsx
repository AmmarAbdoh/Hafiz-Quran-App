import type { ReactNode } from "react";
import { DirectionProvider } from "@radix-ui/react-direction";
import { LocaleProvider, useLocale } from "@/app/i18n";
import { ReciterProvider } from "@/domain/quran";
import { QuranPlaybackProvider } from "@/features/quran-reader";
import { ThemeProvider } from "@/shared/hooks/use-theme";
import { ToastProvider } from "@/shared/components/Toast";

/**
 * Radix primitives assume left to right unless told otherwise, which would flip
 * tab order and menu placement in Arabic.
 */
function LocaleDirection({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  return (
    <DirectionProvider dir={locale === "ar" ? "rtl" : "ltr"}>
      {children}
    </DirectionProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <LocaleDirection>
        <ThemeProvider>
          <ReciterProvider>
            {/*
              Playback lives above the routes so a recitation keeps going when
              the reader unmounts. It holds only the playlist and the audio
              element, and never touches the Quran dataset, so the shell stays
              data-free.
            */}
            <QuranPlaybackProvider>
              <ToastProvider>{children}</ToastProvider>
            </QuranPlaybackProvider>
          </ReciterProvider>
        </ThemeProvider>
      </LocaleDirection>
    </LocaleProvider>
  );
}
