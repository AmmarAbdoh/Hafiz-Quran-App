import { decodeCompressedJson } from "./decompress";
import type {
  MushafPageLayout,
  QuranCoreData,
  QuranDataLocale,
  QuranDataManifest,
  QuranRepository,
  TafsirBundle,
} from "./types";

export type QuranRepositoryErrorCode =
  | "invalid-request"
  | "network"
  | "not-found"
  | "invalid-data";

const ERROR_MESSAGES: Record<
  QuranRepositoryErrorCode,
  Record<QuranDataLocale, string>
> = {
  "invalid-request": {
    ar: "طلب بيانات القرآن غير صالح.",
    en: "The Quran data request is invalid.",
  },
  network: {
    ar: "تعذر تحميل بيانات القرآن. تحقق من الاتصال وحاول مرة أخرى.",
    en: "Quran data could not be loaded. Check your connection and retry.",
  },
  "not-found": {
    ar: "بيانات القرآن المطلوبة غير متوفرة.",
    en: "The requested Quran data is unavailable.",
  },
  "invalid-data": {
    ar: "تعذر قراءة بيانات القرآن. حاول مرة أخرى.",
    en: "Quran data could not be read. Please retry.",
  },
};

export class QuranRepositoryError extends Error {
  readonly retryable: boolean;
  readonly originalCause: unknown;

  constructor(
    readonly code: QuranRepositoryErrorCode,
    options: { cause?: unknown; retryable?: boolean } = {},
  ) {
    super(ERROR_MESSAGES[code].en);
    this.name = "QuranRepositoryError";
    this.retryable =
      options.retryable ?? (code === "network" || code === "invalid-data");
    this.originalCause = options.cause;
  }

  getLocalizedMessage(locale: QuranDataLocale): string {
    return ERROR_MESSAGES[this.code][locale];
  }
}

export type QuranDataFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface LocalQuranRepositoryOptions {
  baseUrl?: string;
  fetcher?: QuranDataFetcher;
}

function isIntegerInRange(value: number, minimum: number, maximum: number) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function ensureSupportedManifest(
  manifest: QuranDataManifest,
): QuranDataManifest {
  if (
    manifest.schemaVersion !== 1 ||
    manifest.dataVersion !== "v1" ||
    manifest.invariants.verses !== 6236 ||
    manifest.invariants.pages !== 604
  ) {
    throw new QuranRepositoryError("invalid-data");
  }
  return manifest;
}

export class LocalQuranRepository implements QuranRepository {
  private readonly baseUrl: string;
  private readonly fetcher: QuranDataFetcher;
  private readonly requests = new Map<string, Promise<unknown>>();

