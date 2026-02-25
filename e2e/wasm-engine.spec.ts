import { test, expect } from '@playwright/test'

test.describe('WASM engine (W9)', () => {
  test('engine initialises and evaluates 3 + 4 = 7', async ({ page }) => {
    await page.goto('/')

    // Wait for the WASM engine to be ready (set by main.tsx).
    await page.waitForFunction(
      () => (window as Record<string, unknown>).__chainsolve_engine != null,
      null,
      { timeout: 15_000 },
    )

    // Call evaluateGraph through the worker and verify the result.
    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (s: unknown) => Promise<unknown>
      }

      return engine.evaluateGraph({
        version: 1,
        nodes: [
          { id: 'n1', blockType: 'number', data: { value: 3 } },
          { id: 'n2', blockType: 'number', data: { value: 4 } },
          { id: 'n3', blockType: 'add', data: {} },
        ],
        edges: [
          {
            id: 'e1',
            source: 'n1',
            sourceHandle: 'out',
            target: 'n3',
            targetHandle: 'a',
          },
          {
            id: 'e2',
            source: 'n2',
            sourceHandle: 'out',
            target: 'n3',
            targetHandle: 'b',
          },
        ],
      })
    })

    const r = result as {
      values: Record<string, { kind: string; value: number }>
      diagnostics: unknown[]
      elapsedUs: number
    }

    expect(r.values.n1).toEqual({ kind: 'scalar', value: 3 })
    expect(r.values.n2).toEqual({ kind: 'scalar', value: 4 })
    expect(r.values.n3).toEqual({ kind: 'scalar', value: 7 })
    expect(r.diagnostics).toEqual([])
    expect(typeof r.elapsedUs).toBe('number')
  })

  test('engine returns diagnostics for unknown blocks', async ({ page }) => {
    await page.goto('/')

    await page.waitForFunction(
      () => (window as Record<string, unknown>).__chainsolve_engine != null,
      null,
      { timeout: 15_000 },
    )

    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (s: unknown) => Promise<unknown>
      }

      return engine.evaluateGraph({
        version: 1,
        nodes: [{ id: 'x', blockType: 'doesNotExist', data: {} }],
        edges: [],
      })
    })

    const r = result as {
      values: Record<string, { kind: string; message?: string }>
      diagnostics: { code: string }[]
    }

    expect(r.values.x.kind).toBe('error')
    expect(r.diagnostics.length).toBeGreaterThan(0)
    expect(r.diagnostics[0].code).toBe('UNKNOWN_BLOCK')
  })
})
