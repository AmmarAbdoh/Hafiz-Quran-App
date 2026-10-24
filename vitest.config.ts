import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    /*
     * The streaming recogniser is the default only where its gated weights
     * are actually on the machine, which `vite.config.ts` answers for the dev
     * server. The unit tests stand in for a machine that has them, so the
     * streaming runtime is the one they exercise; the two tests that care
     * about the other answer stub this themselves.
     */
    env: { VITE_PRACTICE_MODELS_PRESENT: "true" },
    setupFiles: ["./src/test/setup.ts"],
    exclude: [...configDefaults.exclude, "e2e/**"],
    // Component tests that mount the full provider stack need more than the
    // 5s default once coverage instrumentation and parallel workers compete.
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        "src/domain/quran/{audio,data,model}/**/*.ts",
        "src/features/**/{model,services}/**/*.ts",
        "src/shared/{lib,media,services,storage}/**/*.ts",
      ],
      exclude: ["**/*.test.{ts,tsx}", "**/index.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
  },
});
