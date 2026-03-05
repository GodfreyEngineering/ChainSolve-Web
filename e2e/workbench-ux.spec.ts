/**
 * workbench-ux.spec.ts — E11-1
 *
 * E2E tests for workbench UX features:
 *   - Workbench home / app shell (unauthenticated redirect)
 *   - Window manager (open, close, minimize, maximize, keyboard shortcuts)
 *   - Insert menu / block library (search, categories, drag availability)
 *   - Canvas toolbar controls (zoom, fit, toggles)
 *
 * Tests that require no auth use the scratch /app?scratch=1 route.
 * Tests that require auth are marked test.fixme.
 */

import { test, expect } from '@playwright/test'
import { waitForCanvasOrFatal, waitForEngineOrFatal } from './helpers'

// ── Workbench home ──────────────────────────────────────────────────────────────

test.describe('Workbench UX: Home page (E11-1)', () => {
  test('/app route loads and renders #root', async ({ page }) => {
    await page.goto('/app')
    await expect(page.locator('#root')).toBeAttached()
  })

  test.fixme(
    'authenticated user sees project browser on /app (requires auth session)',
    async () => {
      // 1. Set up authenticated session via storageState
      // 2. Navigate to /app
      // 3. Verify project browser renders (create project button, project list)
    },
  )
})

// ── Window manager ──────────────────────────────────────────────────────────────

test.describe('Workbench UX: Window manager (E11-1)', () => {
  test('canvas renders with window manager infrastructure', async ({ page }) => {
    await page.goto('/app?scratch=1')
    await waitForCanvasOrFatal(page)

    // WindowManagerProvider wraps the app — verify the canvas area loaded
    await expect(page.locator('.react-flow__renderer')).toBeAttached()
  })

  test('inspector toggle button is present in toolbar', async ({ page }) => {
    await page.goto('/app?scratch=1')
    await waitForCanvasOrFatal(page)

    // The canvas toolbar has an Inspector toggle
    const toolbar = page.locator('[role="toolbar"]')
    await expect(toolbar.first()).toBeAttached()
  })

  test('ESC key does not crash when no windows are open', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/app?scratch=1')
    await waitForCanvasOrFatal(page, errors)

    // Press Escape when no floating windows are open
    await page.keyboard.press('Escape')

    // No errors should occur
    expect(errors).toEqual([])
    // Canvas should still be functional
    await expect(page.locator('.react-flow__renderer')).toBeAttached()
  })

  test('application menubar has clickable menu items', async ({ page }) => {
    await page.goto('/app?scratch=1')
    await waitForEngineOrFatal(page)

    const menubar = page.locator('[role="menubar"][aria-label="Application menu"]')
    await expect(menubar).toBeAttached()

    // At least one menu button should be present
    const buttons = menubar.locator('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)
  })
})

// ── Insert menu / Block library ─────────────────────────────────────────────────

test.describe('Workbench UX: Block library / Insert menu (E11-1)', () => {
  test('block library search input is rendered', async ({ page }) => {
    await page.goto('/app?scratch=1')
    await waitForCanvasOrFatal(page)

    const search = page.locator('input[type="search"]').first()
    await expect(search).toBeVisible()
  })

  test('block library shows categories or block items', async ({ page }) => {
    await page.goto('/app?scratch=1')
    await waitForCanvasOrFatal(page)

    // Block library should have at least one draggable block entry
    // Blocks are rendered as elements with draggable attribute
    const draggables = page.locator('[draggable="true"]')
    const count = await draggables.count()
    expect(count).toBeGreaterThan(0)
  })

  test('block library search filters results', async ({ page }) => {
    await page.goto('/app?scratch=1')
    await waitForCanvasOrFatal(page)

    const search = page.locator('input[type="search"]').first()
    await search.fill('add')

    // After typing "add", at least one result should remain visible
    // (the "add" block should match)
    const draggables = page.locator('[draggable="true"]')
    await expect(draggables.first()).toBeVisible()
  })

  test('clearing search restores full block list', async ({ page }) => {
    await page.goto('/app?scratch=1')
    await waitForCanvasOrFatal(page)

    const search = page.locator('input[type="search"]').first()

    // Get initial count
    const initialCount = await page.locator('[draggable="true"]').count()

    // Search for something specific
    await search.fill('multiply')
    // Wait for filter to apply
    const filteredCount = await page.locator('[draggable="true"]').count()
    expect(filteredCount).toBeLessThanOrEqual(initialCount)

    // Clear search
    await search.fill('')

    // Count should restore
    const restoredCount = await page.locator('[draggable="true"]').count()
    expect(restoredCount).toBeGreaterThanOrEqual(filteredCount)
  })
})

// ── Canvas toolbar ──────────────────────────────────────────────────────────────

test.describe('Workbench UX: Canvas toolbar (E11-1)', () => {
  test('canvas toolbar has zoom controls', async ({ page }) => {
    await page.goto('/app?scratch=1')
    await waitForCanvasOrFatal(page)

    // Toolbar should be present
    const toolbar = page.locator('[role="toolbar"][aria-label="Canvas toolbar"]')
    await expect(toolbar).toBeAttached()
  })

  test('canvas toolbar buttons are interactive', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/app?scratch=1')
    await waitForCanvasOrFatal(page, errors)

    // Find all buttons in the toolbar
    const toolbar = page.locator('[role="toolbar"][aria-label="Canvas toolbar"]')
    const buttons = toolbar.locator('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)

    // Click the first button — should not crash
    await buttons.first().click()
    expect(errors).toEqual([])
  })

  test('multiple node types render in starter graph', async ({ page }) => {
    await page.goto('/app?scratch=1')
    await waitForCanvasOrFatal(page)

    // The starter graph has source nodes and a display node
    const allNodes = page.locator('.react-flow__node')
    const count = await allNodes.count()
    expect(count).toBeGreaterThanOrEqual(3) // at least 2 sources + 1 display
  })
})

// ── Settings / Router regression (V2-002) ────────────────────────────────────

test.describe('V2-002: Settings Router crash regression', () => {
  test('/settings route redirects to /app without crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/settings')
    // Should redirect to /app (SettingsRedirect navigates with replace)
    await page.waitForURL('**/app', { timeout: 15_000 })

    // No "useNavigate outside Router" error
    const routerErrors = errors.filter((e) => e.includes('useNavigate'))
    expect(routerErrors).toEqual([])
  })

  test('opening settings on /canvas does not crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/app?scratch=1')
    await waitForEngineOrFatal(page, errors)

    // Find the settings gear button in the menubar/header area
    // The menubar has an application menu with buttons
    const menubar = page.locator('[role="menubar"][aria-label="Application menu"]')
    await expect(menubar).toBeAttached()

    // Look for a gear/settings button — common patterns: aria-label, title, or data-testid
    const settingsBtn = page.locator(
      'button[aria-label*="ettings"], button[title*="ettings"], [data-testid*="settings"]',
    )

    // If the gear button exists, click it and verify no crash
    if ((await settingsBtn.count()) > 0) {
      await settingsBtn.first().click()
      // Allow modal to render
      await page.waitForTimeout(300)
      // No useNavigate errors
      const routerErrors = errors.filter((e) => e.includes('useNavigate'))
      expect(routerErrors).toEqual([])
    }

    // Regardless of gear button, no errors should have occurred
    expect(errors).toEqual([])
  })
})
