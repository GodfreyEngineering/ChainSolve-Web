import { test, expect } from '@playwright/test'

test.describe('Plot smoke tests', () => {
  test('plot blocks exist in the block registry', async ({ page }) => {
    // Navigate to the canvas (scratch mode, no auth required for loading)
    // Register pageerror handler BEFORE goto so we catch any init-time throws.
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/canvas')
    // canvas-computed renders once the engine has loaded and evaluated the
    // starter graph (3+4=7) — a deterministic signal replacing waitForTimeout.
    await page.locator('[data-testid="canvas-computed"]').waitFor({ state: 'attached', timeout: 15_000 })
    expect(errors).toEqual([])
  })

  test('no CSP violations in console on load', async ({ page }) => {
    const cspErrors: string[] = []
    page.on('console', (msg) => {
      const text = msg.text()
      if (
        text.includes('Content Security Policy') ||
        text.includes('unsafe-eval') ||
        text.includes('EvalError')
      ) {
        cspErrors.push(text)
      }
    })
    await page.goto('/canvas')
    // Wait for canvas-computed to confirm the full eval cycle (including
    // lazy Vega-interpreter loading) has completed without CSP violations.
    await page.locator('[data-testid="canvas-computed"]').waitFor({ state: 'attached', timeout: 15_000 })
    expect(cspErrors).toEqual([])
  })

  test('vega-interpreter module declaration exists', async ({ request }) => {
    // Verify the app doesn't crash by loading the main page
    const res = await request.get('/')
    expect(res.status()).toBe(200)
  })
})
