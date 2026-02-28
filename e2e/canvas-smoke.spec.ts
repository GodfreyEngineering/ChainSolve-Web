/**
 * canvas-smoke.spec.ts — P094
 *
 * E2E smoke tests for the scratch canvas (no auth required).
 * Route: /canvas  — loads INITIAL_NODES/INITIAL_EDGES (starter 3+4 graph).
 *
 * Covers:
 *  - Canvas page loads without errors
 *  - Block library panel is visible with search
 *  - React Flow canvas renders nodes
 *  - Engine evaluates the starter graph correctly
 *  - Display node shows computed value "7"
 *  - Bottom toolbar is accessible
 *  - Application menubar is accessible
 *  - Engine API: add blocks, connect, eval, get results
 *
 * Project-mode operations (create project, save to cloud) require an
 * authenticated session and are marked test.fixme below.
 */

import { test, expect } from '@playwright/test'
import { waitForCanvasOrFatal, waitForEngineOrFatal } from './helpers'

// ── Scratch canvas: basic load ────────────────────────────────────────────────

test.describe('Canvas smoke (P094)', () => {
  test('scratch canvas loads without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/canvas')
    await waitForCanvasOrFatal(page, errors)
    expect(errors).toEqual([])
  })

  test('block library panel is visible with search input', async ({ page }) => {
    await page.goto('/canvas')
    await waitForCanvasOrFatal(page)
    // BlockLibrary renders an input[type="search"] for filtering blocks
    await expect(page.locator('input[type="search"]').first()).toBeVisible()
  })

  test('React Flow canvas container renders', async ({ page }) => {
    await page.goto('/canvas')
    await waitForCanvasOrFatal(page)
    // React Flow always renders a .react-flow__renderer once mounted
    await expect(page.locator('.react-flow__renderer')).toBeAttached()
  })

  test('starter graph has at least one display node showing "7"', async ({ page }) => {
    await page.goto('/canvas')
    await waitForCanvasOrFatal(page)
    const display = page.locator('.react-flow__node-csDisplay')
    await expect(display.first()).toBeVisible()
    await expect(display.first()).toContainText('7')
  })

  test('bottom toolbar is rendered with canvas-toolbar role', async ({ page }) => {
    await page.goto('/canvas')
    await waitForCanvasOrFatal(page)
    await expect(page.locator('[role="toolbar"][aria-label="Canvas toolbar"]')).toBeAttached()
  })

  test('application menubar is rendered', async ({ page }) => {
    await page.goto('/canvas')
    await waitForEngineOrFatal(page)
    await expect(page.locator('[role="menubar"][aria-label="Application menu"]')).toBeAttached()
  })
})

// ── Engine API: add blocks, connect, eval ─────────────────────────────────────

test.describe('Canvas engine API via scratch canvas (P094)', () => {
  test('evaluates add(10, 20) = 30 via engine API', async ({ page }) => {
    await page.goto('/canvas')
    await waitForEngineOrFatal(page)

    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (snap: unknown) => Promise<unknown>
      }
      return engine.evaluateGraph({
        version: 1,
        nodes: [
          { id: 'a', blockType: 'number', data: { value: 10 } },
          { id: 'b', blockType: 'number', data: { value: 20 } },
          { id: 'sum', blockType: 'add', data: {} },
        ],
        edges: [
          { id: 'e1', source: 'a', sourceHandle: 'out', target: 'sum', targetHandle: 'a' },
          { id: 'e2', source: 'b', sourceHandle: 'out', target: 'sum', targetHandle: 'b' },
        ],
      })
    })

    const r = result as { values: Record<string, { kind: string; value: number }> }
    expect(r.values.sum).toEqual({ kind: 'scalar', value: 30 })
  })

  test('evaluates multiply(6, 7) = 42 via engine API', async ({ page }) => {
    await page.goto('/canvas')
    await waitForEngineOrFatal(page)

    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (snap: unknown) => Promise<unknown>
      }
      return engine.evaluateGraph({
        version: 1,
        nodes: [
          { id: 'a', blockType: 'number', data: { value: 6 } },
          { id: 'b', blockType: 'number', data: { value: 7 } },
          { id: 'mul', blockType: 'multiply', data: {} },
        ],
        edges: [
          { id: 'e1', source: 'a', sourceHandle: 'out', target: 'mul', targetHandle: 'a' },
          { id: 'e2', source: 'b', sourceHandle: 'out', target: 'mul', targetHandle: 'b' },
        ],
      })
    })

    const r = result as { values: Record<string, { kind: string; value: number }> }
    expect(r.values.mul).toEqual({ kind: 'scalar', value: 42 })
  })

  test('incremental patch correctly updates eval after node value change', async ({ page }) => {
    await page.goto('/canvas')
    await waitForEngineOrFatal(page)

    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        loadSnapshot: (snap: unknown) => Promise<unknown>
        applyPatch: (ops: unknown[]) => Promise<unknown>
      }

      // Load initial snapshot: 3 + 4 = 7
      await engine.loadSnapshot({
        version: 1,
        nodes: [
          { id: 'n1', blockType: 'number', data: { value: 3 } },
          { id: 'n2', blockType: 'number', data: { value: 4 } },
          { id: 'add', blockType: 'add', data: {} },
        ],
        edges: [
          { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'add', targetHandle: 'a' },
          { id: 'e2', source: 'n2', sourceHandle: 'out', target: 'add', targetHandle: 'b' },
        ],
      })

      // Patch n1 value to 10: now 10 + 4 = 14
      const inc = await engine.applyPatch([
        { op: 'updateNodeData', nodeId: 'n1', data: { value: 10 } },
      ])
      return inc
    })

    const inc = result as { changedValues: Record<string, { kind: string; value: number }> }
    expect(inc.changedValues.n1).toEqual({ kind: 'scalar', value: 10 })
    expect(inc.changedValues.add).toEqual({ kind: 'scalar', value: 14 })
  })
})

// ── Project-mode operations (require auth) ────────────────────────────────────

test.fixme('create project → canvas → save (requires authenticated session)', async () => {
  // Full flow:
  // 1. Navigate to /app (projects list)
  // 2. Create a new project
  // 3. Open canvas, add blocks via UI drag-and-drop
  // 4. Connect blocks
  // 5. Verify evaluation result in display node
  // 6. Save and verify save-status indicator shows "Saved"
  // Requires: PLAYWRIGHT_AUTH_STATE env var with a valid Supabase session
})
