import { test, expect } from '@playwright/test'

test.describe('Groups smoke tests', () => {
  test('page loads without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/')
    await expect(page.locator('#root')).toBeAttached()
    expect(errors).toHaveLength(0)
  })

  test('canvas route loads with #root', async ({ page }) => {
    await page.goto('/canvas')
    await expect(page.locator('#root')).toBeAttached()
  })
})
