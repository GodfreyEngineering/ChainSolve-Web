/**
 * CORS + rate-limit middleware for all /api/* routes.
 *
 * Allowed origins are hardcoded to production + local dev.
 * Stripe webhook requests (server-to-server, no Origin header) pass through
 * without CORS headers — this is correct because CORS is a browser mechanism.
 *
 * Rate limiting uses a per-isolate in-memory sliding window.
 * Health/readyz and Stripe webhook endpoints are exempt.
 *
 * To add staging: append to ALLOWED_ORIGINS or read from env.
 */

import { checkRateLimit } from './_rateLimit'

// Additional origins can be injected at deploy-time via ALLOWED_ORIGINS_EXTRA
// (comma-separated list in the Cloudflare Pages environment variable), e.g.
// "https://staging.app.chainsolve.co.uk" for a staging environment.
declare const ALLOWED_ORIGINS_EXTRA: string | undefined
const extraOrigins: string[] =
  typeof ALLOWED_ORIGINS_EXTRA === 'string' && ALLOWED_ORIGINS_EXTRA.trim()
    ? ALLOWED_ORIGINS_EXTRA.split(',').map((s) => s.trim()).filter(Boolean)
    : []

const ALLOWED_ORIGINS: readonly string[] = [
  'https://app.chainsolve.co.uk',
  ...extraOrigins,
  'http://localhost:5173', // Vite dev server
]

function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

export const onRequest: PagesFunction = async (context) => {
  const origin = context.request.headers.get('Origin')
  const isAllowed = origin !== null && ALLOWED_ORIGINS.includes(origin)

  // ── Preflight ─────────────────────────────────────────────────────────────
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...(isAllowed ? corsHeaders(origin) : {}),
        Vary: 'Origin',
      },
    })
  }

  // ── Rate limiting (per-IP sliding window) ───────────────────────────────
  const ip =
    context.request.headers.get('CF-Connecting-IP') ??
    context.request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  const url = new URL(context.request.url)
  const rateLimitResponse = checkRateLimit(ip, url.pathname)
  if (rateLimitResponse) {
    // Add CORS headers to 429 responses so the browser can read the error
    if (isAllowed) {
      for (const [k, v] of Object.entries(corsHeaders(origin))) {
        rateLimitResponse.headers.set(k, v)
      }
    }
    return rateLimitResponse
  }

  // ── Normal request ────────────────────────────────────────────────────────
  const response = await context.next()

  // Clone to get mutable headers (response from next() may be immutable)
  const res = new Response(response.body, response)
  res.headers.set('Vary', 'Origin')

  if (isAllowed) {
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      res.headers.set(k, v)
    }
  }

  return res
}
