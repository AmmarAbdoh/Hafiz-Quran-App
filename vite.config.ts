import { createReadStream, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "font-src 'self' https://verses.quran.foundation",
  "style-src 'self' 'unsafe-inline'",
  // blob: and wasm-unsafe-eval are what the speech runtime needs: it imports
  // its glue module as a blob and then compiles WebAssembly. Neither widens
  // the policy to eval() of JavaScript.
  "script-src 'self' blob: 'wasm-unsafe-eval'",
  "connect-src 'self' ws: wss: https://api.quran.com https://audio.qurancdn.com https://everyayah.com https://cdn.islamic.app https://verses.quran.foundation https://huggingface.co https://*.huggingface.co https://hf.co https://*.hf.co",
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

/**
 * Serve the speech model from `.models/` during development.
 *
 * The weights are gated, so they cannot be fetched from Hugging Face by a
 * browser and they are far too large to commit. Keeping them outside `public`
 * means they never reach `dist`: in production the same paths are served by
 * whatever ends up hosting them.
 */
function serveLocalModels(): Plugin {
  const root = path.resolve(rootDirectory, ".models");

  return {
    name: "artqiy:local-models",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/models", (request, response, next) => {
        const raw = (request.url ?? "").split("?")[0] ?? "";

        /* A malformed escape - `%E0%A4%A` - makes this throw, and an
           exception here took the dev server's request down with it. */
        let requested: string;
        try {
          requested = decodeURIComponent(raw);
        } catch {
          response.statusCode = 400;
          response.end();
          return;
        }

        const file = path.join(root, requested);
        /*
         * Refuse anything that climbs out of the model directory.
         *
         * `file.startsWith(root)` is not that test: it also admits a sibling
         * whose name merely begins with the same string, so `..%2F.models-old`
         * resolved outside `.models` and was served anyway. Asking for the
         * relative path instead is the question actually being asked.
         */
        const inside = path.relative(root, file);
        if (!inside || inside.startsWith("..") || path.isAbsolute(inside)) {
          response.statusCode = 403;
          response.end();
          return;
        }

        let size: number;
        try {
          const stats = statSync(file);
          if (!stats.isFile()) throw new Error("not a file");
          size = stats.size;
        } catch {
          next();
          return;
        }

        response.setHeader(
          "Content-Type",
          file.endsWith(".json")
            ? "application/json"
            : file.endsWith(".txt")
              ? "text/plain; charset=utf-8"
              : "application/octet-stream",
        );
        response.setHeader("Content-Length", String(size));
        /* The file was there a moment ago; if it goes away mid-read, end the
           response rather than letting the stream throw unhandled. */
        createReadStream(file)
          .on("error", () => {
            response.statusCode = 500;
            response.end();
          })
          .pipe(response);
      });
    },
  };
}

/**
 * Whether the gated weights are actually on this machine.
 *
 * Development used to assume they were, so a fresh clone defaulted to the
 * streaming recogniser, asked the dev server for a file it does not have,
 * fell through to the SPA rewrite and failed on an index.html that is not an
 * ONNX graph - having already migrated the contributor's stored model
 * preference onto the model that cannot load.
 */
function localModelsPresent(): boolean {
  try {
    return statSync(
      path.join(
        rootDirectory,
        ".models/zipformer/zipformer_p_arabic_v3.1.int8.onnx",
      ),
    ).isFile();
  } catch {
    return false;
  }
}

/*
 * Through `process.env` rather than `define`, because the app reads this one
 * off `import.meta.env` as a property rather than as a literal expression,
 * and `define` only substitutes the literal. Vite forwards `VITE_`-prefixed
 * entries of `process.env` into `import.meta.env`, which is also how the
 * tests reach it with `vi.stubEnv`.
 */
process.env.VITE_PRACTICE_MODELS_PRESENT = String(localModelsPresent());

