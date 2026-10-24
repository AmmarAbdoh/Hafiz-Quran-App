/**
 * The response for one of the speech model's files, refusing anything else.
 *
 * A host that does not have the file answers through the SPA rewrite with
 * index.html and a 200, so `ok` alone proves nothing. Parsed as JSON or ONNX,
 * that page fails with a message about a stray `<` - no help to anyone trying
 * to work out that the model was never deployed.
 */
export function modelFileResponse(response: Response, name: string): Response {
  if (!response.ok) throw new Error(`${name} ${response.status}`);
  if (response.headers.get("content-type")?.includes("text/html")) {
    throw new Error(`${name} is not hosted at ${response.url}`);
  }
  return response;
}

/** How to fetch a model file: past the browser's copy, when asked to. */
export function modelFileRequest(reload: boolean): RequestInit {
  return { cache: reload ? "reload" : "default" };
}

/**
 * The body, reporting how much of it has arrived.
 *
 * The weights are about 72MB, and fetching them with `arrayBuffer()` reports
 * nothing until the whole file is there - so the practice bar sat at ٠٪ for
 * the entire download and then jumped straight to listening, which on a slow
 * connection is indistinguishable from being stuck.
 *
 * `onProgress` is only called when the host said how big the file is. Without
 * `Content-Length` there is no denominator and a made-up one would be worse
 * than an honest nothing, so the bar keeps whatever it had.
 */
export async function modelFileBytes(
  response: Response,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  const total = Number.isFinite(declared) && declared > 0 ? declared : 0;
  const body = response.body;
  if (!body || !total || !onProgress) {
    return new Uint8Array(await response.arrayBuffer());
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(Math.min(1, received / total));
  }

  const bytes = new Uint8Array(received);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}
