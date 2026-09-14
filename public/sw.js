/*
 * Offline support for the reader.
 *
 * Build output is content hashed, so cached asset entries are never stale and
 * the caches are not versioned or purged on deploy. That keeps the chunks of a
 * running session available after a new deploy, which matters because the
 * routes are lazily imported. Growth is bounded by trimming each cache instead.
 *
 * Recitation audio is deliberately not cached: it is large, streamed with range
 * requests, and served by third parties.
 */

const SHELL_CACHE = "artqiy-shell";
const ASSET_CACHE = "artqiy-assets";
const DATA_CACHE = "artqiy-quran-data";

const ASSET_CACHE_LIMIT = 160;
const DATA_CACHE_LIMIT = 320;

const QURAN_FONT_ORIGIN = "https://verses.quran.foundation";

// Static files that the build manifest does not describe. The UI fonts are not
// listed here: they ship through the bundled stylesheet, so the manifest walk
// below already names them under their content hashed paths.
const STATIC_ASSETS = ["/icons/icon.svg", "/manifest.webmanifest"];

/*
 * Chunk names are content hashed, so they cannot be listed here. The build
 * manifest names every script and stylesheet, including the lazily imported
 * route chunks, so precaching from it means one visit is enough to use the app
 * offline rather than needing each route to have been opened first.
 */
async function precacheShell() {
  const shellResponse = await fetch("/", { cache: "reload" });
  if (!shellResponse.ok) return;

  const shell = await caches.open(SHELL_CACHE);
  await shell.put("/", shellResponse.clone());

  const urls = new Set(STATIC_ASSETS);

  const manifestResponse = await fetch("/asset-manifest.json").catch(
    () => undefined,
  );
  if (manifestResponse?.ok) {
    const manifest = await manifestResponse.json();
    for (const entry of Object.values(manifest)) {
      for (const file of [entry.file, ...(entry.css ?? [])]) {
        // The large fallback .ttf is left to on demand caching; the UI woff2
        // subsets are small and needed for correct typography offline.
        if (typeof file === "string" && /\.(?:js|css|woff2)$/.test(file)) {
          urls.add(`/${file}`);
        }
      }
    }
  }

  const assets = await caches.open(ASSET_CACHE);
  await Promise.all(
    [...urls].map(async (url) => {
      const asset = await fetch(url).catch(() => undefined);
      if (asset?.ok) await assets.put(url, asset.clone());
    }),
  );
}

self.addEventListener("install", (event) => {
  // Take over straight away. Cached entries are content hashed and never
  // purged, so the chunks a running tab already holds stay available.
  self.skipWaiting();
  event.waitUntil(precacheShell().catch(() => undefined));
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE, DATA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => !keep.has(name))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(
    keys.slice(0, keys.length - limit).map((key) => cache.delete(key)),
  );
}

/*
 * Entries are keyed by content hashed URLs, so the URL alone identifies them.
 * Vary must be ignored because hosts commonly send `Vary: Origin` while Vite
 * marks its scripts and stylesheets `crossorigin`: those requests carry an
 * Origin header that the worker's own precache fetches do not, which would
 * otherwise turn every precached entry into a miss.
 */
const MATCH_OPTIONS = { ignoreVary: true };

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, MATCH_OPTIONS);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    void trimCache(cacheName, limit);
  }
  return response;
}

/*
 * Answers from the cache straight away and refreshes in the background. The
 * data manifest is nearly half a megabyte and sits ahead of every Quran request,
 * so waiting on the network for it would delay the reader on each visit. A
 * manifest one deploy behind is harmless because the asset paths it names stay
 * available.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, MATCH_OPTIONS);

  const update = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  });

  if (cached) {
    void update.catch(() => undefined);
    return cached;
  }
  return update;
}

// Any in-app route resolves to the SPA entry, so a single cached shell serves
// every offline navigation.
async function navigationHandler(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put("/", response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match("/", MATCH_OPTIONS);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }

  if (!isSameOrigin) {
    // Mushaf glyph fonts are versioned and CORS enabled; audio hosts are not
    // handled at all so playback keeps streaming straight from the network.
    if (url.origin === QURAN_FONT_ORIGIN) {
      event.respondWith(cacheFirst(request, ASSET_CACHE, ASSET_CACHE_LIMIT));
    }
    return;
  }

  if (url.pathname === "/data/quran/manifest.json") {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  if (url.pathname.startsWith("/data/quran/")) {
    event.respondWith(cacheFirst(request, DATA_CACHE, DATA_CACHE_LIMIT));
    return;
  }

  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/")
  ) {
    event.respondWith(cacheFirst(request, ASSET_CACHE, ASSET_CACHE_LIMIT));
  }
});
