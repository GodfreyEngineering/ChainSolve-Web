/**
 * Shared response helpers for Stripe Cloud Function handlers.
 *
 * Error envelope  — { ok: false, error: string }  HTTP 4xx / 5xx
 * Success envelope — { ok: true, ...data }          HTTP 2xx
 *
 * Stack traces are NEVER included in any response body.  Callers must pass
 * only err.message (never err.stack) to jsonError, and log the full Error
 * object server-side via console.error before calling this helper.
 */

export function jsonError(message: string, status: number): Response {
  return Response.json({ ok: false, error: message }, { status })
}

// ── Webhook helpers ───────────────────────────────────────────────────────────

export type Plan = 'free' | 'trialing' | 'pro' | 'past_due' | 'canceled'

/**
 * Map a Stripe subscription status string to the app's plan enum.
 * Extracted so it can be unit-tested independently of the Worker runtime.
 */
export function mapStatusToPlan(status: string): Plan {
  if (status === 'trialing') return 'trialing'
  if (status === 'active') return 'pro'
  if (status === 'past_due' || status === 'unpaid') return 'past_due'
  if (status === 'canceled' || status === 'incomplete_expired') return 'canceled'
  return 'free'
}
