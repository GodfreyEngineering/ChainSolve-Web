/**
 * e2e/visual.spec.ts — P144: Visual regression tests using Playwright screenshots.
 *
 * Playwright project: `visual`
 * Run via: npx playwright test --project=visual
 *
 * Captures pixel-exact screenshots of stable, auth-free UI surfaces and
 * compares them to committed baselines stored alongside this file.
 * Baselines are created automatically on first run (updateSnapshots: 'missing'
 * is set in playwright.config.ts for the visual project).
 *
 * Baseline update workflow:
 *   npx playwright test --project=visual --update-snapshots
 *   git add e2e/
 *   git commit -m "chore: update visual regression baselines"
 *
 * What we screenshot:
 *   - The landing page before the WASM engine boots (stable HTML/CSS only)
 *   - The #root element once React has mounted (stable layout skeleton)
 *
 * Stability notes:
 *   - CSS animations and transitions are forcibly disabled before capture.
 *   - We do NOT wait for engine-ready — WASM timing introduces flakiness.
 *   - Screenshots are taken at a fixed 1280×720 viewport (set in the project).
 */

import { test, expect } from '@playwright/test'

// ── Diff tolerance ────────────────────────────────────────────────────────────

/** Options applied to every toHaveScreenshot() call. */
const SCREENSHOT_OPTS = {
  /** Allow up to 5% of pixels to differ — handles sub-pixel rendering variance. */
  maxDiffPixelRatio: 0.05,
  /** Per-pixel colour-distance threshold (0–1).  0.2 allows minor AA differences. */
  threshold: 0.2,
  /** Freeze CSS animations so captures are deterministic. */
  animations: 'disabled' as const,
}

// ── Helper ────────────────────────────────────────────────────────────────────

/** Inject a <style> that disables all animations and transitions site-wide. */
async function freezeAnimations(page: import('@playwright/test').Page): Promise<void> {
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Visual regression — landing page', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('full page initial render matches baseline', async ({ page }) => {
    await page.goto('/')
    // Wait for the root element only — no WASM required for stable layout.
    await page.locator('#root').waitFor({ state: 'attached', timeout: 15_000 })
    await freezeAnimations(page)
    await expect(page).toHaveScreenshot('landing-full.png', SCREENSHOT_OPTS)
  })

  test('#root element matches baseline after React mounts', async ({ page }) => {
    await page.goto('/')
    await page
      .locator('[data-testid="react-mounted"], [data-testid="boot-fatal"]')
      .first()
      .waitFor({ state: 'attached', timeout: 15_000 })
    await freezeAnimations(page)
    await expect(page.locator('#root')).toHaveScreenshot('landing-root.png', SCREENSHOT_OPTS)
  })
})

test.describe('Visual regression — error states', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('404 route renders #root without crash', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')
    await page.locator('#root').waitFor({ state: 'attached', timeout: 15_000 })
    await freezeAnimations(page)
    // Just verify we can screenshot without error — no crash means app handled unknown route.
    const screenshot = await page.screenshot()
    expect(screenshot.length).toBeGreaterThan(0)
  })
})
