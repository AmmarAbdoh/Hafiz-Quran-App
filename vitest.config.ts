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
      "@practice/runtime": path.resolve(
        rootDirectory,
        "src/features/recitation-practice/runtime.enabled.ts",
      ),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: [...configDefaults.exclude, "e2e/**"],
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
