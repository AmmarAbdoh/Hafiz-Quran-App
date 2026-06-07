import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const coiHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
  worker: {
    format: "es",
  },
  server: {
    headers: coiHeaders,
  },
  preview: {
    headers: coiHeaders,
  },
});
