import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const DIST_DIRECTORY = path.resolve("dist");
const QURAN_DIRECTORY = path.join(DIST_DIRECTORY, "data", "quran");
const MAX_FILE_COUNT = 2_000;
const MAX_DIST_BYTES = 45 * 1024 * 1024;
const MAX_QURAN_BYTES = 35 * 1024 * 1024;
const FORBIDDEN_PRACTICE_ARTIFACT =
  /(whisper|transformers|onnx|ort-wasm|\.worker(?:-|\.)|onnxruntime)/i;
const FORBIDDEN_PRACTICE_SIGNATURE =
  /@huggingface\/transformers|onnxruntime|ort-wasm|whisper\.worker|whisper-tiny|Xenova\//i;
const TEXT_ASSET_EXTENSION = /\.(?:css|html|js|json|mjs)$/i;

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

const files = await collectFiles(DIST_DIRECTORY);
const quranFiles = files.filter((file) => file.startsWith(QURAN_DIRECTORY));
const distBytes = await totalSize(files);
const quranBytes = await totalSize(quranFiles);
const forbiddenFiles = files.filter((file) =>
  FORBIDDEN_PRACTICE_ARTIFACT.test(path.basename(file)),
);
const emittedTextAssets = files.filter((file) =>
  TEXT_ASSET_EXTENSION.test(file),
);
const forbiddenSignatures = (
  await Promise.all(
    emittedTextAssets.map(async (file) => ({
      file,
      content: await readFile(file, "utf8"),
    })),
  )
)
  .filter(({ content }) => FORBIDDEN_PRACTICE_SIGNATURE.test(content))
  .map(({ file }) => file);

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
if (forbiddenFiles.length > 0) {
  failures.push(
    `default build contains practice artifacts:\n${forbiddenFiles.join("\n")}`,
  );
}
if (forbiddenSignatures.length > 0) {
  failures.push(
    `default build contains practice runtime signatures:\n${forbiddenSignatures.join("\n")}`,
  );
}

if (failures.length > 0) {
  throw new Error(failures.join("\n\n"));
}

console.log(
  `Build budget passed: ${files.length} files, ${distBytes} bytes total, ${quranBytes} Quran bytes.`,
);
