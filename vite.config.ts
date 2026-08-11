import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "font-src 'self' https://verses.quran.foundation",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self' ws: wss: https://api.quran.com https://audio.qurancdn.com https://everyayah.com https://cdn.islamic.app https://verses.quran.foundation https://huggingface.co https://*.huggingface.co",
  "media-src 'self' blob: https://audio.qurancdn.com https://everyayah.com https://cdn.islamic.app https://verses.quran.foundation",
  "worker-src 'self' blob:",
].join("; ");

const securityHeaders = {
  "Content-Security-Policy": contentSecurityPolicy,
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(self)",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
};

const developmentSecurityHeaders = {
  ...securityHeaders,
  // The React refresh preamble is injected inline by Vite in development only.
  "Content-Security-Policy": contentSecurityPolicy.replace(
    "script-src 'self'",
    "script-src 'self' 'unsafe-inline'",
  ),
};

export default defineConfig(({ mode }) => {
  const practiceEnabled = mode === "practice";
  const practiceRuntime = practiceEnabled
    ? "src/features/recitation-practice/runtime.enabled.ts"
    : "src/features/recitation-practice/runtime.disabled.ts";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        {
          find: "@practice/runtime",
          replacement: path.resolve(rootDirectory, practiceRuntime),
        },
        {
          find: "@",
          replacement: path.resolve(rootDirectory, "src"),
        },
      ],
    },
    optimizeDeps: {
      exclude: practiceEnabled ? ["@huggingface/transformers"] : [],
    },
    worker: {
      format: "es",
    },
    build: {
      outDir: practiceEnabled ? "dist-practice" : "dist",
    },
    server: {
      headers: developmentSecurityHeaders,
    },
    preview: {
      headers: securityHeaders,
    },
  };
});
