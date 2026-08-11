import { afterEach, describe, expect, it, vi } from "vitest";
import { clearWhisperModelCache } from "./clearWhisperModelCache";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clearWhisperModelCache", () => {
  it("does nothing when the Cache API is unavailable", async () => {
    vi.stubGlobal("window", {});

    await expect(clearWhisperModelCache()).resolves.toBeUndefined();
  });

  it("deletes only model-related caches", async () => {
    const cacheStorage = {
      keys: vi
        .fn()
        .mockResolvedValue([
          "app-shell",
          "huggingface-models",
          "transformers-cache",
          "onnx-runtime",
        ]),
      delete: vi.fn().mockResolvedValue(true),
    };
    vi.stubGlobal("window", { caches: cacheStorage });
    vi.stubGlobal("caches", cacheStorage);

    await clearWhisperModelCache();

    expect(cacheStorage.delete).toHaveBeenCalledTimes(3);
    expect(cacheStorage.delete).toHaveBeenNthCalledWith(
      1,
      "huggingface-models",
    );
    expect(cacheStorage.delete).toHaveBeenNthCalledWith(
      2,
      "transformers-cache",
    );
    expect(cacheStorage.delete).toHaveBeenNthCalledWith(3, "onnx-runtime");
    expect(cacheStorage.delete).not.toHaveBeenCalledWith("app-shell");
  });

  it("waits for deletion and propagates Cache API failures", async () => {
    const failure = new Error("cache storage blocked");
    const cacheStorage = {
      keys: vi.fn().mockRejectedValue(failure),
      delete: vi.fn(),
    };
    vi.stubGlobal("window", { caches: cacheStorage });
    vi.stubGlobal("caches", cacheStorage);

    await expect(clearWhisperModelCache()).rejects.toBe(failure);
    expect(cacheStorage.delete).not.toHaveBeenCalled();
  });
});
