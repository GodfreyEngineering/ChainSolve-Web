/**
 * WASM engine e2e tests — W9 / W9.1 / W9.2 / W9.3
 *
 * All API tests (evaluateGraph, loadSnapshot, applyPatch, …) use the worker-scoped
 * `enginePage` fixture from helpers.ts.  The engine is initialised ONCE per worker;
 * subsequent tests reuse the same Chromium context and the already-compiled WASM
 * module — no repeated cold-compilation cost.
 *
 * The single UI test that navigates to /canvas uses the default `page` fixture so
 * it gets its own isolated browser context and does not corrupt shared state.
 */

import { expect, test } from './helpers'
import { expect as baseExpect, test as baseTest } from '@playwright/test'
import { waitForCanvasOrFatal } from './helpers'

// ── W9: Core engine ──────────────────────────────────────────────────────────

test.describe('WASM engine (W9)', () => {
  test('engine initialises and evaluates 3 + 4 = 7', async ({ enginePage: page }) => {
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

  test('engine returns diagnostics for unknown blocks', async ({ enginePage: page }) => {
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

// ── W9.1: Catalog & handshake ────────────────────────────────────────────────

test.describe('WASM engine — catalog & handshake (W9.1)', () => {
  test('engine exposes catalog with 57+ entries and a version string', async ({
    enginePage: page,
  }) => {
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

  test('catalog contains known ops across all categories', async ({ enginePage: page }) => {
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

  test('manual values on disconnected ports', async ({ enginePage: page }) => {
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

  test('portOverrides forces manual value over edge value', async ({ enginePage: page }) => {
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

  // Canvas UI test: needs to navigate to /canvas, so it uses a fresh default page
  // to avoid corrupting the shared enginePage state.
  baseTest(
    'starter graph renders "7" in display node on canvas',
    async ({ page }) => {
      await page.goto('/canvas')
      await waitForCanvasOrFatal(page)

      // The display node should show the value 7 (from 3 + 4 starter graph)
      const display = page.locator('.react-flow__node-csDisplay')
      await baseExpect(display.first()).toBeVisible()
      await baseExpect(display.first()).toContainText('7')
    },
  )
})

// ── W9.2: Incremental protocol ───────────────────────────────────────────────

test.describe('WASM engine — incremental protocol (W9.2)', () => {
  test('loadSnapshot returns full results, applyPatch returns incremental', async ({
    enginePage: page,
  }) => {
    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        loadSnapshot: (s: unknown) => Promise<unknown>
        applyPatch: (ops: unknown[]) => Promise<unknown>
      }

      // Load a snapshot — should return full results.
      const full = (await engine.loadSnapshot({
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
      })) as Record<string, unknown>

      // Apply a patch changing n1 from 3 to 10.
      const inc = (await engine.applyPatch([
        { op: 'updateNodeData', nodeId: 'n1', data: { value: 10 } },
      ])) as Record<string, unknown>

      return { full, inc }
    })

    const full = result.full as { values: Record<string, { kind: string; value: number }> }
    const inc = result.inc as {
      changedValues: Record<string, { kind: string; value: number }>
      evaluatedCount: number
      totalCount: number
    }

    // Full result should have all 3 nodes.
    expect(Object.keys(full.values)).toHaveLength(3)
    expect(full.values.add).toEqual({ kind: 'scalar', value: 7 })

    // Incremental result: n1 changed (10), add changed (14). n2 was not re-evaluated.
    expect(inc.changedValues.n1).toEqual({ kind: 'scalar', value: 10 })
    expect(inc.changedValues.add).toEqual({ kind: 'scalar', value: 14 })
    expect(inc.evaluatedCount).toBe(2) // only n1 and add
    expect(inc.totalCount).toBe(3)
  })

  test('setInput updates manual values and re-evaluates', async ({ enginePage: page }) => {
    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        loadSnapshot: (s: unknown) => Promise<unknown>
        setInput: (nodeId: string, portId: string, value: number) => Promise<unknown>
      }

      await engine.loadSnapshot({
        version: 1,
        nodes: [{ id: 'add', blockType: 'add', data: {} }],
        edges: [],
      })

      // Set inputs via setInput API.
      await engine.setInput('add', 'a', 5)
      const r = await engine.setInput('add', 'b', 3)
      return r
    })

    const r = result as {
      changedValues: Record<string, { kind: string; value: number }>
      evaluatedCount: number
    }
    expect(r.changedValues.add).toEqual({ kind: 'scalar', value: 8 })
    expect(r.evaluatedCount).toBe(1)
  })

  test('applyPatch addNode/removeNode', async ({ enginePage: page }) => {
    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        loadSnapshot: (s: unknown) => Promise<unknown>
        applyPatch: (ops: unknown[]) => Promise<unknown>
      }

      await engine.loadSnapshot({
        version: 1,
        nodes: [{ id: 'n1', blockType: 'number', data: { value: 5 } }],
        edges: [],
      })

      // Add a display node + edge.
      const addResult = (await engine.applyPatch([
        { op: 'addNode', node: { id: 'disp', blockType: 'display', data: {} } },
        {
          op: 'addEdge',
          edge: {
            id: 'e1',
            source: 'n1',
            sourceHandle: 'out',
            target: 'disp',
            targetHandle: 'value',
          },
        },
      ])) as Record<string, unknown>

      // Remove the display node.
      const removeResult = (await engine.applyPatch([
        { op: 'removeNode', nodeId: 'disp' },
      ])) as Record<string, unknown>

      return { addResult, removeResult }
    })

    const add = result.addResult as {
      changedValues: Record<string, { kind: string; value: number }>
    }
    expect(add.changedValues.disp).toEqual({ kind: 'scalar', value: 5 })

    const remove = result.removeResult as {
      changedValues: Record<string, unknown>
      totalCount: number
    }
    expect(remove.totalCount).toBe(1) // only n1 left
  })
})

// ── W9.3: Correctness contract ───────────────────────────────────────────────

test.describe('WASM engine — correctness contract (W9.3)', () => {
  test('contract version is exposed in handshake', async ({ enginePage: page }) => {
    const contractVersion = await page.evaluate(() => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        contractVersion: number
      }
      return engine.contractVersion
    })

    expect(contractVersion).toBeGreaterThanOrEqual(1)
    expect(typeof contractVersion).toBe('number')
  })

  test('scalar + vector broadcasting produces vector', async ({ enginePage: page }) => {
    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (s: unknown, opts?: unknown) => Promise<unknown>
      }

      return engine.evaluateGraph({
        version: 1,
        nodes: [
          { id: 'n1', blockType: 'number', data: { value: 10 } },
          { id: 'v1', blockType: 'vectorInput', data: { vectorData: [1, 2, 3] } },
          { id: 'add', blockType: 'add', data: {} },
        ],
        edges: [
          { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'add', targetHandle: 'a' },
          { id: 'e2', source: 'v1', sourceHandle: 'out', target: 'add', targetHandle: 'b' },
        ],
      })
    })

    const r = result as { values: Record<string, { kind: string; value: number[] }> }
    expect(r.values.add.kind).toBe('vector')
    expect(r.values.add.value).toEqual([11, 12, 13])
  })

  test('vector length mismatch produces error', async ({ enginePage: page }) => {
    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (s: unknown) => Promise<unknown>
      }

      return engine.evaluateGraph({
        version: 1,
        nodes: [
          { id: 'v1', blockType: 'vectorInput', data: { vectorData: [1, 2, 3] } },
          { id: 'v2', blockType: 'vectorInput', data: { vectorData: [4, 5] } },
          { id: 'add', blockType: 'add', data: {} },
        ],
        edges: [
          { id: 'e1', source: 'v1', sourceHandle: 'out', target: 'add', targetHandle: 'a' },
          { id: 'e2', source: 'v2', sourceHandle: 'out', target: 'add', targetHandle: 'b' },
        ],
      })
    })

    const r = result as { values: Record<string, { kind: string; message?: string }> }
    expect(r.values.add.kind).toBe('error')
    expect(r.values.add.message).toContain('length')
  })

  test('unary broadcast: sin of vector', async ({ enginePage: page }) => {
    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (s: unknown) => Promise<unknown>
      }

      return engine.evaluateGraph({
        version: 1,
        nodes: [
          { id: 'v1', blockType: 'vectorInput', data: { vectorData: [0] } },
          { id: 'sin', blockType: 'sin', data: {} },
        ],
        edges: [
          { id: 'e1', source: 'v1', sourceHandle: 'out', target: 'sin', targetHandle: 'a' },
        ],
      })
    })

    const r = result as { values: Record<string, { kind: string; value: number[] }> }
    expect(r.values.sin.kind).toBe('vector')
    expect(r.values.sin.value).toEqual([0])
  })

  test('trace mode returns trace entries', async ({ enginePage: page }) => {
    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (s: unknown, opts?: unknown) => Promise<unknown>
      }

      return engine.evaluateGraph(
        {
          version: 1,
          nodes: [
            { id: 'n1', blockType: 'number', data: { value: 5 } },
            { id: 'n2', blockType: 'number', data: { value: 3 } },
            { id: 'add', blockType: 'add', data: {} },
          ],
          edges: [
            { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'add', targetHandle: 'a' },
            { id: 'e2', source: 'n2', sourceHandle: 'out', target: 'add', targetHandle: 'b' },
          ],
        },
        { trace: true },
      )
    })

    const r = result as {
      values: Record<string, unknown>
      trace: Array<{
        nodeId: string
        opId: string
        inputs: Record<string, unknown>
        output: unknown
      }>
    }

    expect(r.trace).toBeDefined()
    expect(r.trace.length).toBe(3)

    // Trace should contain entries for all 3 nodes
    const nodeIds = r.trace.map((t) => t.nodeId).sort()
    expect(nodeIds).toEqual(['add', 'n1', 'n2'])

    // Each entry should have opId, inputs, and output
    for (const entry of r.trace) {
      expect(entry.opId).toBeTruthy()
      expect(entry.output).toBeDefined()
    }
  })

  test('time budget option is accepted and partial field is returned', async ({
    enginePage: page,
  }) => {
    // Verify that the engine accepts timeBudgetMs and returns a result
    // with the partial field. WASM evaluation is too fast (~0.1ms for
    // simple graphs) to reliably trigger a timeout in e2e, so we just
    // verify the protocol works.
    const result = await page.evaluate(async () => {
      const engine = (window as Record<string, unknown>).__chainsolve_engine as {
        evaluateGraph: (s: unknown, opts?: unknown) => Promise<unknown>
      }

      return engine.evaluateGraph(
        {
          version: 1,
          nodes: [
            { id: 'n1', blockType: 'number', data: { value: 1 } },
            { id: 'n2', blockType: 'number', data: { value: 2 } },
            { id: 'add', blockType: 'add', data: {} },
          ],
          edges: [
            { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'add', targetHandle: 'a' },
            { id: 'e2', source: 'n2', sourceHandle: 'out', target: 'add', targetHandle: 'b' },
          ],
        },
        { timeBudgetMs: 5000 }, // generous budget — should complete fully
      )
    })

    const r = result as { partial: boolean; values: Record<string, { kind: string; value: number }> }
    expect(typeof r.partial).toBe('boolean')
    expect(r.partial).toBe(false) // small graph finishes within budget
    expect(r.values.add).toEqual({ kind: 'scalar', value: 3 })
  })
})
