import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const DIST_DIRECTORY = path.resolve("dist");
const QURAN_DIRECTORY = path.join(DIST_DIRECTORY, "data", "quran");
const MAX_FILE_COUNT = 2_000;
/*
 * The deployed footprint, not the download. Most of the headroom over the
 * Quran data is inference runtime: ~13MB for the streaming recogniser and
 * ~24MB for the Whisper engine still kept as a fallback, each fetched only by
 * someone who starts تسميع on that engine. Retiring Whisper takes roughly
 * 24MB back. What has to stay small is what every visit pays for, and that is
 * the precache below.
 */
const MAX_DIST_BYTES = 75 * 1024 * 1024;
const MAX_QURAN_BYTES = 35 * 1024 * 1024;
const MAX_PRECACHE_BYTES = 2 * 1024 * 1024;
/** Mirrors the extensions public/sw.js precaches from the build manifest. */
const PRECACHED_EXTENSION = /\.(?:js|css|woff2)$/;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
    }),
  );
  return nestedFiles.flat();
}

async function totalSize(files) {
  const sizes = await Promise.all(files.map((file) => stat(file)));
  return sizes.reduce((total, value) => total + value.size, 0);
}

/*
 * What the service worker pulls down on install, worked out the way it works
 * it out: every script and stylesheet the manifest names. A static import of
 * something heavy - the speech model runtime above all - lands here, which is
 * the regression worth catching. Loading it from a worker does not.
 */
async function precachedFiles() {
  const manifest = JSON.parse(
    await readFile(path.join(DIST_DIRECTORY, "asset-manifest.json"), "utf8"),
  );
  const names = new Set();
  for (const entry of Object.values(manifest)) {
    for (const file of [entry.file, ...(entry.css ?? [])]) {
      if (typeof file === "string" && PRECACHED_EXTENSION.test(file)) {
        names.add(path.join(DIST_DIRECTORY, file));
      }
    }
  }
  return [...names];
}

const files = await collectFiles(DIST_DIRECTORY);
const quranFiles = files.filter((file) => file.startsWith(QURAN_DIRECTORY));
const precached = await precachedFiles();
const distBytes = await totalSize(files);
const quranBytes = await totalSize(quranFiles);
const precacheBytes = await totalSize(precached);

const failures = [];
if (files.length >= MAX_FILE_COUNT) {
  failures.push(
    `dist contains ${files.length} files; expected fewer than ${MAX_FILE_COUNT}`,
  );
}
if (distBytes >= MAX_DIST_BYTES) {
  failures.push(
    `dist is ${distBytes} bytes; expected fewer than ${MAX_DIST_BYTES}`,
  );
}
if (quranBytes >= MAX_QURAN_BYTES) {
  failures.push(
    `compressed Quran data is ${quranBytes} bytes; expected fewer than ${MAX_QURAN_BYTES}`,
  );
}
if (precacheBytes >= MAX_PRECACHE_BYTES) {
  failures.push(
    `the service worker would precache ${precacheBytes} bytes; expected fewer than ${MAX_PRECACHE_BYTES}`,
  );
}

if (failures.length > 0) {
  throw new Error(failures.join("\n\n"));
}

console.log(
  `Build budget passed: ${files.length} files, ${distBytes} bytes total, ` +
    `${quranBytes} Quran bytes, ${precacheBytes} precached bytes.`,
);
