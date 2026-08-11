import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import {
  DATA_SCHEMA_VERSION,
  DATA_VERSION,
  EXPECTED,
  assert,
  hashLengthPrefixedStrings,
  legacyDataRoot,
  readGzipJson,
  readJson,
  runtimeDataRoot,
  runtimeManifestPath,
  sha256,
  sourceDataRoot,
  sum,
} from "./lib.mjs";

const MAX_COMPRESSED_QURAN_BYTES = 35_000_000;
const SUPERSEDED_RUNTIME_PATHS = [
  "Chapters_Info",
  "Chapters_Simple",
  "Chapters_Uthmani",
  "Juzs",
  "quran_tafseer",
  "hafsData_v2-0.json",
  "mushaf_word_layout_page41_sample.json",
  "mushaf_word_layout_v4.json",
  "Quran_info.json",
  "Quran_Simple.json",
  "Quran_Uthmani.json",
  "quran_verses_imlaei.json",
  "quran_verses_imlaei_cleaned.json",
];

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
}

async function verifyAsset(asset, root) {
  const compressed = await readFile(join(root, asset.path));
  const uncompressed = gunzipSync(compressed);
  assert(compressed.byteLength === asset.bytes, `Wrong size for ${asset.path}`);
  assert(
    uncompressed.byteLength === asset.uncompressedBytes,
    `Wrong uncompressed size for ${asset.path}`,
  );
  assert(sha256(compressed) === asset.sha256, `Wrong hash for ${asset.path}`);
  assert(
    sha256(uncompressed) === asset.contentSha256,
    `Wrong content hash for ${asset.path}`,
  );
}

function verifyInvariants(invariants, label) {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    assert(
      invariants[name] === expected,
      `${label} ${name} must be ${expected}`,
    );
  }
}

function quranTextHash(core) {
  const texts = [];
  for (const verse of core.mushafVerses) {
    texts.push(verse.aya_text, verse.aya_text_emlaey);
  }
  for (const [records, field] of [
    [core.uthmaniVerses, "text_uthmani"],
    [core.simpleVerses, "text_uthmani_simple"],
    [core.chapterSimpleVerses, "text_uthmani_simple"],
    [core.imlaeiVerses, "text_imlaei"],
    [core.imlaeiCleanedVerses, "text_imlaei"],
  ]) {
    texts.push(...records.map((record) => record[field]));
  }
  return hashLengthPrefixedStrings(texts);
}

async function verifySupersededDataWasRemoved() {
  const remaining = [];
  for (const relativePath of SUPERSEDED_RUNTIME_PATHS) {
    if (await pathExists(join(legacyDataRoot, relativePath))) {
      remaining.push(relativePath);
    }
  }

  if (remaining.length === 0) return;
  if (process.argv.includes("--allow-legacy")) {
    console.warn(`Legacy data still present: ${remaining.join(", ")}`);
    return;
  }
  throw new Error(
    `Superseded Quran runtime data remains: ${remaining.join(", ")}. ` +
      "Run the migration parity check before removing it.",
  );
}