/**
 * Receive a recorded تسميع run and keep it with the other fixtures.
 *
 * Every threshold in this feature was tuned on professional reciters, whose
 * mistakes had to be manufactured by cutting their audio at word boundaries.
 * A learner's mistakes are different in kind and have never been measured.
 * This is how recordings of them get onto disk, where `scripts/tasmee` can
 * read them: 16-bit mono WAV beside a JSON of what the page expected, what
 * the recogniser emitted, and where the cursor had to hold.
 *
 * Development only - `apply: "serve"` - and the audio reaches the machine
 * running the dev server and nowhere else.
 *
 * It still writes files to disk on an unauthenticated POST, so it checks who
 * is asking. A dev server listens on localhost for as long as someone is
 * working, and any page open in the same browser can post to it: without the
 * check below, any site could drop bounded files into the fixtures directory
 * while `npm run dev` runs. The name and size were already the server's to
 * decide; the origin is the part that was missing.
 */
function captureRecordings(): Plugin {
  const root = path.resolve(rootDirectory, "scripts/tasmee/fixtures/recorded");
  /* A minute of 16kHz mono is about 2MB of WAV, 2.6MB base64. This is the
     point at which something has gone wrong rather than a long page. */
  const MAX_BYTES = 64 * 1024 * 1024;

  return {
    name: "artqiy:capture-recordings",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__capture", (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end("POST only");
          return;
        }
        /*
         * Only the app itself, served by this server.
         *
         * `fetch` from a page always sends `Origin`, so a missing one is not
         * a browser doing what the app does and is refused with the rest. The
         * host is whatever this server answers on - a phone on the LAN
         * testing against it included - so it is compared rather than
         * hard-coded to localhost, and either scheme is accepted because a
         * dev server behind a tunnel answers on https.
         */
        const origin = request.headers.origin;
        const host = request.headers.host;
        const mine =
          host !== undefined &&
          (origin === `http://${host}` || origin === `https://${host}`);
        if (!mine) {
          response.statusCode = 403;
          response.end("not this app");
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        let refused = false;
        request.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            refused = true;
            response.statusCode = 413;
            response.end("recording too large");
            request.destroy();
            return;
          }
          chunks.push(chunk);
        });

        request.on("end", () => {
          if (refused) return;
          void (async () => {
            try {
              const body: unknown = JSON.parse(
                Buffer.concat(chunks).toString("utf8"),
              );
              const { id, wav, meta } = body as {
                id?: string;
                wav?: string;
                meta?: unknown;
              };
              /* Named by the server's own rules, never by the request: a
                 path from a browser is not something to join onto a
                 directory. */
              if (!id || !wav || !/^[A-Za-z0-9-]{1,80}$/.test(id)) {
                response.statusCode = 400;
                response.end("bad recording");
                return;
              }
              await mkdir(root, { recursive: true });
              await writeFile(
                path.join(root, `${id}.wav`),
                Buffer.from(wav, "base64"),
              );
              const metaPath = path.join(root, `${id}.json`);
              await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
              /*
               * And the same run written out to be read - see
               * `scripts/tasmee/report-run.mjs`. A report that fails is
               * logged and the recording kept: the recording is the thing
               * that cannot be made again.
               */
              try {
                const report = pathToFileURL(
                  path.resolve(rootDirectory, "scripts/tasmee/report-run.mjs"),
                ).href;
                const { writeRunReport } = (await import(report)) as {
                  writeRunReport: (jsonPath: string) => Promise<string>;
                };
                await writeRunReport(metaPath);
              } catch (error) {
                server.config.logger.warn(
                  `report for ${id} failed: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
              response.statusCode = 200;
              response.setHeader("content-type", "application/json");
              response.end(JSON.stringify({ saved: `${id}.wav` }));
            } catch (error) {
              response.statusCode = 500;
              response.end(error instanceof Error ? error.message : "failed");
            }
          })();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serveLocalModels(), captureRecordings()],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(rootDirectory, "src"),
      },
    ],
  },
  optimizeDeps: {
    // Pre-bundling it rewrites the wasm URLs it resolves at runtime.
    exclude: ["@huggingface/transformers"],
  },
  worker: {
    format: "es",
  },
  build: {
    // The service worker reads this to precache the lazily imported route
    // chunks, whose hashed names it cannot otherwise discover.
    manifest: "asset-manifest.json",
  },
  server: {
    headers: developmentSecurityHeaders,
  },
  preview: {
    headers: securityHeaders,
  },
});
