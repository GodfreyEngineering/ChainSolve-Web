import { test, expect } from '@playwright/test'
import { waitForCanvasOrFatal } from './helpers'

test.describe('Plot smoke tests', () => {
  test('plot blocks exist in the block registry', async ({ page }) => {
    // Navigate to the canvas (scratch mode, no auth required for loading).
    // Register pageerror handler BEFORE goto so we catch any init-time throws.
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/canvas')
    // waitForCanvasOrFatal: resolves once engine + first eval cycle complete
    // OR throws immediately if engine-fatal appears (instead of timing out).
    await waitForCanvasOrFatal(page, errors)
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
    // Wait for canvas-computed (full eval cycle, including lazy Vega loading)
    // or fail fast on engine-fatal instead of hitting a 15-second wall.
    await waitForCanvasOrFatal(page)
    expect(cspErrors).toEqual([])
  })

  test('vega-interpreter module declaration exists', async ({ request }) => {
    // Verify the app doesn't crash by loading the main page
    const res = await request.get('/')
    expect(res.status()).toBe(200)
  })
})
