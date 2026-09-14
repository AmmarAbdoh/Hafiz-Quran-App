import { quranRepository } from "@/domain/quran/data";

/*
 * Warms the route chunks and the Quran dataset once the app is idle.
 *
 * Route components are lazily imported and the reader needs a 2 MB core
 * dataset, so a cold navigation shows a loading state for a moment. Fetching
 * both ahead of time turns later navigation into a synchronous render, because
 * the module registry and the repository both return what is already in memory.
 *
 * The home page always links to the first page, so its layout is worth warming
 * as well.
 */

const READER_START_PAGE = 1;
const IDLE_TIMEOUT_MS = 3000;
const IDLE_FALLBACK_DELAY_MS = 1500;

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

// Respect data saver and very slow connections: on those, a background
// download of the dataset costs the reader more than the loading state does.
function prefetchAllowed(): boolean {
  const connection = (
    navigator as Navigator & { connection?: NetworkInformation }
  ).connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return (
    connection.effectiveType !== "slow-2g" && connection.effectiveType !== "2g"
  );
}

function whenIdle(run: () => void) {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    return;
  }
  setTimeout(run, IDLE_FALLBACK_DELAY_MS);
}

function prefetchRouteChunks() {
  void Promise.all([
    import("@/features/home"),
    import("@/features/quran-reader/QuranReaderRoute"),
    import("@/features/quran-reader/QuranReaderPage"),
    import("@/features/quiz"),
    import("@/features/settings"),
  ]).catch(() => undefined);
}

function prefetchQuranData() {
  void quranRepository
    .loadCoreData()
    .then(() => quranRepository.loadPageLayout(READER_START_PAGE))
    .catch(() => undefined);
}

export function prefetchAfterFirstPaint() {
  if (!prefetchAllowed()) return;

  // Chunks first: they are far smaller than the dataset and unblock every route.
  whenIdle(() => {
    prefetchRouteChunks();
    whenIdle(prefetchQuranData);
  });
}
