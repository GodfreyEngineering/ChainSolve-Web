/**
 * e2e/a11y.spec.ts — P145: Axe accessibility automation in E2E.
 *
 * Playwright project: `a11y`
 * Run via: npx playwright test --project=a11y
 *
 * Uses @axe-core/playwright to run automated WCAG 2.1 AA accessibility checks
 * on publicly accessible pages (no auth required).
 *
 * Severity policy:
 *   critical / serious  → test fails immediately (blocking violations)
 *   moderate / minor    → reported via console.log but do not block CI
 *
 * Scope: public routes only.  Authenticated app surfaces (canvas, settings,
 * org pages) require a Supabase session and are outside the CI-safe scope
 * of this suite.  Add those to a separate `a11y:auth` project when live
 * credentials are available in CI.
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** WCAG 2.1 Level AA tag set. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const

/**
 * Rules that produce known false-positives in this dark-theme SPA.
 * - color-contrast: axe cannot read CSS variable colours at analysis time.
 */
const SKIP_RULES = ['color-contrast']

/** Summarise a violation for console output. */
function summarise(v: { impact: string | null; id: string; description: string; nodes: unknown[] }) {
  return `  [${v.impact ?? 'unknown'}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Accessibility — landing page (pre-mount)', () => {
  test('no critical or serious violations on initial HTML', async ({ page }) => {
    await page.goto('/')
    await page.locator('#root').waitFor({ state: 'attached', timeout: 15_000 })

    const results = await new AxeBuilder({ page })
      .withTags([...WCAG_TAGS])
      .disableRules(SKIP_RULES)
      .analyze()

    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    )
    const advisory = results.violations.filter(
      (v) => v.impact === 'moderate' || v.impact === 'minor',
    )

    if (advisory.length > 0) {
      console.log(`Advisory a11y violations (non-blocking):\n${advisory.map(summarise).join('\n')}`)
    }
    if (blocking.length > 0) {
      console.error(
        `Blocking a11y violations:\n${blocking.map(summarise).join('\n')}`,
      )
    }

    expect(
      blocking,
      `${blocking.length} critical/serious accessibility violation(s) found on landing page`,
    ).toHaveLength(0)
  })
})

test.describe('Accessibility — landing page (post-React-mount)', () => {
  test('no critical violations after React renders', async ({ page }) => {
    await page.goto('/')
    await page
      .locator('[data-testid="react-mounted"], [data-testid="boot-fatal"]')
      .first()
      .waitFor({ state: 'attached', timeout: 15_000 })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag21a'])
      .disableRules(SKIP_RULES)
      .analyze()

    const critical = results.violations.filter((v) => v.impact === 'critical')

    if (critical.length > 0) {
      console.error(`Critical a11y violations after React mount:\n${critical.map(summarise).join('\n')}`)
    }

    expect(
      critical,
      `${critical.length} critical accessibility violation(s) found after React mount`,
    ).toHaveLength(0)
  })
})

test.describe('Accessibility — document structure', () => {
  test('page has a <main> landmark or ARIA role', async ({ page }) => {
    await page.goto('/')
    await page
      .locator('[data-testid="react-mounted"], [data-testid="boot-fatal"]')
      .first()
      .waitFor({ state: 'attached', timeout: 15_000 })

    // Either a semantic <main> or an ARIA role="main" must be present.
    const mainCount = await page.locator('main, [role="main"]').count()
    expect(mainCount, 'Page must have at least one <main> landmark').toBeGreaterThanOrEqual(1)
  })

  test('page has a document title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/.+/)
  })

  test('all images have alt attributes', async ({ page }) => {
    await page.goto('/')
    await page.locator('#root').waitFor({ state: 'attached', timeout: 15_000 })

    const imgsWithoutAlt = await page
      .locator('img:not([alt])')
      .evaluateAll((els) => els.map((el) => (el as HTMLElement).outerHTML.slice(0, 120)))

    expect(
      imgsWithoutAlt,
      `Images without alt attributes:\n${imgsWithoutAlt.join('\n')}`,
    ).toHaveLength(0)
  })
})