  constructor(options: LocalQuranRepositoryOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "/data/quran").replace(/\/$/, "");
    this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  }

  clearCache(): void {
    this.requests.clear();
  }

  loadCoreData(): Promise<QuranCoreData> {
    return this.cached("core", async () => {
      const manifest = await this.loadManifest();
      return this.fetchCompressedJson<QuranCoreData>(manifest.core.path);
    });
  }

  loadPageLayout(page: number): Promise<MushafPageLayout> {
    if (!isIntegerInRange(page, 1, 604)) {
      return Promise.reject(
        new QuranRepositoryError("invalid-request", { retryable: false }),
      );
    }

    return this.cached(`layout:${page}`, async () => {
      const manifest = await this.loadManifest();
      const asset = manifest.layouts.assets[page - 1];
      if (!asset)
        throw new QuranRepositoryError("not-found", { retryable: false });
      const layout = await this.fetchCompressedJson<MushafPageLayout>(
        asset.path,
      );
      if (layout.page !== page || !Array.isArray(layout.lines)) {
        throw new QuranRepositoryError("invalid-data");
      }
      return layout;
    });
  }

  loadSurahLayouts(surah: number): Promise<MushafPageLayout[]> {
    if (!isIntegerInRange(surah, 1, 114)) {
      return Promise.reject(
        new QuranRepositoryError("invalid-request", { retryable: false }),
      );
    }

    return this.cached(`surah-layouts:${surah}`, async () => {
      const core = await this.loadCoreData();
      const pages = new Set<number>();
      for (const verse of core.mushafVerses) {
        if (verse.sura_no === surah) pages.add(verse.page);
      }
      if (pages.size === 0) {
        throw new QuranRepositoryError("not-found", { retryable: false });
      }
      return Promise.all(
        [...pages]
          .sort((a, b) => a - b)
          .map((page) => this.loadPageLayout(page)),
      );
    });
  }

  loadTafsirText(
    tafsirId: string,
    surah: number,
    ayah: number,
  ): Promise<string> {
    if (
      !/^\d+$/.test(tafsirId) ||
      !isIntegerInRange(surah, 1, 114) ||
      !isIntegerInRange(ayah, 1, 286)
    ) {
      return Promise.reject(
        new QuranRepositoryError("invalid-request", { retryable: false }),
      );
    }

    return this.cached(`tafsir-text:${tafsirId}:${surah}:${ayah}`, async () => {
      const bundle = await this.loadTafsirBundle(tafsirId, surah);
      const text = bundle.ayahs.find((item) => item.ayah === ayah)?.text;
      if (text === undefined) {
        throw new QuranRepositoryError("not-found", { retryable: false });
      }
      return text;
    });
  }

  private loadManifest(): Promise<QuranDataManifest> {
    return this.cached("manifest", async () => {
      const response = await this.fetchResponse("manifest.json");
      try {
        return ensureSupportedManifest(
          (await response.json()) as QuranDataManifest,
        );
      } catch (cause) {
        if (cause instanceof QuranRepositoryError) throw cause;
        throw new QuranRepositoryError("invalid-data", { cause });
      }
    });
  }

  private loadTafsirBundle(
    tafsirId: string,
    surah: number,
  ): Promise<TafsirBundle> {
    return this.cached(`tafsir-bundle:${tafsirId}:${surah}`, async () => {
      const manifest = await this.loadManifest();
      const assets = manifest.tafsirs.assets[tafsirId];
      if (!assets || !manifest.tafsirs.ids.includes(tafsirId)) {
        throw new QuranRepositoryError("not-found", { retryable: false });
      }
      const asset = assets[surah - 1];
      if (!asset)
        throw new QuranRepositoryError("not-found", { retryable: false });
      const bundle = await this.fetchCompressedJson<TafsirBundle>(asset.path);
      if (bundle.tafsirId !== tafsirId || bundle.surah !== surah) {
        throw new QuranRepositoryError("invalid-data");
      }
      return bundle;
    });
  }

  private async fetchCompressedJson<T>(relativePath: string): Promise<T> {
    const response = await this.fetchResponse(relativePath);
    try {
      return await decodeCompressedJson<T>(
        new Uint8Array(await response.arrayBuffer()),
      );
    } catch (cause) {
      throw new QuranRepositoryError("invalid-data", { cause });
    }
  }

  private async fetchResponse(relativePath: string): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}/${relativePath}`);
    } catch (cause) {
      throw new QuranRepositoryError("network", { cause });
    }
    if (!response.ok) {
      const code = response.status === 404 ? "not-found" : "network";
      throw new QuranRepositoryError(code, {
        retryable: code === "network",
      });
    }
    return response;
  }

  private cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.requests.get(key);
    if (existing) return existing as Promise<T>;

    const request = Promise.resolve()
      .then(load)
      .catch((cause: unknown) => {
        if (this.requests.get(key) === request) this.requests.delete(key);
        if (cause instanceof QuranRepositoryError) throw cause;
        throw new QuranRepositoryError("invalid-data", { cause });
      });
    this.requests.set(key, request);
    return request;
  }
}

export const quranRepository = new LocalQuranRepository();
