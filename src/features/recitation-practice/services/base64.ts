/** Base64 of raw bytes, for audio sent or saved as JSON. */
export function toBase64(bytes: Uint8Array): string {
  /* In chunks: `String.fromCharCode(...bytes)` on a minute of audio is a
     million arguments and overflows the call stack. */
  let binary = "";
  const step = 0x8000;
  for (let at = 0; at < bytes.length; at += step) {
    binary += String.fromCharCode(...bytes.subarray(at, at + step));
  }
  return btoa(binary);
}
