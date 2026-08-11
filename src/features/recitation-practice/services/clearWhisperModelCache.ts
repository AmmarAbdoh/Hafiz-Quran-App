/** Clear Hugging Face model caches used by Transformers.js in the browser. */
export async function clearWhisperModelCache(): Promise<void> {
  if (!("caches" in window)) return;

  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter(
        (key) =>
          key.includes("huggingface") ||
          key.includes("transformers") ||
          key.includes("onnx"),
      )
      .map((key) => caches.delete(key)),
  );
}
