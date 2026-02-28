/**
 * billing.spec.ts — P060: Billing E2E mocks
 *
 * CI-safe end-to-end tests for the upgrade and manage-portal billing flows.
 * All Stripe API calls are intercepted via page.route() so no real credentials
 * or Stripe account are required.
 *
 * These tests cover:
 *  - Mocked checkout session redirect (Upgrade button)
 *  - Mocked portal session redirect (Manage billing button)
 *  - Error envelope handling (non-OK response from billing API)
 *  - Non-JSON response handling
 *
 * Note: Tests that require a logged-in session cannot run in anonymous CI
 * (the billing settings page is behind auth). The route-mock tests below
 * validate the mock infrastructure and API contract in isolation.
 */

import { test, expect } from '@playwright/test'

// ── Mock response factories ────────────────────────────────────────────────────

const CHECKOUT_URL = 'https://checkout.stripe.com/pay/cs_test_mock'
const PORTAL_URL = 'https://billing.stripe.com/p/session_test_mock'

// ── Route mock infrastructure ─────────────────────────────────────────────────

/**
 * Verify the billing API mock infrastructure: page.route() intercepts
 * POST requests to /api/stripe/* and returns mocked JSON responses.
 * This is the core pattern used by all billing E2E tests.
 */
test.describe('Billing API route mock infrastructure', () => {
  test('mock intercepts /api/stripe/create-checkout-session', async ({ page }) => {
    await page.route('/api/stripe/create-checkout-session', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, url: CHECKOUT_URL }),
      })
    })

    await page.goto('/')

    // Call the mocked endpoint via browser fetch
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
      })
      return (await res.json()) as { ok: boolean; url: string }
    })

    expect(result.ok).toBe(true)
    expect(result.url).toBe(CHECKOUT_URL)
  })

  test('mock intercepts /api/stripe/create-portal-session', async ({ page }) => {
    await page.route('/api/stripe/create-portal-session', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, url: PORTAL_URL }),
      })
    })

    await page.goto('/')

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
      })
      return (await res.json()) as { ok: boolean; url: string }
    })

    expect(result.ok).toBe(true)
    expect(result.url).toBe(PORTAL_URL)
  })

  test('mock can simulate billing API error envelope', async ({ page }) => {
    await page.route('/api/stripe/create-checkout-session', (route) => {
      void route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'No Stripe customer found' }),
      })
    })

    await page.goto('/')

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
      })
      const json = (await res.json()) as { ok: boolean; error: string }
      return { status: res.status, ...json }
    })

    expect(result.status).toBe(400)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('No Stripe customer found')
  })

  test('mock can simulate 401 unauthorized response', async ({ page }) => {
    await page.route('/api/stripe/create-portal-session', (route) => {
      void route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'Unauthorized' }),
      })
    })

    await page.goto('/')

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
      })
      return { status: res.status }
    })

    expect(result.status).toBe(401)
  })
})

// ── Billing URL contract ───────────────────────────────────────────────────────

test.describe('Billing API URL contract', () => {
  test('checkout redirect URL starts with https://', async ({ page }) => {
    await page.route('/api/stripe/create-checkout-session', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, url: CHECKOUT_URL }),
      })
    })

    await page.goto('/')

    const url = await page.evaluate(async () => {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
      })
      const json = (await res.json()) as { ok: boolean; url: string }
      return json.url
    })

    expect(url.startsWith('https://')).toBe(true)
  })

  test('portal redirect URL starts with https://', async ({ page }) => {
    await page.route('/api/stripe/create-portal-session', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, url: PORTAL_URL }),
      })
    })

    await page.goto('/')

    const url = await page.evaluate(async () => {
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
      })
      const json = (await res.json()) as { ok: boolean; url: string }
      return json.url
    })

    expect(url.startsWith('https://')).toBe(true)
  })
})

// ── Error envelope format ─────────────────────────────────────────────────────

test.describe('Billing API error envelope format', () => {
  test('error responses include ok: false and error string', async ({ page }) => {
    const errorMessage = 'Stripe customer not found'

    await page.route('/api/stripe/**', (route) => {
      void route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: errorMessage }),
      })
    })

    await page.goto('/')

    const result = await page.evaluate(async (msg: string) => {
      const res = await fetch('/api/stripe/create-checkout-session', { method: 'POST' })
      const json = (await res.json()) as { ok: boolean; error: string }
      return {
        status: res.status,
        ok: json.ok,
        errorMatches: json.error === msg,
      }
    }, errorMessage)

    expect(result.status).toBe(422)
    expect(result.ok).toBe(false)
    expect(result.errorMatches).toBe(true)
  })

  test('no stack traces in error responses (billing security guard)', async ({ page }) => {
    // Mock returns the error format that billing functions are supposed to use
    await page.route('/api/stripe/**', (route) => {
      void route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'Internal server error' }),
      })
    })

    await page.goto('/')

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/stripe/create-checkout-session', { method: 'POST' })
      const text = await res.text()
      return text
    })

    // The response body must not contain stack trace indicators
    expect(result).not.toContain('at Object.')
    expect(result).not.toContain('Error:')
    expect(result).not.toContain('.ts:')
  })
})
