import { gzipSync, strToU8 } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeCompressedJson, decompressGzip } from "./decompress";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("decompressGzip", () => {
  it("returns non-gzip bytes without copying or invoking a fallback", async () => {
    const bytes = strToU8("plain text");
    const fallback = vi.fn();

    await expect(decompressGzip(bytes, fallback)).resolves.toBe(bytes);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("uses native streaming decompression when the platform supports it", async () => {
    expect(typeof globalThis.DecompressionStream).toBe("function");
    expect(typeof globalThis.Blob).toBe("function");
    const compressed = gzipSync(strToU8("streamed text"));
    const fallback = vi.fn().mockRejectedValue(new Error("fallback used"));

    const result = await decompressGzip(compressed, fallback);

    expect(new TextDecoder().decode(result)).toBe("streamed text");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("falls back when an exposed streaming implementation rejects gzip", async () => {
    vi.stubGlobal(
      "DecompressionStream",
      class UnsupportedDecompressionStream {
        constructor() {
          throw new Error("gzip unsupported");
        }
      },
    );
    const compressed = gzipSync(strToU8("fallback text"));
    const fallback = vi.fn().mockResolvedValue(strToU8("fallback text"));

    await expect(decompressGzip(compressed, fallback)).resolves.toEqual(
      strToU8("fallback text"),
    );
    expect(fallback).toHaveBeenCalledOnce();
    expect(fallback).toHaveBeenCalledWith(compressed);
  });

  it("falls back when Blob streaming is unavailable", async () => {
    vi.stubGlobal("Blob", undefined);
    const compressed = gzipSync(strToU8("fallback text"));
    const fallback = vi.fn().mockResolvedValue(strToU8("fallback text"));

    await expect(decompressGzip(compressed, fallback)).resolves.toEqual(
      strToU8("fallback text"),
    );
  });
});

describe("decodeCompressedJson", () => {
  it("decodes a compressed JSON value", async () => {
    const compressed = gzipSync(strToU8(JSON.stringify({ verses: 6236 })));
    await expect(
      decodeCompressedJson<{ verses: number }>(compressed),
    ).resolves.toEqual({ verses: 6236 });
  });

  it("rejects malformed JSON after decompression", async () => {
    await expect(
      decodeCompressedJson(strToU8("not json")),
    ).rejects.toBeInstanceOf(SyntaxError);
  });
});
