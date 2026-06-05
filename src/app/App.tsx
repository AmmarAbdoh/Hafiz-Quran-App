import { BrowserRouter } from "react-router-dom";
import { AppProviders } from "@/app/providers";
import { AppShell } from "@/app/AppShell";
import { AppRoutes } from "@/app/routes";

export function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </AppProviders>
    </BrowserRouter>
  );
}
