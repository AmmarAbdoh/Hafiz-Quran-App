import { BrowserRouter } from "react-router-dom";
import { AppProviders } from "@/app/providers";
import { AppShell } from "@/app/AppShell";
import { AppRoutes } from "@/app/routes";
import { AppErrorBoundary } from "@/app/ErrorBoundary";

export function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppErrorBoundary>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </AppErrorBoundary>
      </AppProviders>
    </BrowserRouter>
  );
}
