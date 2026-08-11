import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  DATA_SCHEMA_VERSION,
  DATA_VERSION,
  EXPECTED,
  assert,
  hashLengthPrefixedStrings,
  legacyDataRoot,
  readJson,
  resetDirectory,
  sha256,
  sourceDataRoot,
  verseKey,
  writeGzipJson,
  writeJson,
} from "./lib.mjs";

function assertRecordCount(label, records, expected = EXPECTED.verses) {
  assert(
    Array.isArray(records) && records.length === expected,
    `${label} must contain ${expected} records; found ${records?.length ?? "none"}`,
  );
}

function assertSequentialVerseKeys(records, label) {
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    assert(
      record.id === index + 1,
      `${label} has a non-sequential id at ${index}`,
    );
    assert(
      /^\d{1,3}:\d{1,3}$/.test(record.verse_key),
      `${label} has an invalid verse key at id ${record.id}`,
    );
  }
}

function updateAggregateHash(hash, relativePath, rawFile) {
  for (const value of [relativePath, rawFile]) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
    const size = Buffer.allocUnsafe(4);
    size.writeUInt32BE(bytes.length);
    hash.update(size);
    hash.update(bytes);
  }
}

async function readLegacyFile(relativePath) {
  const raw = await readFile(join(legacyDataRoot, relativePath));
  return { data: JSON.parse(raw.toString("utf8")), raw };
}

async function readChapterCollection(directory, valueSelector) {
  const records = [];
  const aggregateHash = createHash("sha256");

  for (let surah = 1; surah <= EXPECTED.surahs; surah += 1) {
    const relativePath = `${directory}/chapter_${surah}.json`;
    const { data, raw } = await readLegacyFile(relativePath);
    updateAggregateHash(aggregateHash, relativePath, raw);
    records.push(...valueSelector(data));
  }

  return { records, sha256: aggregateHash.digest("hex") };
}

async function readJuzCollection() {
  const records = [];
  const aggregateHash = createHash("sha256");

  for (let juz = 1; juz <= 30; juz += 1) {
    const relativePath = `Juzs/juz_${juz}.json`;
    const { data, raw } = await readLegacyFile(relativePath);
    updateAggregateHash(aggregateHash, relativePath, raw);
    assert(data.juz_number === juz, `${relativePath} has the wrong juz number`);
    records.push(...data.verses);
  }

  const infoPath = "Juzs/Juzs_Info.json";
  const info = await readFile(join(legacyDataRoot, infoPath));
  updateAggregateHash(aggregateHash, infoPath, info);
  return { records, sha256: aggregateHash.digest("hex") };
}

