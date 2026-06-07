/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_RECITATION_PRACTICE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
