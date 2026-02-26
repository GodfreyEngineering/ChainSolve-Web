import { test, expect } from '@playwright/test'

test.describe('Groups smoke tests', () => {
  test('page loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/')
    // Wait for engine-ready: fires only after WASM resolves, ensuring all
    // async init errors have had a chance to propagate before we assert.
    await page.locator('[data-testid="engine-ready"]').waitFor({ state: 'attached', timeout: 15_000 })
    expect(errors).toHaveLength(0)
  })

  test('canvas route loads with #root', async ({ page }) => {
    await page.goto('/canvas')
    await expect(page.locator('#root')).toBeAttached()
  })
})
