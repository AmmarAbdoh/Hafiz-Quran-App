import { gzipSync, strToU8 } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";

import { decompressGzip } from "./decompress";
import {
  LocalQuranRepository,
  QuranRepositoryError,
  type QuranDataFetcher,
} from "./QuranRepository";
import type {
  MushafPageLayout,
  QuranCoreData,
  QuranDataAsset,
  QuranDataManifest,
  TafsirBundle,
} from "./types";

function asset(path: string): QuranDataAsset {
  return {
    path,
    bytes: 0,
    uncompressedBytes: 0,
    sha256: "test",
    contentSha256: "test",
  };
}

const core: QuranCoreData = {
  schemaVersion: 1,
  mushafVerses: [
    {
      id: 1,
      jozz: 1,
      page: 1,
      sura_no: 1,
      sura_name_en: "Al-Fatihah",
      sura_name_ar: "الفاتحة",
      line_start: 2,
      line_end: 2,
      aya_no: 1,
      aya_text: "بسم الله",
      aya_text_emlaey: "بسم الله",
    },
    {
      id: 2,
      jozz: 1,
      page: 2,
      sura_no: 1,
      sura_name_en: "Al-Fatihah",
      sura_name_ar: "الفاتحة",
      line_start: 1,
      line_end: 1,
      aya_no: 2,
      aya_text: "الحمد لله",
      aya_text_emlaey: "الحمد لله",
    },
  ],
  verseInfo: [],
  uthmaniVerses: [],
  simpleVerses: [],
  chapterSimpleVerses: [],
  imlaeiVerses: [],
  imlaeiCleanedVerses: [],
};

const pageOne: MushafPageLayout = { page: 1, lines: [] };
const pageTwo: MushafPageLayout = { page: 2, lines: [] };
const tafsirBundle: TafsirBundle = {
  schemaVersion: 1,
  tafsirId: "1",
  tafsirName: "التفسير الميسر",
  surah: 1,
  ayahs: [{ ayah: 1, text: "نص التفسير" }],
};

const manifest: QuranDataManifest = {
  schemaVersion: 1,
  dataVersion: "v1",
  invariants: {
    verses: 6236,
    surahs: 114,
    pages: 604,
    verseInfoRecords: 6236,
    tafsirs: 8,
    tafsirBundles: 912,
    tafsirRecords: 49888,
  },
  core: asset("v1/core.json.gz"),
  layouts: {
    count: 604,
    mushaf: 19,
    source: "test",
    pathTemplate: "v1/layout/pages/{page}.json.gz",
    assets: [
      asset("v1/layout/pages/001.json.gz"),
      asset("v1/layout/pages/002.json.gz"),
    ],
    compressedBytes: 0,
  },
  tafsirs: {
    ids: ["1"],
    names: { "1": "التفسير الميسر" },
    bundleCount: 912,
    recordCount: 49888,
    pathTemplate: "v1/tafsir/{tafsirId}/surahs/{surah}.json.gz",
    assets: { "1": [asset("v1/tafsir/1/surahs/001.json.gz")] },
    compressedBytes: 0,
  },
  compressedBytes: 0,
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function createFetcher(overrides: Record<string, () => Response> = {}) {
  const responses: Record<string, () => Response> = {
    "/data/quran/manifest.json": () => jsonResponse(manifest),
    "/data/quran/v1/core.json.gz": () => jsonResponse(core),
    "/data/quran/v1/layout/pages/001.json.gz": () => jsonResponse(pageOne),
    "/data/quran/v1/layout/pages/002.json.gz": () => jsonResponse(pageTwo),
    "/data/quran/v1/tafsir/1/surahs/001.json.gz": () =>
      jsonResponse(tafsirBundle),
    ...overrides,
  };
  return vi.fn<QuranDataFetcher>((input) => {
    const response = responses[requestUrl(input)]?.();
    return Promise.resolve(response ?? new Response(null, { status: 404 }));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LocalQuranRepository", () => {
  it("shares in-flight and resolved core requests", async () => {
    const fetcher = createFetcher();
    const repository = new LocalQuranRepository({ fetcher });

    const [first, second] = await Promise.all([
      repository.loadCoreData(),
      repository.loadCoreData(),
    ]);
    expect(first).toBe(second);
    expect(await repository.loadCoreData()).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("evicts rejected requests so a retry can succeed", async () => {
    let coreAttempts = 0;
    const fetcher = createFetcher({
      "/data/quran/v1/core.json.gz": () => {
        coreAttempts += 1;
        return coreAttempts === 1
          ? new Response(null, { status: 503 })
          : jsonResponse(core);
      },
    });
    const repository = new LocalQuranRepository({ fetcher });

    await expect(repository.loadCoreData()).rejects.toMatchObject({
      code: "network",
      retryable: true,
    });
    await expect(repository.loadCoreData()).resolves.toEqual(core);
    expect(coreAttempts).toBe(2);
  });

  it("loads only the layouts belonging to a surah and reuses page requests", async () => {
    const fetcher = createFetcher();
    const repository = new LocalQuranRepository({ fetcher });

    await expect(repository.loadSurahLayouts(1)).resolves.toEqual([
      pageOne,
      pageTwo,
    ]);
    await repository.loadPageLayout(1);
    expect(
      fetcher.mock.calls.filter(([input]) =>
        requestUrl(input).includes("layout/pages/001"),
      ),
    ).toHaveLength(1);
  });

  it("returns one exact tafsir text from its surah bundle", async () => {
    const repository = new LocalQuranRepository({ fetcher: createFetcher() });
    await expect(repository.loadTafsirText("1", 1, 1)).resolves.toBe(
      "نص التفسير",
    );
  });

  it("exposes retryable localized errors", async () => {
    const repository = new LocalQuranRepository({
      fetcher: vi
        .fn<QuranDataFetcher>()
        .mockRejectedValue(new Error("offline")),
    });

    const error = await repository
      .loadCoreData()
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(QuranRepositoryError);
    if (!(error instanceof QuranRepositoryError)) return;
    expect(error.retryable).toBe(true);
    expect(error.getLocalizedMessage("ar")).toContain("تعذر تحميل");
    expect(error.getLocalizedMessage("en")).toContain("could not be loaded");
  });

  it("rejects invalid ranges without making a request", async () => {
    const fetcher = createFetcher();
    const repository = new LocalQuranRepository({ fetcher });
    await expect(repository.loadPageLayout(0)).rejects.toMatchObject({
      code: "invalid-request",
      retryable: false,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("decompressGzip", () => {
  it("uses the fflate fallback when streaming decompression is unavailable", async () => {
    vi.stubGlobal("DecompressionStream", undefined);
    const compressed = gzipSync(strToU8("faithful text"));
    const result = await decompressGzip(compressed);
    expect(new TextDecoder().decode(result)).toBe("faithful text");
  });
});
