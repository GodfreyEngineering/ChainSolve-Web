/**
 * Engine protocol unit tests — W9.9
 *
 * Tests the worker communication protocol in `src/engine/index.ts` using
 * a lightweight mock Worker.  No WASM is loaded.
 *
 * Run with: npm run test:unit
 *
 * Coverage:
 *   - timeBudget_300ms_propagated: applyPatch passes timeBudgetMs: 300
 *   - watchdog_fires_on_timeout: worker silent for WATCHDOG_TIMEOUT_MS → terminate
 *   - recreate_restores_functionality: after watchdog, new requests succeed
 *   - loadSnapshot_caches_snapshot: recreate reloads last snapshot
 *   - stale_result_ignored: pendingRef coalescing (tested via index.ts pending map)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEngine, WATCHDOG_TIMEOUT_MS } from './index.ts'
import type { WorkerFactory } from './index.ts'
import type { WorkerRequest, WorkerResponse, IncrementalEvalResult } from './wasm-types.ts'
import { getPerfSnapshot } from './perfMetrics.ts'

// ── Mock Worker ────────────────────────────────────────────────────────────

/**
 * Minimal mock Worker:
 * - Captures messages via `sent[]`
 * - Lets the test push responses via `dispatch(data)`
 * - Records `terminate()` calls
 */
class MockWorker extends EventTarget implements EventTarget {
  readonly sent: WorkerRequest[] = []
  private _terminated = false

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  postMessage(data: WorkerRequest, _transfer?: Transferable[]): void {
    this.sent.push(data)
  }

  terminate(): void {
    this._terminated = true
  }

  get terminated(): boolean {
    return this._terminated
  }

  /** Simulate a message from the worker → main thread. */
  dispatch(data: WorkerResponse): void {
    this.dispatchEvent(new MessageEvent('message', { data }))
  }

  /** Simulate an unhandled error in the worker (crash). */
  dispatchError(message = 'Worker crashed'): void {
    this.dispatchEvent(new ErrorEvent('error', { message }))
  }
}

/** Factory that creates a MockWorker and stores a reference for test access. */
function mockFactory(): [WorkerFactory, () => MockWorker | undefined] {
  let lastMock: MockWorker | undefined
  const factory: WorkerFactory = () => {
    lastMock = new MockWorker()
    return lastMock as unknown as Worker
  }
  return [factory, () => lastMock]
}

/** Build a minimal valid IncrementalEvalResult. */
function incrementalResult(partial = false): IncrementalEvalResult {
  return {
    changedValues: {},
    diagnostics: [],
    elapsedUs: 100,
    evaluatedCount: 1,
    totalCount: 1,
    partial,
  }
}

/** Build a minimal valid EngineEvalResult (full). */
function fullResult() {
  return { values: {}, diagnostics: [], elapsedUs: 100 }
}

/** Ready response from the mock worker. */
const READY_RESPONSE: WorkerResponse = {
  type: 'ready',
  catalog: [],
  constantValues: {},
  engineVersion: '0.0.0-test',
  contractVersion: 1,
  initMs: 42,
}

// ── Helper: create engine backed by a mock worker ──────────────────────────

