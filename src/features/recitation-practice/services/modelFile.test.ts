import { describe, expect, it, vi } from "vitest";
import { modelFileBytes, modelFileResponse } from "./modelFile";

/** A response whose body arrives in pieces, as a 72MB download does. */
function streamed(chunks: number[][], declared?: number): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
      controller.close();
    },
  });
  const length =
    declared ?? chunks.reduce((total, chunk) => total + chunk.length, 0);
  return new Response(body, {
    headers: { "content-length": String(length) },
  });
}

describe("fetching one of the speech model's files", () => {
  /*
   * A host without the file answers through the SPA rewrite with index.html
   * and a 200, so `ok` alone proves nothing: parsed as ONNX that page fails
   * with a message about a stray `<`, which tells nobody that the model was
   * never deployed.
   */
  it("refuses the SPA fallback instead of parsing it as a model", () => {
    const response = new Response("<!doctype html>", {
      headers: { "content-type": "text/html; charset=utf-8" },
    });

    expect(() => modelFileResponse(response, "model")).toThrow(
      /is not hosted at/,
    );
  });

  it("refuses a response that failed", () => {
    expect(() =>
      modelFileResponse(new Response("", { status: 404 }), "tokens"),
    ).toThrow("tokens 404");
  });

  /*
   * The weights are about 72MB. Fetched with `arrayBuffer()` nothing is known
   * until the whole file is there, so the practice bar sat at ٠٪ for the
   * entire download and then jumped to listening - on a slow connection,
   * indistinguishable from being stuck.
   */
  it("reports how much has arrived, and returns all of it", async () => {
    const onProgress = vi.fn<(fraction: number) => void>();

    const bytes = await modelFileBytes(
      streamed([
        [1, 2, 3, 4],
        [5, 6],
        [7, 8, 9, 10],
      ]),
      onProgress,
    );

    expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(onProgress.mock.calls.map(([fraction]) => fraction)).toEqual([
      0.4, 0.6, 1,
    ]);
  });

  /*
   * No `Content-Length` means no denominator, and a made-up one would be
   * worse than an honest nothing: the bar keeps whatever it had.
   */
  it("says nothing about progress when the host did not give a size", async () => {
    const onProgress = vi.fn();
    const response = new Response(new Uint8Array([1, 2, 3]));
    response.headers.delete("content-length");

    const bytes = await modelFileBytes(response, onProgress);

    expect(Array.from(bytes)).toEqual([1, 2, 3]);
    expect(onProgress).not.toHaveBeenCalled();
  });
});
