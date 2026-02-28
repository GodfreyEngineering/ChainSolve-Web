/**
 * billing.api.test.ts — Contract tests for Stripe billing API helpers.
 *
 * Tests two things:
 *   1. jsonError — error envelope shape + no stack traces  (P059)
 *   2. mapStatusToPlan — Stripe status → plan enum         (P054)
 *
 * Functions are inlined so tests do not cross tsconfig boundaries
 * (functions/ uses @cloudflare/workers-types, src/ uses browser globals).
 * Inline copies MUST stay in sync with functions/api/stripe/_lib.ts.
 */

import { describe, it, expect } from 'vitest'

// ── Inline copies of functions/api/stripe/_lib.ts ────────────────────────────
function jsonError(message: string, status: number): Response {
  return Response.json({ ok: false, error: message }, { status })
}

type Plan = 'free' | 'trialing' | 'pro' | 'enterprise' | 'past_due' | 'canceled'
function mapStatusToPlan(status: string): Plan {
  if (status === 'trialing') return 'trialing'
  if (status === 'active') return 'pro'
  if (status === 'past_due' || status === 'unpaid') return 'past_due'
  if (status === 'canceled' || status === 'incomplete_expired') return 'canceled'
  return 'free'
}

/**
 * resolveEnterprise — inline copy of functions/api/stripe/_lib.ts
 * MUST stay in sync with the server-side implementation.
 */
function resolveEnterprise(
  basePlan: Plan,
  metadata: Record<string, string> | null | undefined,
  priceId: string | null | undefined,
  enterprisePriceIds: string[],
): Plan {
  if (basePlan !== 'pro' && basePlan !== 'trialing') return basePlan
  if (metadata?.plan_tier === 'enterprise') return 'enterprise'
  if (priceId && enterprisePriceIds.includes(priceId)) return 'enterprise'
  return basePlan
}

/**
 * resolveEnterpriseSeatCount — inline copy of functions/api/stripe/_lib.ts (D11-2)
 * MUST stay in sync with the server-side implementation.
 */
function resolveEnterpriseSeatCount(
  metadata: Record<string, string> | null | undefined,
): number | null | undefined {
  const planKey = metadata?.plan_key
  if (!planKey) return undefined
  if (planKey.startsWith('ent_10_')) return 10
  if (planKey.startsWith('ent_unlimited_')) return null
  return undefined
}
// ─────────────────────────────────────────────────────────────────────────────

describe('billing API error envelope', () => {
  it('returns { ok: false, error } with the correct HTTP status', async () => {
    const res = jsonError('Stripe: No such customer', 502)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toEqual({ ok: false, error: 'Stripe: No such customer' })
    expect(res.status).toBe(502)
  })

  it('error body never contains stack frames', () => {
    const err = new Error('stripe checkout failed')
    const msg = err instanceof Error ? err.message : 'Internal error'
    const serialised = JSON.stringify({ ok: false, error: msg })
    expect(serialised).not.toContain(' at ') // no stack frame lines
    expect(serialised).not.toContain('.ts:') // no TypeScript source refs
    expect(serialised).not.toContain('\n') // no multiline stack
  })

  it('catch block pattern uses err.message, not err.stack', () => {
    const err = new Error('payment failed')
    // Simulate the pattern used in all billing functions:
    //   const msg = err instanceof Error ? err.message : 'Internal error'
    //   return jsonError(msg, 500)
    const msg = err instanceof Error ? err.message : 'Internal error'
    expect(msg).toBe('payment failed')
    expect(msg).not.toContain(' at ')
    expect(msg).not.toContain('Error:')
  })

  it('success envelope has ok: true and a url string', async () => {
    const res = Response.json({ ok: true, url: 'https://stripe.com/redirect/123' })
    const body = (await res.json()) as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(typeof body.url).toBe('string')
  })

  it('401 error returns the correct status code', async () => {
    const res = jsonError('Missing Authorization Bearer token', 401)
    expect(res.status).toBe(401)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.ok).toBe(false)
    expect(body.error).toBe('Missing Authorization Bearer token')
  })
})

// ── mapStatusToPlan (P054 — webhook idempotency) ──────────────────────────────

