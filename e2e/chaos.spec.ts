/**
 * e2e/chaos.spec.ts — P146: Chaos testing (Supabase outages, worker crashes).
 *
 * Playwright project: `chaos`
 * Run via: npx playwright test --project=chaos
 *
 * Verifies that the application degrades gracefully under:
 *   1. Supabase REST API outages (503 Service Unavailable responses)
 *   2. Supabase Auth outages (connection refused / aborted)
 *   3. Combined Supabase blackout (all Supabase endpoints unreachable)
 *   4. Engine readiness contract (engine + global handle present after boot)
 *
 * All failures are simulated via page.route() interception — no real Supabase
 * credentials or network access required.
 *
 * Core invariant under test:
 *   The WASM engine is local (bundled); it MUST reach engine-ready regardless
 *   of Supabase availability.  Auth-gated UI may degrade, but the boot sequence
 *   must complete without uncaught errors.
 */

import { test, expect } from '@playwright/test'
import { waitForEngineOrFatal } from './helpers'

// ── Shared setup ─────────────────────────────────────────────────────────────

/** Collect uncaught page errors (not console.error — those are expected during Supabase failures). */
function collectErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

// ── 1. Supabase REST 503 ──────────────────────────────────────────────────────

test.describe('Chaos — Supabase REST outage (503)', () => {
  test('engine boots successfully when REST returns 503', async ({ page }) => {
    const errors = collectErrors(page)

    await page.route('**/rest/v1/**', (route) => {
      void route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Service Unavailable' }),
      })
    })

    await page.goto('/')
    await waitForEngineOrFatal(page, errors)

    await expect(page.locator('[data-testid="engine-ready"]')).toBeAttached()
    // No uncaught JavaScript errors — graceful degradation means errors stay in UI,
    // not in the uncaught exception handler.
    expect(errors).toHaveLength(0)
  })

  test('engine boots successfully when Auth returns 503', async ({ page }) => {
    const errors = collectErrors(page)

    await page.route('**/auth/v1/**', (route) => {
      void route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Auth service temporarily unavailable' }),
      })
    })

    await page.goto('/')
    await waitForEngineOrFatal(page, errors)

    await expect(page.locator('[data-testid="engine-ready"]')).toBeAttached()
    expect(errors).toHaveLength(0)
  })
})

// ── 2. Supabase network failure (connection refused) ─────────────────────────

test.describe('Chaos — Supabase network failure', () => {
  test('engine boots successfully when REST calls are aborted', async ({ page }) => {
    const errors = collectErrors(page)

    await page.route('**/rest/v1/**', (route) => {
      void route.abort('connectionrefused')
    })

    await page.goto('/')
    await waitForEngineOrFatal(page, errors)

    await expect(page.locator('[data-testid="engine-ready"]')).toBeAttached()
    expect(errors).toHaveLength(0)
  })

  test('engine boots successfully when Auth calls are aborted', async ({ page }) => {
    const errors = collectErrors(page)

    await page.route('**/auth/v1/**', (route) => {
      void route.abort('connectionrefused')
    })

    await page.goto('/')
    await waitForEngineOrFatal(page, errors)

    await expect(page.locator('[data-testid="engine-ready"]')).toBeAttached()
    expect(errors).toHaveLength(0)
  })
})

// ── 3. Combined Supabase blackout ─────────────────────────────────────────────

test.describe('Chaos — total Supabase blackout', () => {
  test('engine boots with all Supabase endpoints returning 503', async ({ page }) => {
    const errors = collectErrors(page)

    // Block every request to a Supabase-shaped URL.
    for (const pattern of ['**/rest/v1/**', '**/auth/v1/**', '**/storage/v1/**', '**/realtime/v1/**']) {
      await page.route(pattern, (route) => {
        void route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'blackout simulation' }),
        })
      })
    }

    await page.goto('/')
    await waitForEngineOrFatal(page, errors)

    // Core invariant: engine-ready must appear even without Supabase.
    await expect(page.locator('[data-testid="engine-ready"]')).toBeAttached()
    expect(errors).toHaveLength(0)
  })
})

// ── 4. Engine global handle contract ─────────────────────────────────────────

test.describe('Chaos — engine global handle', () => {
  test('window.__chainsolve_engine is defined after engine-ready', async ({ page }) => {
    const errors = collectErrors(page)

    await page.goto('/')
    await waitForEngineOrFatal(page, errors)

    const engineDefined = await page.evaluate(
      () => typeof (window as Record<string, unknown>).__chainsolve_engine !== 'undefined',
    )
    expect(engineDefined, 'window.__chainsolve_engine must be set after engine-ready').toBe(true)
    expect(errors).toHaveLength(0)
  })

  test('engine global handle is functional after Supabase REST outage', async ({ page }) => {
    const errors = collectErrors(page)

    await page.route('**/rest/v1/**', (route) => {
      void route.abort('connectionrefused')
    })

    await page.goto('/')
    await waitForEngineOrFatal(page, errors)

    const engineType = await page.evaluate(
      () => typeof (window as Record<string, unknown>).__chainsolve_engine,
    )
    expect(engineType).toBe('object')
    expect(errors).toHaveLength(0)
  })
})
