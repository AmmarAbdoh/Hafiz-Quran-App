/*
 * Sends crash details to a reporting endpoint so production failures are
 * visible instead of only reaching the user's console.
 *
 * Reporting stays off until VITE_ERROR_REPORT_URL is set, and the payload
 * carries only the error, the route, and the user agent. No preferences, quiz
 * history, search terms, or Quran content are ever included, which keeps the
 * privacy promise on the About page intact. Point it at a first-party endpoint
 * to keep the `connect-src 'self'` policy unchanged; a third-party collector
 * also needs its host added to the CSP.
 */

const ENDPOINT = import.meta.env.VITE_ERROR_REPORT_URL;
const MAX_REPORTS_PER_SESSION = 10;
const MAX_STACK_LENGTH = 4000;

const seen = new Set<string>();
let sent = 0;

export interface ErrorReportContext {
  /** Where the failure surfaced, for example "render" or "unhandledrejection". */
  source: string;
  componentStack?: string;
}

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: `${error.name}: ${error.message}`, stack: error.stack };
  }
  return { message: String(error) };
}

function deliver(body: string) {
  if (!ENDPOINT) return;

  if (typeof navigator.sendBeacon === "function") {
    const queued = navigator.sendBeacon(
      ENDPOINT,
      new Blob([body], { type: "application/json" }),
    );
    if (queued) return;
  }

  // keepalive lets the request outlive a navigation away from the page.
  void fetch(ENDPOINT, {
    method: "POST",
    body,
    keepalive: true,
    headers: { "Content-Type": "application/json" },
  }).catch(() => undefined);
}

export function reportError(error: unknown, context: ErrorReportContext) {
  const { message, stack } = describe(error);

  console.error(`[${context.source}] ${message}`, error);

  if (!ENDPOINT || sent >= MAX_REPORTS_PER_SESSION) return;

  // One report per distinct failure keeps a render loop from flooding.
  const fingerprint = `${context.source}:${message}`;
  if (seen.has(fingerprint)) return;
  seen.add(fingerprint);
  sent += 1;

  deliver(
    JSON.stringify({
      message,
      stack: stack?.slice(0, MAX_STACK_LENGTH),
      componentStack: context.componentStack?.slice(0, MAX_STACK_LENGTH),
      source: context.source,
      route: window.location.pathname,
      userAgent: navigator.userAgent,
      occurredAt: new Date().toISOString(),
    }),
  );
}

export function installGlobalErrorHandlers() {
  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, { source: "window.error" });
  });

  // Audio playback and data loading failures usually surface here.
  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, { source: "unhandledrejection" });
  });
}
