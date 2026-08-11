export type GzipFallback = (compressed: Uint8Array) => Promise<Uint8Array>;

function isGzip(compressed: Uint8Array): boolean {
  return compressed[0] === 0x1f && compressed[1] === 0x8b;
}

async function decompressWithFflate(
  compressed: Uint8Array,
): Promise<Uint8Array> {
  const { gunzipSync } = await import("fflate");
  return gunzipSync(compressed);
}

async function decompressWithBrowserStream(
  compressed: Uint8Array,
): Promise<Uint8Array> {
  const ownedBytes = new Uint8Array(compressed.byteLength);
  ownedBytes.set(compressed);
  const stream = new Blob([ownedBytes.buffer])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function decompressGzip(
  compressed: Uint8Array,
  fallback: GzipFallback = decompressWithFflate,
): Promise<Uint8Array> {
  if (!isGzip(compressed)) return compressed;

  if (
    typeof globalThis.DecompressionStream === "function" &&
    typeof globalThis.Blob === "function"
  ) {
    try {
      return await decompressWithBrowserStream(compressed);
    } catch {
      // Some evergreen WebViews expose the API without supporting gzip.
    }
  }

  return fallback(compressed);
}

export async function decodeCompressedJson<T>(
  compressed: Uint8Array,
  fallback?: GzipFallback,
): Promise<T> {
  const bytes = await decompressGzip(compressed, fallback);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
