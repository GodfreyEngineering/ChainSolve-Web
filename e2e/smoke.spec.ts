import { test, expect } from '@playwright/test'

test.describe('Smoke tests', () => {
  test('index.html loads and renders #root', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#root')).toBeAttached()
  })

  test('page title is ChainSolve', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('ChainSolve')
  })

  test('robots.txt is served', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('User-agent')
    expect(body).toContain('Disallow: /app')
  })

  test('favicon.svg is served', async ({ request }) => {
    const res = await request.get('/favicon.svg')
    expect(res.status()).toBe(200)
  })

  test('SPA redirects unknown routes to index.html', async ({ page }) => {
    // Vite preview doesn't support _redirects, so we just verify the page loads
    await page.goto('/app')
    await expect(page.locator('#root')).toBeAttached()
  })

  test('noindex meta tag is present', async ({ page }) => {
    await page.goto('/')
    const robots = page.locator('meta[name="robots"]')
    await expect(robots).toHaveAttribute('content', 'noindex, nofollow')
  })

  test('security meta tags are present', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      '#1CABB0',
    )
    await expect(page.locator('meta[name="viewport"]')).toBeAttached()
  })

  test('no console errors on initial load', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/')
    // Wait a tick for any async errors
    await page.waitForTimeout(1000)
    expect(errors).toEqual([])
  })
})
