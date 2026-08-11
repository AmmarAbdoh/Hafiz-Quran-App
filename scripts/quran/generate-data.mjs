import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import {
  DATA_SCHEMA_VERSION,
  DATA_VERSION,
  EXPECTED,
  assert,
  hashLengthPrefixedStrings,
  legacyDataRoot,
  pad3,
  readGzipJson,
  readJson,
  resetDirectory,
  runtimeDataRoot,
  runtimeManifestPath,
  sha256,
  sourceDataRoot,
  sum,
  writeGzipJson,
  writeJson,
} from "./lib.mjs";

async function verifySourceAsset(asset) {
  const filePath = join(sourceDataRoot, asset.path);
  const compressed = await readFile(filePath);
  const uncompressed = gunzipSync(compressed);
  assert(
    sha256(compressed) === asset.sha256,
    `Source pack hash failed: ${asset.path}`,
  );
  assert(
    sha256(uncompressed) === asset.contentSha256,
    `Source pack content hash failed: ${asset.path}`,
  );
}

function verifySourceManifest(manifest) {
  assert(
    manifest.schemaVersion === DATA_SCHEMA_VERSION,
    "Unsupported source schema",
  );
  assert(
    manifest.dataVersion === DATA_VERSION,
    "Unsupported source data version",
  );

  for (const [name, expected] of Object.entries(EXPECTED)) {
    assert(
      manifest.invariants[name] === expected,
      `Source invariant ${name} must be ${expected}`,
    );
  }
}

function buildRuntimeCore(sourceCore) {
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    mushafVerses: sourceCore.mushafVerses,
    verseInfo: sourceCore.verseInfo,
    uthmaniVerses: sourceCore.uthmaniVerses,
    simpleVerses: sourceCore.simpleVerses,
    chapterSimpleVerses: sourceCore.chapterSimpleVerses,
    imlaeiVerses: sourceCore.imlaeiVerses,
    imlaeiCleanedVerses: sourceCore.imlaeiCleanedVerses,
  };
}

async function writeLayoutPages(layout) {
  const assets = [];

  for (const page of layout.pages) {
    const asset = await writeGzipJson(
      join(runtimeDataRoot, "layout", "pages", `${pad3(page.page)}.json.gz`),
      page,
    );
    assets.push(asset);
  }

  return assets;
}

async function writeTafsirBundles(sourceManifest) {
  const assets = {};
  const names = {};
  const textHashes = {};
  let bundleCount = 0;
  let recordCount = 0;

  for (let tafsirId = 1; tafsirId <= EXPECTED.tafsirs; tafsirId += 1) {
    const sourceAsset = sourceManifest.packs.tafsirs[tafsirId];
    await verifySourceAsset(sourceAsset);
    const source = await readGzipJson(join(sourceDataRoot, sourceAsset.path));
    const tafsirAssets = [];
    const texts = [];
    names[tafsirId] = source.tafsirName;

    for (const sourceSurah of source.surahs) {
      const bundle = {
        schemaVersion: DATA_SCHEMA_VERSION,
        tafsirId: String(tafsirId),
        tafsirName: source.tafsirName,
        surah: sourceSurah.surah,
        ayahs: sourceSurah.records.map((record) => ({
          ayah: record.ayah_number,
          text: record.text,
        })),
      };
      texts.push(...bundle.ayahs.map((ayah) => ayah.text));
      const asset = await writeGzipJson(
        join(
          runtimeDataRoot,
          "tafsir",
          String(tafsirId),
          "surahs",
          `${pad3(sourceSurah.surah)}.json.gz`,
        ),
        bundle,
      );
      tafsirAssets.push(asset);
      bundleCount += 1;
      recordCount += bundle.ayahs.length;
    }

    assets[tafsirId] = tafsirAssets;
    textHashes[tafsirId] = hashLengthPrefixedStrings(texts);
    assert(
      textHashes[tafsirId] ===
        sourceManifest.fidelity.tafsirTextSha256[tafsirId],
      `Tafsir ${tafsirId} text changed while bundling`,
    );
  }

  assert(bundleCount === EXPECTED.tafsirBundles, "Wrong tafsir bundle count");
  assert(recordCount === EXPECTED.tafsirRecords, "Wrong tafsir record count");
  return { assets, bundleCount, names, recordCount, textHashes };
}

async function main() {
  const sourceManifest = await readJson(join(sourceDataRoot, "manifest.json"));
  verifySourceManifest(sourceManifest);
  await Promise.all([
    verifySourceAsset(sourceManifest.packs.core),
    verifySourceAsset(sourceManifest.packs.layout),
  ]);

  const [sourceCore, layout] = await Promise.all([
    readGzipJson(join(sourceDataRoot, sourceManifest.packs.core.path)),
    readGzipJson(join(sourceDataRoot, sourceManifest.packs.layout.path)),
  ]);
  assert(
    sourceCore.mushafVerses.length === EXPECTED.verses,
    "Wrong verse count",
  );
  assert(
    sourceCore.verseInfo.length === EXPECTED.verseInfoRecords,
    "Wrong info count",
  );
  assert(layout.pages.length === EXPECTED.pages, "Wrong layout page count");

  await resetDirectory(legacyDataRoot, runtimeDataRoot);
  console.log("Writing compressed Quran core...");
  const coreAsset = await writeGzipJson(
    join(runtimeDataRoot, "core.json.gz"),
    buildRuntimeCore(sourceCore),
  );
  console.log(`Writing ${EXPECTED.pages} page-layout chunks...`);
  const layoutAssets = await writeLayoutPages(layout);
  console.log(`Writing ${EXPECTED.tafsirBundles} tafsir bundles...`);
  const tafsirs = await writeTafsirBundles(sourceManifest);

  const compressedBytes =
    coreAsset.bytes +
    sum(layoutAssets.map((asset) => asset.bytes)) +
    sum(
      Object.values(tafsirs.assets).flatMap((assets) =>
        assets.map((asset) => asset.bytes),
      ),
    );
  const manifest = {
    schemaVersion: DATA_SCHEMA_VERSION,
    dataVersion: DATA_VERSION,
    generatedBy: "scripts/quran/generate-data.mjs",
    invariants: EXPECTED,
    attribution: sourceManifest.attribution,
    fidelity: {
      quranTextSha256: sourceManifest.fidelity.quranTextSha256,
      tafsirTextSha256: tafsirs.textHashes,
    },
    core: coreAsset,
    layouts: {
      count: layoutAssets.length,
      mushaf: layout.meta.mushaf,
      source: layout.meta.source,
      pathTemplate: `${DATA_VERSION}/layout/pages/{page}.json.gz`,
      assets: layoutAssets,
      compressedBytes: sum(layoutAssets.map((asset) => asset.bytes)),
    },
    tafsirs: {
      ids: Object.keys(tafsirs.assets),
      names: tafsirs.names,
      bundleCount: tafsirs.bundleCount,
      recordCount: tafsirs.recordCount,
      pathTemplate: `${DATA_VERSION}/tafsir/{tafsirId}/surahs/{surah}.json.gz`,
      assets: tafsirs.assets,
      compressedBytes: sum(
        Object.values(tafsirs.assets).flatMap((assets) =>
          assets.map((asset) => asset.bytes),
        ),
      ),
    },
    compressedBytes,
  };

  await writeJson(runtimeManifestPath, manifest);
  console.log(
    `Generated ${layoutAssets.length + tafsirs.bundleCount + 2} files ` +
      `(${(compressedBytes / 1_000_000).toFixed(2)} MB compressed Quran data).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
