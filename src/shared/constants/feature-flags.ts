/**
 * Local speech-to-text تسميع (Whisper in browser).
 * Off by default until a faster, more accurate pipeline is ready.
 *
 * Re-enable for development: add to `.env.local`:
 *   VITE_ENABLE_RECITATION_PRACTICE=true
 */
export const RECITATION_PRACTICE_ENABLED =
  import.meta.env.VITE_ENABLE_RECITATION_PRACTICE === "true";
