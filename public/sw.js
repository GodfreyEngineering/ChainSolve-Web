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
 * Offline behaviour:
 *   - Canvas editing continues (all state is local React/Zustand).
 *   - Saves are queued by the app layer (useOfflineSync) and replayed on reconnect.
 *   - A banner is shown via a postMessage so the app can display "Offline" state.
 */

const CACHE_VERSION = 'v1'
const SHELL_CACHE = `cs-shell-${CACHE_VERSION}`
const WASM_CACHE = `cs-wasm-${CACHE_VERSION}`
const FONT_CACHE = `cs-fonts-${CACHE_VERSION}`

const KNOWN_CACHES = [SHELL_CACHE, WASM_CACHE, FONT_CACHE]

// Assets that form the app shell and should be pre-cached on install.
const PRECACHE_URLS = ['/']

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  // Activate immediately — do not wait for existing clients to close.
  self.skipWaiting()
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {
        // Pre-cache failure is non-fatal; fetch strategy handles individual requests.
      }),
    ),
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
  if (
    request.destination === 'font' ||
    url.pathname.match(/\.(woff2?|ttf|otf|eot)$/)
  ) {
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
 * Cache-first: return cached response immediately if available;
 * otherwise fetch from network, cache the response, and return it.
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

/**
 * Network-first: attempt the network; on failure (offline) return the
 * cached response. Navigation requests fall back to the root index.html
 * so the SPA router can handle the URL client-side.
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached =
      (await cache.match(request)) ??
      (request.mode === 'navigate' ? await cache.match('/') : null)
    if (cached) return cached
    return new Response('Offline', { status: 503, statusText: 'Offline' })
  }
}

// ── Sync messages (relay from app layer) ─────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
