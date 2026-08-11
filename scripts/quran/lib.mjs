import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";

export const DATA_SCHEMA_VERSION = 1;
export const DATA_VERSION = "v1";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));

export const repositoryRoot = resolve(scriptsDirectory, "..", "..");
export const legacyDataRoot = join(repositoryRoot, "public", "data", "quran");
export const sourceDataRoot = join(
  repositoryRoot,
  "scripts",
  "quran",
  "source-data",
  DATA_VERSION,
);
export const runtimeDataRoot = join(legacyDataRoot, DATA_VERSION);
export const runtimeManifestPath = join(legacyDataRoot, "manifest.json");

export const EXPECTED = Object.freeze({
  verses: 6_236,
  surahs: 114,
  pages: 604,
  verseInfoRecords: 6_236,
  tafsirs: 8,
  tafsirBundles: 912,
  tafsirRecords: 49_888,
});

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertPathInside(parentPath, targetPath) {
  const parent = resolve(parentPath);
  const target = resolve(targetPath);
  const pathFromParent = relative(parent, target);

  assert(
    pathFromParent !== "" &&
      !pathFromParent.startsWith("..") &&
      !isAbsolute(pathFromParent),
    `Refusing to modify path outside ${parent}: ${target}`,
  );
}

export async function resetDirectory(parentPath, targetPath) {
  assertPathInside(parentPath, targetPath);
  await rm(targetPath, { force: true, recursive: true });
  await mkdir(targetPath, { recursive: true });
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function readGzipJson(filePath) {
  const compressed = await readFile(filePath);
  return JSON.parse(gunzipSync(compressed).toString("utf8"));
}

export function serializeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

export function gzipDeterministic(input) {
  const compressed = gzipSync(input, { level: 9, mtime: 0 });

  // Normalize the gzip OS header so archives are byte-identical across hosts.
  compressed[9] = 255;
  return compressed;
}

export async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeGzipJson(
  filePath,
  value,
  assetRoot = legacyDataRoot,
) {
  const serialized = serializeJson(value);
  const compressed = gzipDeterministic(serialized);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, compressed);
  return describeAsset(filePath, serialized, compressed, assetRoot);
}

export function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

export function hashLengthPrefixedStrings(values) {
  const hash = createHash("sha256");

  for (const value of values) {
    const bytes = Buffer.from(value, "utf8");
    const size = Buffer.allocUnsafe(4);
    size.writeUInt32BE(bytes.length);
    hash.update(size);
    hash.update(bytes);
  }

  return hash.digest("hex");
}

export function describeAsset(
  filePath,
  uncompressed,
  compressed,
  assetRoot = legacyDataRoot,
) {
  return {
    path: relative(assetRoot, filePath).replaceAll("\\", "/"),
    bytes: compressed.byteLength,
    uncompressedBytes: uncompressed.byteLength,
    sha256: sha256(compressed),
    contentSha256: sha256(uncompressed),
  };
}

export async function describeExistingGzipAsset(
  filePath,
  assetRoot = legacyDataRoot,
) {
  const compressed = await readFile(filePath);
  const uncompressed = gunzipSync(compressed);
  return describeAsset(filePath, uncompressed, compressed, assetRoot);
}

export function pad3(value) {
  return String(value).padStart(3, "0");
}

export function verseKey(surah, ayah) {
  return `${surah}:${ayah}`;
}

export function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
