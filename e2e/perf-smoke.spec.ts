/**
 * e2e/perf-smoke.spec.ts — Scheduled performance smoke tests.
 *
 * Playwright project: `perf`
 * Schedule: Monday 03:00 UTC (see .github/workflows/perf.yml)
 * NOT PR-gated — nightly health check only.
 *
 * What it tests:
 *   1. Engine boot time (page load → engine-ready sentinel) < 10 s
 *   2. applyPatch round-trip p50 < 500 ms on a 2 000-node chain
 *   3. applyPatch round-trip p95 < 1 000 ms on a 2 000-node chain
 *
 * The test uses `window.__chainsolve_engine` (exposed by the app at '/') to
 * call the engine API directly — no UI interaction required.
 */

import { test, expect } from '@playwright/test'
import { waitForEngineOrFatal } from './helpers'

// ── Inline chain generator ─────────────────────────────────────────────────
//
// Generates a linear chain: number(1) → negate → negate → ... (N nodes).
// Self-contained so this spec has no import dependencies on perf/ or src/.

interface EngineNode {
  id: string
  blockType: string
  data: Record<string, unknown>
}
interface EngineEdge {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}
interface EngineSnapshot {
  version: 1
  nodes: EngineNode[]
  edges: EngineEdge[]
}

function makeChain(n: number): EngineSnapshot {
  const nodes: EngineNode[] = [{ id: 'n0', blockType: 'number', data: { value: 1.0 } }]
  const edges: EngineEdge[] = []
  for (let i = 1; i < n; i++) {
    nodes.push({ id: `n${i}`, blockType: 'negate', data: {} })
    edges.push({
      id: `e${i}`,
      source: `n${i - 1}`,
      sourceHandle: 'out',
      target: `n${i}`,
      targetHandle: 'a',
    })
  }
  return { version: 1, nodes, edges }
}

// ── Engine API shape (for page.evaluate typing) ───────────────────────────

interface EngineAPI {
  loadSnapshot(snap: EngineSnapshot): Promise<unknown>
  applyPatch(ops: unknown[]): Promise<unknown>
}

// ── Helpers ───────────────────────────────────────────────────────────────

function percentile(sortedArr: number[], p: number): number {
  const idx = Math.min(Math.floor(sortedArr.length * p), sortedArr.length - 1)
  return sortedArr[idx]
}

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe('Performance smoke', () => {
  test('engine boot < 10 s', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    const t0 = Date.now()
    await page.goto('/')
    await waitForEngineOrFatal(page, consoleErrors)
    const bootMs = Date.now() - t0

    // eslint-disable-next-line no-console
    console.log(`Engine boot: ${bootMs} ms`)
    expect(bootMs).toBeLessThan(10_000)
  })

  test('applyPatch 2k-chain p50 < 500 ms, p95 < 1000 ms', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/')
    await waitForEngineOrFatal(page, consoleErrors)

    const chain2k = makeChain(2_000)

    // Run timing measurements inside the browser where the engine lives.
    const timingsRaw = await page.evaluate(
      async ({
        snap,
        PATCH_ROUNDS,
      }: {
        snap: EngineSnapshot
        PATCH_ROUNDS: number
      }) => {
        const engine = (window as Record<string, unknown>).__chainsolve_engine as EngineAPI

        // Load the 2k chain snapshot.
        await engine.loadSnapshot(snap)

        const durations: number[] = []
        for (let i = 0; i < PATCH_ROUNDS; i++) {
          const t = performance.now()
          await engine.applyPatch([{ op: 'updateNodeData', nodeId: 'n0', data: { value: i } }])
          durations.push(performance.now() - t)
        }

        // Return sorted for percentile calculation in Node.js.
        return durations.sort((a, b) => a - b)
      },
      { snap: chain2k, PATCH_ROUNDS: 20 },
    )

    const timings = timingsRaw as number[]
    const p50 = percentile(timings, 0.5)
    const p95 = percentile(timings, 0.95)
    const min = timings[0]
    const max = timings[timings.length - 1]

    // eslint-disable-next-line no-console
    console.log(
      `applyPatch 2k-chain (${timings.length} rounds): ` +
        `min=${min.toFixed(1)}ms p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms max=${max.toFixed(1)}ms`,
    )

    expect(p50).toBeLessThan(500)
    expect(p95).toBeLessThan(1_000)
  })
})
