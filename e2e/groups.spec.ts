import { test, expect } from '@playwright/test'
import { waitForEngineOrFatal } from './helpers'

test.describe('Groups smoke tests', () => {
  test('page loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/')
    // waitForEngineOrFatal: resolves when engine-ready appears (WASM init done)
    // OR throws immediately if engine-fatal appears, including the error message.
    await waitForEngineOrFatal(page, errors)
    expect(errors).toHaveLength(0)
  })

  test('canvas route loads with #root', async ({ page }) => {
    await page.goto('/canvas')
    await expect(page.locator('#root')).toBeAttached()
  })
})
