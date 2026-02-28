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

export type Plan = 'free' | 'trialing' | 'pro' | 'enterprise' | 'past_due' | 'canceled'

/**
 * Map a Stripe subscription status string to the app's plan enum.
 * Returns 'pro' for active subscriptions; callers should use
 * `resolveEnterprise()` to upgrade to 'enterprise' when the subscription
 * metadata or price ID indicates an enterprise product.
 */
export function mapStatusToPlan(status: string): Plan {
  if (status === 'trialing') return 'trialing'
  if (status === 'active') return 'pro'
  if (status === 'past_due' || status === 'unpaid') return 'past_due'
  if (status === 'canceled' || status === 'incomplete_expired') return 'canceled'
  return 'free'
}

/**
 * If the subscription's metadata or price ID indicates an enterprise plan,
 * upgrade the plan from 'pro' to 'enterprise'.
 *
 * Detection order:
 *   1. `metadata.plan_tier === 'enterprise'` (set at checkout creation)
 *   2. Price ID matches one of the known enterprise price IDs
 */
export function resolveEnterprise(
  basePlan: Plan,
  metadata: Record<string, string> | null | undefined,
  priceId: string | null | undefined,
  enterprisePriceIds: string[],
): Plan {
  // Only upgrade active ('pro') or 'trialing' plans to enterprise
  if (basePlan !== 'pro' && basePlan !== 'trialing') return basePlan
  if (metadata?.plan_tier === 'enterprise') return 'enterprise'
  if (priceId && enterprisePriceIds.includes(priceId)) return 'enterprise'
  return basePlan
}
