/**
 * multi-canvas.spec.ts — P095
 *
 * E2E tests for multi-canvas (Sheets) feature.
 *
 * Scratch canvas (/canvas, no projectId):
 *  - Canvas area is present
 *  - No project-level sheets bar in scratch mode (no persisted canvases)
 *  - URL is /canvas (not /canvas/:id)
 *
 * Project mode (/canvas/:projectId, requires auth):
 *  - SheetsBar renders with canvas tabs
 *  - Clicking a tab switches the active canvas
 *  - New canvas can be created via the + button
 *  - Deleting a canvas removes its tab
 *  - Canvas state is persisted between tab switches
 *
 * Auth-required tests are marked test.fixme.
 */

import { test, expect } from '@playwright/test'
import { waitForCanvasOrFatal } from './helpers'

// ── Scratch canvas ─────────────────────────────────────────────────────────────

test.describe('Multi-canvas — scratch mode (P095)', () => {
  test('scratch canvas URL is /canvas without project ID', async ({ page }) => {
    await page.goto('/canvas')
    await waitForCanvasOrFatal(page)
    expect(page.url()).toContain('/canvas')
    // In scratch mode there is no /canvas/:id segment
    const url = new URL(page.url())
    expect(url.pathname).toBe('/canvas')
  })

  test('React Flow canvas area renders in scratch mode', async ({ page }) => {
    await page.goto('/canvas')
    await waitForCanvasOrFatal(page)
    await expect(page.locator('.react-flow__renderer')).toBeAttached()
  })

  test('canvas-computed sentinel appears after first evaluation', async ({ page }) => {
    await page.goto('/canvas')
    await waitForCanvasOrFatal(page)
    // canvas-computed is set in CanvasArea after the first eval cycle completes
    await expect(page.locator('[data-testid="canvas-computed"]')).toBeAttached()
  })

  test('multiple scratch canvas navigation does not crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    // Navigate away and back — should not crash
    await page.goto('/canvas')
    await waitForCanvasOrFatal(page)
    await page.goto('/')
    await page.goto('/canvas')
    await waitForCanvasOrFatal(page)
    expect(errors).toEqual([])
  })
})

// ── Project mode (requires auth) ──────────────────────────────────────────────

test.fixme('sheets bar renders with canvas tab in project mode (requires auth)', async () => {
  // await page.goto('/canvas/<project-id>')
  // await waitForCanvasOrFatal(page)
  // await expect(page.locator('[role="tab"]').first()).toBeVisible()
})

test.fixme('clicking a second canvas tab switches active canvas (requires auth)', async () => {
  // 1. Open project with 2+ canvases
  // 2. Click tab[1]
  // 3. Verify canvas content changes (different set of nodes)
})

test.fixme('creating a new canvas adds a tab (requires auth)', async () => {
  // 1. Open project
  // 2. Click "+" button in sheets bar
  // 3. Verify new tab appears with default canvas name
  // 4. Verify URL updates to new canvas ID
})

test.fixme('renaming a canvas updates the tab label (requires auth)', async () => {
  // 1. Open project
  // 2. Double-click canvas tab to rename
  // 3. Type new name + Enter
  // 4. Verify tab shows new name
})

test.fixme('canvas state persists when switching between canvases (requires auth)', async () => {
  // 1. Open project with 2 canvases
  // 2. In canvas A: note the starter graph
  // 3. Switch to canvas B
  // 4. Switch back to canvas A
  // 5. Verify canvas A state is unchanged
})

test.fixme('deleting a canvas removes its tab (requires auth)', async () => {
  // 1. Open project with 2+ canvases
  // 2. Right-click a tab to open context menu
  // 3. Click "Delete"
  // 4. Verify tab is removed
})