function assertExactRecords(actual, expected, label) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} does not match its canonical full collection`,
  );
}

async function importCore() {
  const sourceFiles = {
    mushaf: "hafsData_v2-0.json",
    verseInfo: "Quran_info.json",
    uthmani: "Quran_Uthmani.json",
    simple: "Quran_Simple.json",
    imlaei: "quran_verses_imlaei.json",
    imlaeiCleaned: "quran_verses_imlaei_cleaned.json",
  };
  const loaded = Object.fromEntries(
    await Promise.all(
      Object.entries(sourceFiles).map(async ([key, relativePath]) => [
        key,
        await readLegacyFile(relativePath),
      ]),
    ),
  );

  const mushafVerses = loaded.mushaf.data;
  const verseInfo = loaded.verseInfo.data;
  const uthmaniVerses = loaded.uthmani.data.verses;
  const simpleVerses = loaded.simple.data.verses;
  const imlaeiVerses = loaded.imlaei.data.verses;
  const imlaeiCleanedVerses = loaded.imlaeiCleaned.data.verses;
  const chapterSimple = await readChapterCollection(
    "Chapters_Simple",
    (chapter) => chapter.verses,
  );
  const chapterInfo = await readChapterCollection(
    "Chapters_Info",
    (chapter) => chapter,
  );
  const chapterUthmani = await readChapterCollection(
    "Chapters_Uthmani",
    (chapter) => chapter.verses,
  );
  const juzUthmani = await readJuzCollection();

  for (const [label, records] of Object.entries({
    mushafVerses,
    verseInfo,
    uthmaniVerses,
    simpleVerses,
    imlaeiVerses,
    imlaeiCleanedVerses,
    chapterSimpleVerses: chapterSimple.records,
  })) {
    assertRecordCount(label, records);
  }

  assertSequentialVerseKeys(uthmaniVerses, "uthmaniVerses");
  assertSequentialVerseKeys(simpleVerses, "simpleVerses");
  assertSequentialVerseKeys(imlaeiVerses, "imlaeiVerses");
  assertSequentialVerseKeys(imlaeiCleanedVerses, "imlaeiCleanedVerses");
  assertSequentialVerseKeys(chapterSimple.records, "chapterSimpleVerses");
  assertExactRecords(chapterInfo.records, verseInfo, "Chapters_Info");
  assertExactRecords(chapterUthmani.records, uthmaniVerses, "Chapters_Uthmani");
  assertExactRecords(juzUthmani.records, uthmaniVerses, "Juzs");

  const surahs = new Set(mushafVerses.map((verse) => verse.sura_no));
  const pages = new Set(mushafVerses.map((verse) => verse.page));
  assert(surahs.size === EXPECTED.surahs, `Expected ${EXPECTED.surahs} surahs`);
  assert(pages.size === EXPECTED.pages, `Expected ${EXPECTED.pages} pages`);

  for (let index = 0; index < EXPECTED.verses; index += 1) {
    const mushafVerse = mushafVerses[index];
    const info = verseInfo[index];
    const key = verseKey(mushafVerse.sura_no, mushafVerse.aya_no);
    assert(mushafVerse.id === index + 1, `Mushaf id mismatch at ${index}`);
    assert(info.id === mushafVerse.id, `Verse info id mismatch at ${index}`);
    assert(info.verse_key === key, `Verse info key mismatch at ${index}`);

    for (const records of [
      uthmaniVerses,
      simpleVerses,
      imlaeiVerses,
      imlaeiCleanedVerses,
      chapterSimple.records,
    ]) {
      assert(
        records[index].verse_key === key,
        `Text variant key mismatch for ${key}`,
      );
    }
  }

  const core = {
    schemaVersion: DATA_SCHEMA_VERSION,
    mushafVerses,
    verseInfo,
    uthmaniVerses,
    simpleVerses,
    chapterSimpleVerses: chapterSimple.records,
    imlaeiVerses,
    imlaeiCleanedVerses,
  };
  const textValues = [];

  for (const verse of mushafVerses) {
    textValues.push(verse.aya_text, verse.aya_text_emlaey);
  }
  for (const [records, textField] of [
    [uthmaniVerses, "text_uthmani"],
    [simpleVerses, "text_uthmani_simple"],
    [chapterSimple.records, "text_uthmani_simple"],
    [imlaeiVerses, "text_imlaei"],
    [imlaeiCleanedVerses, "text_imlaei"],
  ]) {
    textValues.push(...records.map((record) => record[textField]));
  }

  return {
    core,
    contentSha256: hashLengthPrefixedStrings(textValues),
    legacyHashes: {
      ...Object.fromEntries(
        Object.entries(sourceFiles).map(([key, relativePath]) => [
          relativePath,
          sha256(loaded[key].raw),
        ]),
      ),
      Chapters_Info: chapterInfo.sha256,
      Chapters_Simple: chapterSimple.sha256,
      Chapters_Uthmani: chapterUthmani.sha256,
      Juzs: juzUthmani.sha256,
    },
    ayahCounts: Object.fromEntries(
      Array.from({ length: EXPECTED.surahs }, (_, index) => {
        const surah = index + 1;
        return [
          surah,
          mushafVerses.filter((verse) => verse.sura_no === surah).length,
        ];
      }),
    ),
  };
}

async function importLayout() {
  const relativePath = "mushaf_word_layout_v4.json";
  const { data: layout, raw } = await readLegacyFile(relativePath);
  assert(
    layout.meta.page_count === EXPECTED.pages &&
      layout.pages.length === EXPECTED.pages,
    `Layout must contain ${EXPECTED.pages} pages`,
  );

  for (let index = 0; index < layout.pages.length; index += 1) {
    assert(
      layout.pages[index].page === index + 1,
      `Missing layout page ${index + 1}`,
    );
  }

  const sample = await readJson(
    join(legacyDataRoot, "mushaf_word_layout_page41_sample.json"),
  );
  assert(
    JSON.stringify(sample.pages[0]) === JSON.stringify(layout.pages[40]),
    "The page 41 sample differs from the full layout",
  );

  return {
    layout,
    legacyHashes: {
      [relativePath]: sha256(raw),
      "mushaf_word_layout_page41_sample.json": sha256(
        await readFile(
          join(legacyDataRoot, "mushaf_word_layout_page41_sample.json"),
        ),
      ),
    },
  };
}

async function importTafsir(tafsirId, ayahCounts) {
  const surahs = [];
  const textValues = [];
  const aggregateHash = createHash("sha256");
  let tafsirName = "";

  for (let surah = 1; surah <= EXPECTED.surahs; surah += 1) {
    const expectedAyahs = ayahCounts[surah];
    const records = await Promise.all(
      Array.from({ length: expectedAyahs }, async (_, index) => {
        const ayah = index + 1;
        const relativePath =
          `quran_tafseer/tafseer_${tafsirId}/surah_${surah}/` +
          `tafseer_${tafsirId}_ayah_${ayah}.json`;
        const { data, raw } = await readLegacyFile(relativePath);
        updateAggregateHash(aggregateHash, relativePath, raw);
        assert(
          data.tafseer_id === tafsirId,
          `${relativePath} has the wrong tafsir id`,
        );
        assert(
          data.ayah_number === ayah,
          `${relativePath} has the wrong ayah number`,
        );
        assert(typeof data.text === "string", `${relativePath} has no text`);
        tafsirName ||= data.tafseer_name;
        assert(
          data.tafseer_name === tafsirName,
          `Tafsir ${tafsirId} has inconsistent names`,
        );
        return data;
      }),
    );
    textValues.push(...records.map((record) => record.text));
    surahs.push({ surah, records });
  }

  const recordCount = surahs.reduce(
    (count, surah) => count + surah.records.length,
    0,
  );
  assert(
    recordCount === EXPECTED.verses,
    `Tafsir ${tafsirId} must contain ${EXPECTED.verses} records`,
  );

  return {
    source: {
      schemaVersion: DATA_SCHEMA_VERSION,
      tafsirId: String(tafsirId),
      tafsirName,
      surahs,
    },
    legacySha256: aggregateHash.digest("hex"),
    textSha256: hashLengthPrefixedStrings(textValues),
    recordCount,
  };
}

async function main() {
  console.log("Characterizing legacy Quran data...");
  const coreImport = await importCore();
  const layoutImport = await importLayout();

  await resetDirectory(join(sourceDataRoot, ".."), sourceDataRoot);
  const coreAsset = await writeGzipJson(
    join(sourceDataRoot, "core.json.gz"),
    coreImport.core,
    sourceDataRoot,
  );
  const layoutAsset = await writeGzipJson(
    join(sourceDataRoot, "layout.json.gz"),
    layoutImport.layout,
    sourceDataRoot,
  );
  const tafsirAssets = {};
  const tafsirLegacyHashes = {};
  const tafsirTextHashes = {};
  const tafsirNames = {};
  let tafsirRecordCount = 0;

  for (let tafsirId = 1; tafsirId <= EXPECTED.tafsirs; tafsirId += 1) {
    console.log(`Importing tafsir ${tafsirId}/${EXPECTED.tafsirs}...`);
    const imported = await importTafsir(tafsirId, coreImport.ayahCounts);
    const asset = await writeGzipJson(
      join(sourceDataRoot, "tafsir", `${tafsirId}.json.gz`),
      imported.source,
      sourceDataRoot,
    );
    tafsirAssets[tafsirId] = asset;
    tafsirLegacyHashes[tafsirId] = imported.legacySha256;
    tafsirTextHashes[tafsirId] = imported.textSha256;
    tafsirNames[tafsirId] = imported.source.tafsirName;
    tafsirRecordCount += imported.recordCount;
  }

  assert(
    tafsirRecordCount === EXPECTED.tafsirRecords,
    `Expected ${EXPECTED.tafsirRecords} tafsir records; found ${tafsirRecordCount}`,
  );

  const sourceManifest = {
    schemaVersion: DATA_SCHEMA_VERSION,
    dataVersion: DATA_VERSION,
    generatedBy: "scripts/quran/import-legacy-data.mjs",
    invariants: {
      ...EXPECTED,
      tafsirRecords: tafsirRecordCount,
    },
    attribution: [
      {
        id: "quran-text",
        source: "Legacy Quran datasets bundled with this repository",
        note: "Original provider metadata was not recorded; every text value is retained without normalization.",
      },
      {
        id: "mushaf-layout",
        source: layoutImport.layout.meta.source,
        note: `Quran.com API v4, mushaf ${layoutImport.layout.meta.mushaf}`,
      },
      {
        id: "arabic-tafsir",
        source: "Legacy Arabic tafseer collection bundled with this repository",
        names: tafsirNames,
        note: "Original provider metadata was not recorded; every tafsir text is retained without normalization.",
      },
    ],
    fidelity: {
      quranTextSha256: coreImport.contentSha256,
      tafsirTextSha256: tafsirTextHashes,
    },
    legacyHashes: {
      ...coreImport.legacyHashes,
      ...layoutImport.legacyHashes,
      quran_tafseer: tafsirLegacyHashes,
    },
    packs: {
      core: coreAsset,
      layout: layoutAsset,
      tafsirs: tafsirAssets,
    },
  };

  await writeJson(join(sourceDataRoot, "manifest.json"), sourceManifest);
  console.log(
    `Imported ${EXPECTED.verses} verses, ${EXPECTED.pages} layouts, and ${tafsirRecordCount} tafsir records.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
