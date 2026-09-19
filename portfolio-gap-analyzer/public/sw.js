/*
 * Gapline service worker.
 *
 * The app is a good offline candidate almost by accident: the analysis engine
 * and the security master are both in the JavaScript bundle, and holdings live
 * in localStorage. Once the shell is cached there is nothing left to fetch, so
 * a full gap report can be produced with no network at all.
 *
 * Strategy, by request kind:
 *   navigations      network first, falling back to cache, then to "/"
 *   /_next/static/*  cache first — those filenames are content-hashed
 *   everything else  stale while revalidate
 *
 * Known limit: if a deploy happens while a user is offline, their cached HTML
 * may reference chunks that were never cached. They get a broken page until
 * they are online again, at which point the network-first navigation fetches
 * fresh HTML. Precaching every chunk to close that gap is not worth the size.
 */

const VERSION = "v1";
const CACHE = `gapline-${VERSION}`;

/** The routes that make up the core flow, precached so a cold start works offline. */
const CORE_ROUTES = ["/", "/reference", "/portfolio", "/analysis", "/research", "/learn"];
const CORE_ASSETS = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Added one at a time: addAll rejects the whole install if any single
      // request fails, and one missing icon should not cost offline support.
      await Promise.all(
        [...CORE_ROUTES, ...CORE_ASSETS].map(async (url) => {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response.ok) await cache.put(url, response);
          } catch {
            /* offline at install time, or the route moved; skip it */
          }
        }),
      );
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("gapline-") && name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

/**
 * Cache a list of URLs the page reports having loaded.
 *
 * The first visit cannot be controlled by the service worker — it registers
 * after that page has already fetched its scripts — so precaching the routes
 * alone leaves their hashed chunks uncached, and an offline cold start renders
 * a blank page. Rather than duplicating the build's asset manifest here, the
 * page tells the worker what it actually loaded and the worker stores it. That
 * stays correct across builds with no build step to keep in sync.
 */
async function warmCache(urls) {
  const cache = await caches.open(CACHE);
  await Promise.all(
    urls.map(async (url) => {
      try {
        if (await cache.match(url)) return;
        const response = await fetch(url, { cache: "force-cache" });
        if (isCacheable(response)) await cache.put(url, response);
      } catch {
        /* nothing to do: the asset stays uncached and is fetched normally */
      }
    }),
  );
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "warm" || !Array.isArray(data.urls)) return;
  const sameOrigin = data.urls.filter((url) => {
    try {
      return new URL(url, self.location.origin).origin === self.location.origin;
    } catch {
      return false;
    }
  });
  event.waitUntil(warmCache(sameOrigin));
});

function isCacheable(response) {
  return response && response.status === 200 && response.type === "basic";
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? (await cache.match("/")) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const response = await fetch(request);
    if (isCacheable(response)) cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (isCacheable(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return hit ?? (await network) ?? Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});
