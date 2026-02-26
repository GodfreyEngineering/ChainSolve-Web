import { test, expect } from '@playwright/test'
import { waitForEngineOrFatal } from './helpers'

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
    // waitForEngineOrFatal: resolves when engine-ready appears (WASM init done)
    // OR throws immediately if engine-fatal appears, printing the fatal message.
    // 60-second budget covers cold CI runners where first WASM compilation is slow.
    await waitForEngineOrFatal(page, errors)
    expect(errors).toEqual([])
  })
})
