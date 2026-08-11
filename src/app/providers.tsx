import type { ReactNode } from "react";
import { LocaleProvider } from "@/app/i18n";
import { ReciterProvider } from "@/domain/quran";
import { ThemeProvider } from "@/shared/hooks/use-theme";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <ReciterProvider>{children}</ReciterProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}
