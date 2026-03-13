/**
 * _rateLimit.ts — Per-IP sliding window rate limiter for Cloudflare Pages Functions.
 *
 * Uses an in-memory Map that persists for the lifetime of the Worker isolate.
 * This provides effective burst protection. For globally consistent rate
 * limiting, consider Cloudflare WAF rate limiting rules in the dashboard.
 *
 * Each route group has its own limit (requests per window). When exceeded,
 * the middleware returns 429 with a Retry-After header.
 */

/** Rate limit configuration for a route group. */
interface RateLimitConfig {
  /** Maximum requests allowed within the window. */
  max: number
  /** Window duration in seconds. */
  windowSec: number
}

/** Route-specific rate limits. Matched by prefix (first match wins). */
const ROUTE_LIMITS: readonly [prefix: string, config: RateLimitConfig][] = [
  // Stripe webhooks are server-to-server with Stripe retry logic — exempt
  // (handled by the EXEMPT_PREFIXES check below)

  // Student verification — very restrictive (brute-force target)
  ['/api/student/', { max: 5, windowSec: 3600 }],

  // Account deletion — 1 per hour per IP
  ['/api/account/delete', { max: 2, windowSec: 3600 }],

  // AI endpoint — moderate limit
  ['/api/ai', { max: 30, windowSec: 60 }],

  // Stripe billing endpoints (checkout, portal, etc.)
  ['/api/stripe/', { max: 10, windowSec: 60 }],

  // Admin endpoints
  ['/api/admin/', { max: 20, windowSec: 60 }],

  // Observability/report endpoints — higher limit (frequent telemetry)
  ['/api/observability/', { max: 60, windowSec: 60 }],
  ['/api/report/', { max: 30, windowSec: 60 }],

  // Default for all other /api/* routes
  ['/api/', { max: 30, windowSec: 60 }],
]

/** Prefixes exempt from rate limiting (server-to-server, health checks). */
const EXEMPT_PREFIXES: readonly string[] = [
  '/api/stripe/webhook',
  '/api/health',
  '/api/healthz',
  '/api/readyz',
]

/** Sliding window entry: timestamps of recent requests. */
interface WindowEntry {
  timestamps: number[]
}

/**
 * In-memory rate limit store. Keyed by `${ip}:${routeGroup}`.
 * Persists for the lifetime of the Worker isolate (typically minutes).
 */
const store = new Map<string, WindowEntry>()

/** Periodic cleanup counter — run every N checks. */
let checkCount = 0
const CLEANUP_INTERVAL = 500

/** Remove expired entries to prevent unbounded memory growth. */
function cleanup(): void {
  const now = Date.now()
  for (const [key, entry] of store) {
    // Remove entries where all timestamps are expired (oldest possible window: 1 hour)
    if (
      entry.timestamps.length === 0 ||
      entry.timestamps[entry.timestamps.length - 1] < now - 3_600_000
    ) {
      store.delete(key)
    }
  }
}

/**
 * Check rate limit for a request. Returns null if allowed, or a 429 Response
 * if the limit is exceeded.
 *
 * @param ip     Client IP address (from CF-Connecting-IP or request.cf)
 * @param path   Request URL pathname (e.g. /api/ai)
 */
export function checkRateLimit(ip: string, path: string): Response | null {
  // Exempt routes
  for (const prefix of EXEMPT_PREFIXES) {
    if (path.startsWith(prefix)) return null
  }

  // Find matching route config
  let config: RateLimitConfig = { max: 30, windowSec: 60 }
  let routeGroup = '/api/'
  for (const [prefix, cfg] of ROUTE_LIMITS) {
    if (path.startsWith(prefix)) {
      config = cfg
      routeGroup = prefix
      break
    }
  }

  const key = `${ip}:${routeGroup}`
  const now = Date.now()
  const windowMs = config.windowSec * 1000

  // Get or create entry
  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Slide the window: remove timestamps outside the window
  const cutoff = now - windowMs
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

  // Check limit
  if (entry.timestamps.length >= config.max) {
    // Calculate when the oldest request in the window will expire
    const retryAfter = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000)
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Too many requests. Please try again later.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.max(retryAfter, 1)),
        },
      },
    )
  }

  // Record this request
  entry.timestamps.push(now)

  // Periodic cleanup
  checkCount++
  if (checkCount >= CLEANUP_INTERVAL) {
    checkCount = 0
    cleanup()
  }

  return null
}
