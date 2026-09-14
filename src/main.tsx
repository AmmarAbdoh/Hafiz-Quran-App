import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { prefetchAfterFirstPaint } from "@/app/prefetch";
import { registerServiceWorker } from "@/app/registerServiceWorker";
import { installGlobalErrorHandlers } from "@/shared/observability/errorReporting";
import "@/styles/tokens.css";
import "@/styles/globals.css";
import "@/styles/base.css";

installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
prefetchAfterFirstPaint();
