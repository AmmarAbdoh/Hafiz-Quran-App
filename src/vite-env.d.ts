/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_RECITATION_PRACTICE?: string;
  /** "true" shows strict reciter mode in Settings; see `STRICT_MODE_AVAILABLE`. */
  readonly VITE_ENABLE_STRICT_RECITER_MODE?: string;
  /** Absolute public origin, substituted into index.html meta tags. */
  readonly VITE_SITE_URL?: string;
  /** Crash reporting endpoint. Reporting is disabled while this is unset. */
  readonly VITE_ERROR_REPORT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
