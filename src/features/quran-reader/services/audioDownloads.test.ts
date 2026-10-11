// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getReciterById } from "@/domain/quran";
import {
  ayahCount,
  cachedAudioUrl,
  deleteSurah,
  downloadSurah,
  downloadedBytes,
  estimateSurahBytes,
  getDownload,
  listDownloads,
  surahAudioUrls,
} from "./audioDownloads";

const reciter = getReciterById("ea-Husary_128kbps");

/**
 * Cache API over a Map, keyed by URL, holding the bodies that were put.
 *
 * Typed to the URL strings the service actually passes rather than the full
 * RequestInfo the real Cache accepts - a Request here would be a bug worth
 * failing on, not something to stringify.
 */
class FakeCache {
  readonly store = new Map<string, Blob>();

  match(url: string) {
    const body = this.store.get(url);
    return Promise.resolve(body ? new Response(body) : undefined);
  }

  async put(url: string, response: Response) {
    this.store.set(url, await response.blob());
  }

  delete(url: string) {
    return Promise.resolve(this.store.delete(url));
  }
}

let cache: FakeCache;

beforeEach(() => {
  localStorage.clear();
  cache = new FakeCache();
  vi.stubGlobal("caches", { open: () => Promise.resolve(cache) });
  // A thousand bytes per ayah, so the recorded size is predictable. jsdom
  // does not round-trip a Uint8Array body through Response.blob().
  vi.stubGlobal("fetch", () =>
    Promise.resolve(
      new Response("x".repeat(1000), {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      }),
    ),
  );
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: () => "blob:fake",
    revokeObjectURL: () => undefined,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("surah audio urls", () => {
  it("names one file per ayah of the surah", () => {
    expect(ayahCount(1)).toBe(7);
    expect(surahAudioUrls(reciter, 1)).toHaveLength(7);
  });

  it("pads the numbers the way everyayah publishes them", () => {
    expect(surahAudioUrls(reciter, 1)[0]).toBe(
      "https://everyayah.com/data/Husary_128kbps/001001.mp3",
    );
    expect(surahAudioUrls(reciter, 2).at(-1)).toBe(
      "https://everyayah.com/data/Husary_128kbps/002286.mp3",
    );
  });

  it("estimates a surah from its ayah count", () => {
    expect(estimateSurahBytes(1)).toBeGreaterThan(0);
    expect(estimateSurahBytes(2)).toBeGreaterThan(estimateSurahBytes(1));
  });
});

describe("downloading", () => {
  it("stores one file per ayah and records what it cost", async () => {
    const entry = await downloadSurah(reciter, 1);

    expect(cache.store.size).toBe(7);
    expect(entry).toMatchObject({ surah: 1, files: 7, bytes: 7000 });
    expect(getDownload(reciter.id, 1)).toMatchObject({ files: 7 });
    expect(downloadedBytes(reciter.id)).toBe(7000);
  });

  it("reports progress as it goes", async () => {
    const seen: number[] = [];
    await downloadSurah(reciter, 1, {
      onProgress: ({ done, total }) => {
        expect(total).toBe(7);
        seen.push(done);
      },
    });
    expect(seen.at(0)).toBe(0);
    expect(seen.at(-1)).toBe(7);
  });

  /*
   * A cancelled or failed run leaves what it already fetched in place, so
   * resuming a 286-ayah surah does not start from nothing.
   */
  it("does not fetch again what is already stored", async () => {
    await downloadSurah(reciter, 1);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const entry = await downloadSurah(reciter, 1);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(entry.files).toBe(7);
  });

  it("gives up on a refused file rather than recording a short surah", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response(null, { status: 404 })),
    );

    await expect(downloadSurah(reciter, 1)).rejects.toThrow("404");
    expect(getDownload(reciter.id, 1)).toBeNull();
  });

  it("stops when the signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      downloadSurah(reciter, 1, { signal: controller.signal }),
    ).rejects.toThrow();
    expect(getDownload(reciter.id, 1)).toBeNull();
  });
});

describe("deleting", () => {
  it("removes the files and forgets the surah", async () => {
    await downloadSurah(reciter, 1);
    await deleteSurah(reciter, 1);

    expect(cache.store.size).toBe(0);
    expect(getDownload(reciter.id, 1)).toBeNull();
    expect(listDownloads()).toEqual([]);
  });
});

describe("playing back what was downloaded", () => {
  it("offers a url for a stored ayah", async () => {
    await downloadSurah(reciter, 1);
    const url = surahAudioUrls(reciter, 1)[0]!;

    await expect(cachedAudioUrl(url)).resolves.toBe("blob:fake");
  });

  it("says nothing for an ayah that was never downloaded", async () => {
    await expect(
      cachedAudioUrl(surahAudioUrls(reciter, 2)[0]!),
    ).resolves.toBeNull();
  });
});
