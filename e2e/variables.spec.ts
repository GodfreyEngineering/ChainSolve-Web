/**
 * variables.spec.ts — P096
 *
 * E2E tests for project variables, bindings, and sliders.
 *
 * Scratch mode tests (no auth required):
 *  - Engine evaluates graphs with manual values (stand-in for variable bindings)
 *  - setInput API works for slider-style incremental updates
 *  - Variable-like data flow produces correct results
 *
 * Project-mode variable tests require auth and are marked test.fixme.
 */

import { test, expect } from '@playwright/test'
import { waitForEngineOrFatal } from './helpers'

// ── Variables via engine API (scratch mode) ───────────────────────────────────

test.describe('Variables and bindings — engine API (P096)', () => {
  test('manual values act as variable inputs for disconnected ports', async ({ page }) => {
    await page.goto('/canvas')
    await waitForEngineOrFatal(page)

    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (snap: unknown) => Promise<unknown>
      }
      // Simulate a "variable" by giving a node a manual value (no edge connection)
      return engine.evaluateGraph({
        version: 1,
        nodes: [
          { id: 'mul', blockType: 'multiply', data: { manualValues: { a: 5, b: 3 } } },
        ],
        edges: [],
      })
    })

    const r = result as { values: Record<string, { kind: string; value: number }> }
    expect(r.values.mul).toEqual({ kind: 'scalar', value: 15 })
  })

  test('setInput provides slider-style incremental updates', async ({ page }) => {
    await page.goto('/canvas')
    await waitForEngineOrFatal(page)

    const results = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        loadSnapshot: (snap: unknown) => Promise<unknown>
        setInput: (nodeId: string, portId: string, value: number) => Promise<unknown>
      }

      await engine.loadSnapshot({
        version: 1,
        nodes: [
          { id: 'n', blockType: 'number', data: { value: 0 } },
          { id: 'double', blockType: 'multiply', data: { manualValues: { b: 2 } } },
        ],
        edges: [
          { id: 'e1', source: 'n', sourceHandle: 'out', target: 'double', targetHandle: 'a' },
        ],
      })

      // Simulate slider interaction by calling setInput multiple times
      const r1 = (await engine.setInput('n', 'value', 5)) as {
        changedValues: Record<string, { kind: string; value: number }>
      }
      const r2 = (await engine.setInput('n', 'value', 10)) as {
        changedValues: Record<string, { kind: string; value: number }>
      }
      return { r1, r2 }
    })

    const r = results as {
      r1: { changedValues: Record<string, { kind: string; value: number }> }
      r2: { changedValues: Record<string, { kind: string; value: number }> }
    }
    expect(r.r1.changedValues.double).toEqual({ kind: 'scalar', value: 10 })
    expect(r.r2.changedValues.double).toEqual({ kind: 'scalar', value: 20 })
  })

  test('portOverrides prevent edge values from overriding manual inputs', async ({ page }) => {
    await page.goto('/canvas')
    await waitForEngineOrFatal(page)

    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (snap: unknown) => Promise<unknown>
      }
      return engine.evaluateGraph({
        version: 1,
        nodes: [
          { id: 'src', blockType: 'number', data: { value: 99 } },
          {
            id: 'add',
            blockType: 'add',
            // manual value = 7 on port a; portOverride means edge is IGNORED for port a
            data: { manualValues: { a: 7, b: 3 }, portOverrides: { a: true } },
          },
        ],
        edges: [
          { id: 'e1', source: 'src', sourceHandle: 'out', target: 'add', targetHandle: 'a' },
        ],
      })
    })

    const r = result as { values: Record<string, { kind: string; value: number }> }
    // a = 7 (override), b = 3 (manual), sum = 10
    expect(r.values.add).toEqual({ kind: 'scalar', value: 10 })
  })
})

// ── Project-mode variables (require auth) ─────────────────────────────────────

test.fixme('variables panel shows project variables (requires auth + project)', async () => {
  // 1. Open an authenticated project
  // 2. Open variables panel (toolbar button or menu)
  // 3. Verify variables list is rendered
  // 4. Add a variable: name="x", value=42
  // 5. Verify it appears in the list
})

test.fixme('binding a variable to a node port updates evaluation (requires auth)', async () => {
  // 1. Open project with variable x=42
  // 2. Open a number node editor
  // 3. Bind port to variable "x"
  // 4. Verify node displays 42
  // 5. Change x to 100 in variables panel
  // 6. Verify node re-evaluates to 100
})

test.fixme('slider node reads variable value and updates on drag (requires auth)', async () => {
  // 1. Open project with a slider node bound to variable x
  // 2. Drag slider from min to max
  // 3. Verify downstream nodes re-evaluate on each increment
})
