import { reportError } from "@/shared/observability/errorReporting";

// Registered only for real builds: in development the worker would serve cached
// copies of Vite's transformed modules and mask source edits.
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              window.dispatchEvent(new CustomEvent("artqiy:sw-update-ready"));
            }
          });
        });
      })
      .catch((error: unknown) => {
        reportError(error, { source: "serviceWorker.register" });
      });
  });
}
