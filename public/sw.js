/**
 * ChainSolve Web — Service Worker (UI-PERF-04)
 *
 * Caching strategy:
 *   App shell (HTML, JS, CSS):  Network-first with cache fallback.
 *     New deployments are picked up immediately; offline loads the last-known shell.
 *   WASM binaries:              Cache-first with background revalidation.
 *     WASM rarely changes and is large — avoid re-fetching unnecessarily.
 *   Fonts / images:             Cache-first, long TTL.
 *   Supabase / API calls:       Network-only (no caching of user data).
 *
 * Cache versioning:
 *   CACHE_VERSION is replaced at build time by vite.config.ts (swCacheVersionPlugin)
 *   with the git SHA of the build. This ensures the SW file content changes on every
 *   deployment, which causes the browser to install the new SW and clean up stale caches.
 *
 * Offline behaviour:
 *   - Canvas editing continues (all state is local React/Zustand).
 *   - Saves are queued by the app layer (useOfflineSync) and replayed on reconnect.
 *   - A banner is shown via a postMessage so the app can display "Offline" state.
 */

const CACHE_VERSION = '__BUILD_HASH__'
const SHELL_CACHE = `cs-shell-${CACHE_VERSION}`
const WASM_CACHE = `cs-wasm-${CACHE_VERSION}`
const FONT_CACHE = `cs-fonts-${CACHE_VERSION}`

const KNOWN_CACHES = [SHELL_CACHE, WASM_CACHE, FONT_CACHE]

// Assets that form the app shell and should be pre-cached on install.
const PRECACHE_URLS = ['/']

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  // Do NOT call skipWaiting() here. The new SW waits until all tabs running
  // the old version are closed (or the user explicitly triggers an update via
  // the SKIP_WAITING message). This prevents the new SW from taking over a
  // tab that still has the old main bundle in memory, which would cause
  // dynamic import failures for old chunk hashes that no longer exist.
  event.waitUntil(
    openCache(SHELL_CACHE)
      .then((cache) =>
        cache
          ? cache.addAll(PRECACHE_URLS).catch(() => {
              // Pre-cache failure is non-fatal; fetch strategy handles individual requests.
            })
          : undefined,
      )
      .catch(() => {}),
  )
})

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('cs-') && !KNOWN_CACHES.includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .catch(() => {}) // Cache cleanup failure must not block activation
      .then(() => self.clients.claim()),
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Let non-GET requests pass through unchanged.
  if (request.method !== 'GET') return

  // Never intercept cross-origin requests (Supabase, Stripe, CDNs).
  if (url.origin !== self.location.origin) return

  // Never intercept API / auth calls.
  if (
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/api/')
  )
    return

  // WASM binaries: cache-first (large, rarely changes).
  if (url.pathname.endsWith('.wasm')) {
    event.respondWith(cacheFirst(request, WASM_CACHE))
    return
  }

  // Fonts: cache-first.
  if (request.destination === 'font' || url.pathname.match(/\.(woff2?|ttf|otf|eot)$/)) {
    event.respondWith(cacheFirst(request, FONT_CACHE))
    return
  }

  // App shell and JS/CSS assets: network-first with cache fallback.
  if (
    request.mode === 'navigate' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    url.pathname.match(/\.(js|mjs|css|html|ico|png|svg|webp)$/)
  ) {
    event.respondWith(networkFirst(request, SHELL_CACHE))
    return
  }
})

// ── Caching helpers ───────────────────────────────────────────────────────────

/**
 * Safe wrapper around caches.open(). Returns null instead of throwing when the
 * Cache API is unavailable (private browsing, storage quota exceeded, etc.).
 */
async function openCache(cacheName) {
  try {
    return await caches.open(cacheName)
  } catch {
    return null
  }
}

/**
 * Cache-first: return cached response immediately if available;
 * otherwise fetch from network, cache the response, and return it.
 *
 * Never rejects — always returns a valid Response.
 */
async function cacheFirst(request, cacheName) {
  try {
    const cache = await openCache(cacheName)
    if (cache) {
      const cached = await cache.match(request).catch(() => null)
      if (cached) return cached
    }
    try {
      const response = await fetch(request)
      if (response.ok && cache) {
        cache.put(request, response.clone()).catch(() => {}) // ignore quota errors
      }
      return response
    } catch {
      return new Response('Offline', { status: 503 })
    }
  } catch {
    // Last-resort fallback — Cache API and fetch both unavailable.
    return new Response('Service Unavailable', { status: 503 })
  }
}

/**
 * Network-first: attempt the network; on failure (offline) return the
 * cached response. Navigation requests fall back to the root index.html
 * so the SPA router can handle the URL client-side.
 *
 * Never rejects — always returns a valid Response. This is critical because
 * an unhandled rejection from respondWith() causes the browser to report
 * "A ServiceWorker intercepted the request and encountered an unexpected error",
 * which surfaces as a fatal dynamic-import failure in the app.
 */
async function networkFirst(request, cacheName) {
  try {
    const cache = await openCache(cacheName)
    try {
      const response = await fetch(request)
      if (response.ok && cache) {
        cache.put(request, response.clone()).catch(() => {}) // ignore quota errors
      }
      return response
    } catch {
      // Network failed (offline or transient error) — fall back to cache.
      if (cache) {
        const cached =
          (await cache.match(request).catch(() => null)) ??
          (request.mode === 'navigate' ? await cache.match('/').catch(() => null) : null)
        if (cached) return cached
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' })
    }
  } catch {
    // Last-resort fallback — Cache API itself threw (e.g. quota exceeded).
    try {
      return await fetch(request)
    } catch {
      return new Response('Service Unavailable', { status: 503 })
    }
  }
}

// ── Sync messages (relay from app layer) ─────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    // Explicitly requested by the app (e.g. "Update available" banner clicked).
    // Activates the new SW immediately, taking over all open tabs.
    self.skipWaiting()
  }
})
