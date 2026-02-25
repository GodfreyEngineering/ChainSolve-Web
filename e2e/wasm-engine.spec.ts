import { test, expect } from '@playwright/test'

// Helper: wait for engine on window and return typed handle
async function waitForEngine(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => (window as Record<string, unknown>).__chainsolve_engine != null,
    null,
    { timeout: 15_000 },
  )
}

test.describe('WASM engine (W9)', () => {
  test('engine initialises and evaluates 3 + 4 = 7', async ({ page }) => {
    await page.goto('/')
    await waitForEngine(page)

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
    await waitForEngine(page)

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

test.describe('WASM engine — catalog & handshake (W9.1)', () => {
  test('engine exposes catalog with 57+ entries and a version string', async ({ page }) => {
    await page.goto('/')
    await waitForEngine(page)

    const info = await page.evaluate(() => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        catalog: unknown[]
        engineVersion: string
      }
      return { catalogLength: engine.catalog.length, engineVersion: engine.engineVersion }
    })

    expect(info.catalogLength).toBeGreaterThanOrEqual(57)
    expect(typeof info.engineVersion).toBe('string')
    expect(info.engineVersion.length).toBeGreaterThan(0)
  })

  test('catalog contains known ops across all categories', async ({ page }) => {
    await page.goto('/')
    await waitForEngine(page)

    const opIds = await page.evaluate(() => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        catalog: { opId: string }[]
      }
      return engine.catalog.map((e) => e.opId)
    })

    // Core scalar ops
    for (const op of ['add', 'subtract', 'multiply', 'divide', 'sin', 'cos', 'pi', 'euler']) {
      expect(opIds).toContain(op)
    }
    // Data + vector + table + plot (Pro ops)
    for (const op of ['vectorInput', 'vectorSum', 'tableFilter', 'xyPlot', 'csvImport']) {
      expect(opIds).toContain(op)
    }
  })

  test('manual values on disconnected ports', async ({ page }) => {
    await page.goto('/')
    await waitForEngine(page)

    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (s: unknown) => Promise<unknown>
      }

      return engine.evaluateGraph({
        version: 1,
        nodes: [
          {
            id: 'n1',
            blockType: 'add',
            data: { manualValues: { a: 5, b: 3 } },
          },
        ],
        edges: [],
      })
    })

    const r = result as { values: Record<string, { kind: string; value: number }> }
    expect(r.values.n1).toEqual({ kind: 'scalar', value: 8 })
  })

  test('portOverrides forces manual value over edge value', async ({ page }) => {
    await page.goto('/')
    await waitForEngine(page)

    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (s: unknown) => Promise<unknown>
      }

      return engine.evaluateGraph({
        version: 1,
        nodes: [
          { id: 'n1', blockType: 'number', data: { value: 10 } },
          {
            id: 'n2',
            blockType: 'add',
            data: {
              manualValues: { a: 99, b: 1 },
              portOverrides: { a: true },
            },
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'n1',
            sourceHandle: 'out',
            target: 'n2',
            targetHandle: 'a',
          },
        ],
      })
    })

    const r = result as { values: Record<string, { kind: string; value: number }> }
    // Port 'a' is overridden to 99, port 'b' uses manual value 1 (disconnected)
    expect(r.values.n2).toEqual({ kind: 'scalar', value: 100 })
  })

  test('starter graph renders "7" in display node on canvas', async ({ page }) => {
    await page.goto('/canvas')
    await waitForEngine(page)

    // Wait for the display node to show the computed value "7"
    const display = page.locator('.react-flow__node-csDisplay')
    await expect(display.first()).toBeVisible({ timeout: 10_000 })

    // The display node should show the value 7 (from 3 + 4 starter graph)
    await expect(display.first()).toContainText('7', { timeout: 5_000 })
  })
})