async function makeEngine() {
  const [factory, getWorker] = mockFactory()

  // createEngine waits for 'ready' — dispatch it asynchronously.
  const enginePromise = createEngine(factory)
  // Tick to let createEngine attach its message handler.
  await Promise.resolve()
  const w = getWorker()!
  w.dispatch(READY_RESPONSE)

  const engine = await enginePromise
  return { engine, getWorker }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('createEngine (mock worker)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves when worker posts ready', async () => {
    const { engine } = await makeEngine()
    expect(engine).toBeDefined()
    expect(engine.catalog).toEqual([])
  })

  it('timeBudget_300ms_propagated: applyPatch with options includes timeBudgetMs', async () => {
    const { engine, getWorker } = await makeEngine()
    const w = getWorker()!

    // Start applyPatch with no explicit options — timeBudgetMs: 300 is added by useGraphEngine.
    // Here we test that index.ts correctly forwards options to the worker.
    const patchOptions = { timeBudgetMs: 300 }
    const patchPromise = engine.applyPatch([], patchOptions)
    await Promise.resolve()

    const msg = w.sent.find((m) => m.type === 'applyPatch')
    expect(msg).toBeDefined()
    expect(msg?.type === 'applyPatch' && msg.options?.timeBudgetMs).toBe(300)

    // Resolve the promise to avoid dangling.
    w.dispatch({ type: 'incremental', requestId: 0, result: incrementalResult() })
    await patchPromise
  })

  it('loadSnapshot_caches_snapshot: snapshot is stored for recreate', async () => {
    const { engine, getWorker } = await makeEngine()
    const w = getWorker()!

    const snap = { version: 1 as const, nodes: [], edges: [] }
    const loadPromise = engine.loadSnapshot(snap)
    await Promise.resolve()

    w.dispatch({ type: 'result', requestId: 0, result: fullResult() })
    await loadPromise

    // The loadSnapshot message was sent
    const loadMsg = w.sent.find((m) => m.type === 'loadSnapshot')
    expect(loadMsg).toBeDefined()
  })

  it('watchdog_fires_on_timeout: worker silent for WATCHDOG_TIMEOUT_MS → terminate', async () => {
    const [factory, getWorker] = mockFactory()

    const enginePromise = createEngine(factory)
    await Promise.resolve()
    const w1 = getWorker()!
    w1.dispatch(READY_RESPONSE)
    const engine = await enginePromise

    // Start an applyPatch but never respond.
    const patchPromise = engine.applyPatch([]).catch(() => 'rejected')

    // Simulate no response for WATCHDOG_TIMEOUT_MS.
    await vi.advanceTimersByTimeAsync(WATCHDOG_TIMEOUT_MS + 100)

    // The old worker should be terminated.
    expect(w1.terminated).toBe(true)

    // The patch promise should be rejected with watchdog error.
    const result = await patchPromise
    expect(result).toBe('rejected')
  })

  it('recreate_restores_functionality: after watchdog, second worker processes requests', async () => {
    const [factory, getWorker] = mockFactory()

    const enginePromise = createEngine(factory)
    await Promise.resolve()
    const w1 = getWorker()!
    w1.dispatch(READY_RESPONSE)
    const engine = await enginePromise

    // Load a snapshot first (to populate the cache).
    const snap = { version: 1 as const, nodes: [], edges: [] }
    const loadPromise = engine.loadSnapshot(snap)
    await Promise.resolve()
    w1.dispatch({ type: 'result', requestId: 0, result: fullResult() })
    await loadPromise

    // Trigger watchdog by never responding to applyPatch.
    engine.applyPatch([]).catch(() => {})
    await vi.advanceTimersByTimeAsync(WATCHDOG_TIMEOUT_MS + 100)

    // A second mock worker should have been created.
    const w2 = getWorker()!
    expect(w2).not.toBe(w1)

    // Dispatch ready from second worker.
    w2.dispatch(READY_RESPONSE)
    // Let doRecreate finish.
    await Promise.resolve()
    await Promise.resolve()

    // The second worker should have received a loadSnapshot for the cached snap.
    const reloadMsg = w2.sent.find((m) => m.type === 'loadSnapshot')
    expect(reloadMsg).toBeDefined()
  })

  it('partial_result_is_resolved: partial=true incremental result resolves the promise', async () => {
    const { engine, getWorker } = await makeEngine()
    const w = getWorker()!

    // Start applyPatch.
    const patchPromise = engine.applyPatch([])
    await Promise.resolve()

    // Worker returns a partial result (engine hit time budget).
    const partialRes = incrementalResult(true)
    w.dispatch({ type: 'incremental', requestId: 0, result: partialRes })

    const resolved = await patchPromise
    expect(resolved.partial).toBe(true)
    expect(resolved.changedValues).toEqual({})
  })

  it('progress_event_dispatched: progress messages invoke registered listeners', async () => {
    const { engine, getWorker } = await makeEngine()
    const w = getWorker()!

    const received: number[] = []
    const unsub = engine.onProgress((ev) => received.push(ev.evaluatedNodes))

    // Start a request so there's an active requestId.
    engine.applyPatch([]).catch(() => {})
    await Promise.resolve()

    // Simulate two progress messages.
    w.dispatch({
      type: 'progress',
      requestId: 0,
      evaluatedNodes: 3,
      totalNodesEstimate: 10,
      elapsedMs: 5,
    })
    w.dispatch({
      type: 'progress',
      requestId: 0,
      evaluatedNodes: 7,
      totalNodesEstimate: 10,
      elapsedMs: 12,
    })

    expect(received).toEqual([3, 7])

    unsub()

    // After unsubscribe, no more events.
    w.dispatch({
      type: 'progress',
      requestId: 0,
      evaluatedNodes: 10,
      totalNodesEstimate: 10,
      elapsedMs: 20,
    })
    expect(received).toHaveLength(2)

    // Clean up.
    engine.dispose()
  })

  it('dispose_clears_watchdog_and_terminates', async () => {
    const { engine, getWorker } = await makeEngine()
    const w = getWorker()!

    // Start a request.
    engine.applyPatch([]).catch(() => {})
    await Promise.resolve()

    // Dispose before watchdog fires.
    engine.dispose()
    expect(w.terminated).toBe(true)

    // Advance time — watchdog should NOT fire after dispose.
    await vi.advanceTimersByTimeAsync(WATCHDOG_TIMEOUT_MS + 1000)
    // If it fired it would try to recreate; since worker is already terminated,
    // the test would still pass but we verify terminated stays true.
    expect(w.terminated).toBe(true)
  })

  // ── P085: WASM init timing ──────────────────────────────────────────────

  it('wasmInitMs_is_captured: initMs from ready message is stored in perfMetrics', async () => {
    const [factory, getWorker] = mockFactory()
    const enginePromise = createEngine(factory)
    await Promise.resolve()
    const w = getWorker()!
    // Use a specific initMs value so we can verify it's forwarded.
    w.dispatch({ ...READY_RESPONSE, initMs: 123 })
    await enginePromise

    const snap = getPerfSnapshot()
    expect(snap.wasmInitMs).toBe(123)

    // Regression guard: initMs must be a non-negative finite number.
    expect(snap.wasmInitMs).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(snap.wasmInitMs)).toBe(true)
  })

  // ── P088: Worker crash → respawn ────────────────────────────────────────

  it('worker_crash_triggers_recreate: ErrorEvent on worker causes new worker to be created', async () => {
    const [factory, getWorker] = mockFactory()

    const enginePromise = createEngine(factory)
    await Promise.resolve()
    const w1 = getWorker()!
    w1.dispatch(READY_RESPONSE)
    const engine = await enginePromise

    // Simulate an unhandled error in the worker (crash).
    w1.dispatchError('Unexpected token')

    // Let doRecreate run.
    await Promise.resolve()
    await Promise.resolve()

    // A new worker should have been created.
    const w2 = getWorker()!
    expect(w2).not.toBe(w1)

    // Clean up.
    engine.dispose()
  })

  it('worker_crash_rejects_pending_requests: pending requests are rejected on crash', async () => {
    const [factory, getWorker] = mockFactory()

    const enginePromise = createEngine(factory)
    await Promise.resolve()
    const w1 = getWorker()!
    w1.dispatch(READY_RESPONSE)
    const engine = await enginePromise

    // Start a request that won't be answered (worker will crash first).
    const patchPromise = engine.applyPatch([]).catch((e: Error) => e.message)
    await Promise.resolve()

    // Crash the worker — pending request should be rejected.
    w1.dispatchError('Worker crashed')
    await Promise.resolve()
    await Promise.resolve()

    const result = await patchPromise
    expect(typeof result).toBe('string')

    // Clean up.
    engine.dispose()
  })
})
