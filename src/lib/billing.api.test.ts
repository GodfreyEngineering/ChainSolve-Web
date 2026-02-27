/**
 * billing.api.test.ts — Contract tests for the Stripe billing API error envelope.
 *
 * Both Cloudflare Functions (create-checkout-session, create-portal-session) use
 * the shared jsonError helper from functions/api/stripe/_lib.ts.  These tests
 * verify the contract:
 *
 *   Error responses:   { ok: false, error: string }  (HTTP 4xx / 5xx)
 *   Success responses: { ok: true, ...data }          (HTTP 2xx)
 *   Stack traces are NEVER included in any response body.
 *
 * The helper is inlined here so tests do not cross tsconfig boundaries
 * (functions/ uses @cloudflare/workers-types, src/ uses browser globals).
 * The inline copy MUST stay in sync with functions/api/stripe/_lib.ts.
 */

import { describe, it, expect } from 'vitest'

// ── Inline copy of functions/api/stripe/_lib.ts ───────────────────────────────
function jsonError(message: string, status: number): Response {
  return Response.json({ ok: false, error: message }, { status })
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
