import { Suspense } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppProviders } from "@/app/providers";
import { AppShell } from "@/app/AppShell";
import { AppRoutes } from "@/app/routes";
import { AppErrorBoundary } from "@/app/ErrorBoundary";
import { RouteLoadingState } from "@/app/RouteLoadingState";

export function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppErrorBoundary>
          {/*
            The boundary sits above the shell on purpose. AppShell renders a
            different tree for reader paths, so a boundary inside it would be
            torn down and rebuilt when entering the reader, forcing React to
            show the fallback. From here it stays mounted across that swap,
            which lets React hold the current page on screen while the next
            route loads instead of flashing a loading state.
          */}
          <Suspense fallback={<RouteLoadingState />}>
            <AppShell>
              <AppRoutes />
            </AppShell>
          </Suspense>
        </AppErrorBoundary>
      </AppProviders>
    </BrowserRouter>
  );
}