async function main() {
  const [sourceManifest, manifest] = await Promise.all([
    readJson(join(sourceDataRoot, "manifest.json")),
    readJson(runtimeManifestPath),
  ]);
  assert(
    sourceManifest.schemaVersion === DATA_SCHEMA_VERSION,
    "Wrong source schema",
  );
  assert(
    manifest.schemaVersion === DATA_SCHEMA_VERSION,
    "Wrong runtime schema",
  );
  assert(sourceManifest.dataVersion === DATA_VERSION, "Wrong source version");
  assert(manifest.dataVersion === DATA_VERSION, "Wrong runtime version");
  verifyInvariants(sourceManifest.invariants, "Source invariant");
  verifyInvariants(manifest.invariants, "Runtime invariant");
  assert(
    manifest.compressedBytes < MAX_COMPRESSED_QURAN_BYTES,
    `Compressed data exceeds ${MAX_COMPRESSED_QURAN_BYTES} bytes`,
  );

  await Promise.all([
    verifyAsset(sourceManifest.packs.core, sourceDataRoot),
    verifyAsset(sourceManifest.packs.layout, sourceDataRoot),
    ...Object.values(sourceManifest.packs.tafsirs).map((asset) =>
      verifyAsset(asset, sourceDataRoot),
    ),
    verifyAsset(manifest.core, legacyDataRoot),
    ...manifest.layouts.assets.map((asset) =>
      verifyAsset(asset, legacyDataRoot),
    ),
    ...Object.values(manifest.tafsirs.assets).flatMap((assets) =>
      assets.map((asset) => verifyAsset(asset, legacyDataRoot)),
    ),
  ]);

  const [sourceCore, runtimeCore, sourceLayout] = await Promise.all([
    readGzipJson(join(sourceDataRoot, sourceManifest.packs.core.path)),
    readGzipJson(join(legacyDataRoot, manifest.core.path)),
    readGzipJson(join(sourceDataRoot, sourceManifest.packs.layout.path)),
  ]);
  assert(
    JSON.stringify(runtimeCore) === JSON.stringify(sourceCore),
    "Runtime Quran core differs from the consolidated source",
  );
  assert(
    runtimeCore.mushafVerses.length === EXPECTED.verses,
    "Wrong verse count",
  );
  assert(
    new Set(runtimeCore.mushafVerses.map((verse) => verse.sura_no)).size ===
      EXPECTED.surahs,
    "Wrong surah count",
  );
  assert(
    new Set(runtimeCore.mushafVerses.map((verse) => verse.page)).size ===
      EXPECTED.pages,
    "Wrong page count",
  );
  assert(
    runtimeCore.verseInfo.length === EXPECTED.verseInfoRecords,
    "Wrong verse-info count",
  );
  assert(
    quranTextHash(runtimeCore) === sourceManifest.fidelity.quranTextSha256,
    "A Quran text value changed during migration",
  );

  assert(
    manifest.layouts.assets.length === EXPECTED.pages,
    "Wrong page asset count",
  );
  for (let index = 0; index < EXPECTED.pages; index += 1) {
    const runtimePage = await readGzipJson(
      join(legacyDataRoot, manifest.layouts.assets[index].path),
    );
    assert(
      JSON.stringify(runtimePage) === JSON.stringify(sourceLayout.pages[index]),
      `Layout page ${index + 1} changed during migration`,
    );
  }

  let tafsirRecordCount = 0;
  let tafsirBundleCount = 0;
  for (let tafsirId = 1; tafsirId <= EXPECTED.tafsirs; tafsirId += 1) {
    const source = await readGzipJson(
      join(sourceDataRoot, sourceManifest.packs.tafsirs[tafsirId].path),
    );
    const assets = manifest.tafsirs.assets[tafsirId];
    assert(
      assets.length === EXPECTED.surahs,
      `Tafsir ${tafsirId} bundle count is wrong`,
    );
    const texts = [];

    for (let index = 0; index < EXPECTED.surahs; index += 1) {
      const bundle = await readGzipJson(
        join(legacyDataRoot, assets[index].path),
      );
      const sourceSurah = source.surahs[index];
      assert(
        bundle.surah === index + 1,
        `Wrong surah in ${assets[index].path}`,
      );
      assert(
        bundle.ayahs.length === sourceSurah.records.length,
        `Wrong ayah count in ${assets[index].path}`,
      );
      for (let ayahIndex = 0; ayahIndex < bundle.ayahs.length; ayahIndex += 1) {
        const ayah = bundle.ayahs[ayahIndex];
        const sourceRecord = sourceSurah.records[ayahIndex];
        assert(
          ayah.ayah === sourceRecord.ayah_number &&
            ayah.text === sourceRecord.text,
          `Tafsir text changed at ${tafsirId}:${index + 1}:${ayahIndex + 1}`,
        );
        texts.push(ayah.text);
      }
      tafsirRecordCount += bundle.ayahs.length;
      tafsirBundleCount += 1;
    }

    assert(
      hashLengthPrefixedStrings(texts) ===
        sourceManifest.fidelity.tafsirTextSha256[tafsirId],
      `Tafsir ${tafsirId} fidelity hash changed`,
    );
  }

  assert(
    tafsirBundleCount === EXPECTED.tafsirBundles,
    "Wrong tafsir bundle total",
  );
  assert(
    tafsirRecordCount === EXPECTED.tafsirRecords,
    "Wrong tafsir record total",
  );
  const expectedCompressedBytes =
    manifest.core.bytes +
    sum(manifest.layouts.assets.map((asset) => asset.bytes)) +
    sum(
      Object.values(manifest.tafsirs.assets).flatMap((assets) =>
        assets.map((asset) => asset.bytes),
      ),
    );
  assert(
    manifest.compressedBytes === expectedCompressedBytes,
    "Manifest compressed-byte total is wrong",
  );
  const runtimeFiles = await listFiles(runtimeDataRoot);
  assert(
    runtimeFiles.length === 1 + EXPECTED.pages + EXPECTED.tafsirBundles,
    `Runtime file count is ${runtimeFiles.length}; expected ${
      1 + EXPECTED.pages + EXPECTED.tafsirBundles
    }`,
  );
  await verifySupersededDataWasRemoved();

  console.log(
    `Verified ${EXPECTED.verses} verses, ${EXPECTED.surahs} surahs, ` +
      `${EXPECTED.pages} layouts, ${tafsirBundleCount} tafsir bundles, and ` +
      `${tafsirRecordCount} tafsir records (${(
        manifest.compressedBytes / 1_000_000
      ).toFixed(2)} MB compressed).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