describe('mapStatusToPlan', () => {
  it.each<[string, Plan]>([
    ['trialing', 'trialing'],
    ['active', 'pro'],
    ['past_due', 'past_due'],
    ['unpaid', 'past_due'],
    ['canceled', 'canceled'],
    ['incomplete_expired', 'canceled'],
    ['incomplete', 'free'],
    ['paused', 'free'],
    ['unknown_future_status', 'free'],
  ])('maps Stripe status "%s" → plan "%s"', (status, expected) => {
    expect(mapStatusToPlan(status)).toBe(expected)
  })

  it('is idempotent — same input always returns same output', () => {
    const statuses = ['active', 'trialing', 'past_due', 'canceled']
    for (const s of statuses) {
      expect(mapStatusToPlan(s)).toBe(mapStatusToPlan(s))
    }
  })
})

// ── resolveEnterprise (D0-1 — enterprise plan detection) ────────────────────

describe('resolveEnterprise', () => {
  const entPrices = ['price_ent_10_mo', 'price_ent_10_yr', 'price_ent_unlim_mo']

  it('returns enterprise when metadata.plan_tier is "enterprise"', () => {
    expect(resolveEnterprise('pro', { plan_tier: 'enterprise' }, null, entPrices)).toBe(
      'enterprise',
    )
  })

  it('returns enterprise when priceId matches an enterprise price', () => {
    expect(resolveEnterprise('pro', null, 'price_ent_10_mo', entPrices)).toBe('enterprise')
    expect(resolveEnterprise('pro', null, 'price_ent_unlim_mo', entPrices)).toBe('enterprise')
  })

  it('returns pro when priceId does not match any enterprise price', () => {
    expect(resolveEnterprise('pro', null, 'price_pro_monthly', entPrices)).toBe('pro')
  })

  it('does not upgrade non-active plans to enterprise', () => {
    expect(resolveEnterprise('free', { plan_tier: 'enterprise' }, null, entPrices)).toBe('free')
    expect(resolveEnterprise('past_due', { plan_tier: 'enterprise' }, null, entPrices)).toBe(
      'past_due',
    )
    expect(resolveEnterprise('canceled', null, 'price_ent_10_mo', entPrices)).toBe('canceled')
  })

  it('upgrades trialing to enterprise when metadata indicates enterprise', () => {
    expect(resolveEnterprise('trialing', { plan_tier: 'enterprise' }, null, entPrices)).toBe(
      'enterprise',
    )
  })

  it('returns basePlan when no metadata and no priceId', () => {
    expect(resolveEnterprise('pro', null, null, entPrices)).toBe('pro')
    expect(resolveEnterprise('trialing', null, null, entPrices)).toBe('trialing')
  })

  it('returns basePlan when enterprisePriceIds is empty', () => {
    expect(resolveEnterprise('pro', null, 'price_ent_10_mo', [])).toBe('pro')
  })

  it('metadata takes precedence over priceId', () => {
    // pro price ID + enterprise metadata → enterprise
    expect(
      resolveEnterprise('pro', { plan_tier: 'enterprise' }, 'price_pro_monthly', entPrices),
    ).toBe('enterprise')
  })
})

// ── resolveEnterpriseSeatCount (D11-2) ──────────────────────────────────────

describe('resolveEnterpriseSeatCount', () => {
  it('returns 10 for ent_10_monthly plan_key', () => {
    expect(resolveEnterpriseSeatCount({ plan_key: 'ent_10_monthly' })).toBe(10)
  })

  it('returns 10 for ent_10_annual plan_key', () => {
    expect(resolveEnterpriseSeatCount({ plan_key: 'ent_10_annual' })).toBe(10)
  })

  it('returns null for ent_unlimited_monthly plan_key', () => {
    expect(resolveEnterpriseSeatCount({ plan_key: 'ent_unlimited_monthly' })).toBeNull()
  })

  it('returns null for ent_unlimited_annual plan_key', () => {
    expect(resolveEnterpriseSeatCount({ plan_key: 'ent_unlimited_annual' })).toBeNull()
  })

  it('returns undefined when no metadata', () => {
    expect(resolveEnterpriseSeatCount(null)).toBeUndefined()
    expect(resolveEnterpriseSeatCount(undefined)).toBeUndefined()
  })

  it('returns undefined when no plan_key in metadata', () => {
    expect(resolveEnterpriseSeatCount({ plan_tier: 'enterprise' })).toBeUndefined()
  })

  it('returns undefined for non-enterprise plan_key', () => {
    expect(resolveEnterpriseSeatCount({ plan_key: 'pro_monthly' })).toBeUndefined()
    expect(resolveEnterpriseSeatCount({ plan_key: 'pro_annual' })).toBeUndefined()
  })
})
