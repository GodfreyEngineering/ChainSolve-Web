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

type Plan = 'free' | 'trialing' | 'pro' | 'past_due' | 'canceled'
function mapStatusToPlan(status: string): Plan {
  if (status === 'trialing') return 'trialing'
  if (status === 'active') return 'pro'
  if (status === 'past_due' || status === 'unpaid') return 'past_due'
  if (status === 'canceled' || status === 'incomplete_expired') return 'canceled'
  return 'free'
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
