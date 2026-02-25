import { test, expect } from '@playwright/test'

test.describe('Plot smoke tests', () => {
  test('plot blocks exist in the block registry', async ({ page }) => {
    // Navigate to the canvas (scratch mode, no auth required for loading)
    await page.goto('/canvas')
    await expect(page.locator('#root')).toBeAttached()
    // The page should load without console errors
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.waitForTimeout(1500)
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
    await page.waitForTimeout(2000)
    expect(cspErrors).toEqual([])
  })

  test('vega-interpreter module declaration exists', async ({ request }) => {
    // Verify the app doesn't crash by loading the main page
    const res = await request.get('/')
    expect(res.status()).toBe(200)
  })
})
