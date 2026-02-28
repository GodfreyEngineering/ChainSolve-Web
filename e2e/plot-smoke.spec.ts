/**
 * plot-smoke.spec.ts — P098
 *
 * E2E smoke tests for plot rendering.
 *
 * These tests verify:
 *  - The canvas loads without CSP violations (Vega uses interpreter mode)
 *  - Plot blocks (xyPlot, histogram) exist in the engine catalog
 *  - The engine correctly processes vectorInput + xyPlot graphs
 *  - No JavaScript errors occur during plot evaluation
 *
 * Full UI plot rendering (dragging an xyPlot block onto canvas, SVG visible)
 * requires a Pro-plan session and is marked test.fixme below.
 */

import { test, expect } from '@playwright/test'
import { waitForCanvasOrFatal, waitForEngineOrFatal } from './helpers'

test.describe('Plot smoke (P098)', () => {
  test('canvas loads without errors (plot lazy modules)', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.goto('/canvas')
    await waitForCanvasOrFatal(page, errors)
    expect(errors).toEqual([])
  })

  test('no CSP violations on canvas load', async ({ page }) => {
    const cspErrors: string[] = []
    page.on('console', (msg) => {
      const text = msg.text()
      if (
        text.includes('Content Security Policy') ||
        text.includes('unsafe-eval') ||
        text.includes('EvalError')
      ) {
        cspErrors.push(text)
      }
    })
    await page.goto('/canvas')
    await waitForCanvasOrFatal(page)
    expect(cspErrors).toEqual([])
  })

  test('main page serves 200', async ({ request }) => {
    const res = await request.get('/')
    expect(res.status()).toBe(200)
  })

  test('xyPlot and histogram blocks exist in engine catalog', async ({ page }) => {
    await page.goto('/canvas')
    await waitForEngineOrFatal(page)

    const plotOps = await page.evaluate(() => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        catalog: { opId: string }[]
      }
      return engine.catalog
        .filter((e) => ['xyPlot', 'histogram'].includes(e.opId))
        .map((e) => e.opId)
    })

    expect(plotOps).toContain('xyPlot')
    expect(plotOps).toContain('histogram')
  })

  test('engine evaluates vectorInput → xyPlot without error', async ({ page }) => {
    await page.goto('/canvas')
    await waitForEngineOrFatal(page)

    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (snap: unknown) => Promise<unknown>
      }
      return engine.evaluateGraph({
        version: 1,
        nodes: [
          { id: 'xs', blockType: 'vectorInput', data: { vectorData: [1, 2, 3, 4, 5] } },
          { id: 'ys', blockType: 'vectorInput', data: { vectorData: [1, 4, 9, 16, 25] } },
          { id: 'plot', blockType: 'xyPlot', data: {} },
        ],
        edges: [
          { id: 'e1', source: 'xs', sourceHandle: 'out', target: 'plot', targetHandle: 'x' },
          { id: 'e2', source: 'ys', sourceHandle: 'out', target: 'plot', targetHandle: 'y' },
        ],
      })
    })

    const r = result as {
      values: Record<string, { kind: string }>
      diagnostics: unknown[]
    }
    expect(r.values.plot).toBeDefined()
    expect(r.values.plot.kind).not.toBe('error')
    expect(r.diagnostics).toEqual([])
  })

  test('engine evaluates vectorInput → histogram without error', async ({ page }) => {
    await page.goto('/canvas')
    await waitForEngineOrFatal(page)

    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (snap: unknown) => Promise<unknown>
      }
      return engine.evaluateGraph({
        version: 1,
        nodes: [
          {
            id: 'data',
            blockType: 'vectorInput',
            data: { vectorData: [1, 2, 2, 3, 3, 3, 4] },
          },
          { id: 'hist', blockType: 'histogram', data: {} },
        ],
        edges: [
          {
            id: 'e1',
            source: 'data',
            sourceHandle: 'out',
            target: 'hist',
            targetHandle: 'data',
          },
        ],
      })
    })

    const r = result as {
      values: Record<string, { kind: string }>
      diagnostics: unknown[]
    }
    expect(r.values.hist).toBeDefined()
    expect(r.values.hist.kind).not.toBe('error')
  })
})

// ── Plot UI rendering (requires Pro plan + auth) ──────────────────────────────

test.fixme('xyPlot node renders SVG chart in canvas (requires Pro + auth)', async () => {
  // 1. Open canvas with Pro plan session
  // 2. Drag xyPlot block to canvas
  // 3. Connect vectorInput nodes for X and Y
  // 4. Verify <svg> element rendered inside the plot node
  // 5. Verify SVG has data path elements (chart content)
})

test.fixme('histogram node renders SVG bar chart (requires Pro + auth)', async () => {
  // 1. Open canvas with Pro plan
  // 2. Drag histogram block + connect vectorInput
  // 3. Verify SVG rendered with rect elements (bars)
})

test.fixme('Export PDF includes plot chart image (requires Pro + auth)', async () => {
  // 1. Open canvas with a plot node and data
  // 2. File → Export PDF
  // 3. Verify PDF download begins
  // 4. Verify PDF includes plot/chart image
})
