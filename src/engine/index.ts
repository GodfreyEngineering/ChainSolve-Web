/**
 * Single app-facing API for the WASM compute engine.
 *
 * Usage:
 *   const engine = await createEngine()
 *   const result = await engine.evaluateGraph(snapshot)
 *   engine.dispose()
 *
 * If WASM fails to load the promise rejects with a descriptive error.
 * The caller (boot/main) should catch and degrade gracefully.
 *
 * W9.9 additions:
 *   - 5-second watchdog: terminates and recreates the worker if no response
 *     arrives within WATCHDOG_TIMEOUT_MS. Handles WASM hangs / infinite loops.
 *   - Snapshot cache: the last loadSnapshot args are stored so the worker can
 *     be automatically reloaded after recreation.
 *   - createEngine accepts an optional workerFactory for testing.
 */

import type {
  EngineSnapshotV1,
  EngineEvalResult,
  IncrementalEvalResult,
  PatchOp,
  CatalogEntry,
  EvalOptions,
  EngineStats,
  WorkerRequest,
  WorkerResponse,
} from './wasm-types.ts'

export type {
  EngineSnapshotV1,
  EngineEvalResult,
  IncrementalEvalResult,
  PatchOp,
  CatalogEntry,
  EvalOptions,
  EngineStats,
} from './wasm-types.ts'

import { dlog } from '../observability/debugLog.ts'

export interface ProgressEvent {
  requestId: number
  evaluatedNodes: number
  totalNodesEstimate: number
  elapsedMs: number
}

export interface EngineAPI {
  /** Evaluate a graph snapshot via Rust/WASM (async, off-main-thread). */
  evaluateGraph(snapshot: EngineSnapshotV1, options?: EvalOptions): Promise<EngineEvalResult>
  /** Load a full snapshot into the persistent engine graph. Returns full results. */
  loadSnapshot(snapshot: EngineSnapshotV1, options?: EvalOptions): Promise<EngineEvalResult>
  /** Apply incremental patch ops. Returns only changed values. */
  applyPatch(ops: PatchOp[], options?: EvalOptions): Promise<IncrementalEvalResult>
  /** Set a manual input on a node port. Returns only changed values. */
  setInput(nodeId: string, portId: string, value: number): Promise<IncrementalEvalResult>
  /** Register a large dataset for zero-copy transfer. Fire-and-forget. */
  registerDataset(id: string, data: Float64Array): void
  /** Release a previously registered dataset. */
  releaseDataset(id: string): void
  /** Ops catalog received from the WASM engine on startup. */
  readonly catalog: CatalogEntry[]
  /** Pre-computed constant values for zero-input source blocks (W12.2). */
  readonly constantValues: Record<string, number>
  /** Engine version string from Rust crate. */
  readonly engineVersion: string
  /** Engine contract version (bumped on correctness policy changes). */
  readonly contractVersion: number
  /** Query dataset registry stats from the WASM engine. */
  getStats(): Promise<EngineStats>
  /** Subscribe to progress events. Returns unsubscribe function. */
  onProgress(handler: (event: ProgressEvent) => void): () => void
  /** Terminate the worker. After this call, the engine cannot be used. */
  dispose(): void
}

// ── Watchdog constant ─────────────────────────────────────────────────────

/** Milliseconds before the watchdog kills and recreates the worker. */
export const WATCHDOG_TIMEOUT_MS = 5_000

// ── Worker factory type ───────────────────────────────────────────────────

/** Factory function that creates a new Worker instance. Injectable for tests. */
export type WorkerFactory = () => Worker

const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })

// ── Helpers ───────────────────────────────────────────────────────────────

/** Wait for a worker to post 'ready', or reject on init-error / timeout. */
function waitForWorkerReady(
  w: Worker,
  onReady?: (catalog: CatalogEntry[], constantValues: Record<string, number>, engineVersion: string, contractVersion: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('WASM engine init timed out after 10 s'))
    }, 10_000)

    function handler(e: MessageEvent<WorkerResponse>) {
      if (e.data.type === 'ready') {
        onReady?.(e.data.catalog, e.data.constantValues, e.data.engineVersion, e.data.contractVersion)
        cleanup()
        resolve()
      } else if (e.data.type === 'init-error') {
        cleanup()
        reject(new Error(`[${e.data.error.code}] ${e.data.error.message}`))
      }
    }

    function cleanup() {
      clearTimeout(timeout)
      w.removeEventListener('message', handler)
    }

    w.addEventListener('message', handler)
  })
}

// ── createEngine ──────────────────────────────────────────────────────────

/**
 * Create and initialize the WASM engine worker.
 *
 * Resolves when the worker reports 'ready' (WASM loaded successfully).
 * Rejects if WASM fails to initialize.
 *
 * @param factory Optional worker factory for testing (default: real Worker).
 */
export async function createEngine(factory?: WorkerFactory): Promise<EngineAPI> {
  const workerFactory = factory ?? defaultWorkerFactory

  // ── Mutable state ──────────────────────────────────────────────────────
  let worker = workerFactory()
  let nextId = 0
  let disposed = false
  let isRecreating = false

  // Snapshot cache: stores args from the last loadSnapshot call so we can
  // reload after a worker recreation.
  let lastSnapshotArgs: { snapshot: EngineSnapshotV1; options?: EvalOptions } | null = null

  // Watchdog timer: cleared on every response, set before each eval request.
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null

  type PendingEntry =
    | { kind: 'full'; resolve: (r: EngineEvalResult) => void; reject: (e: Error) => void }
    | {
        kind: 'incremental'
        resolve: (r: IncrementalEvalResult) => void
        reject: (e: Error) => void
      }
    | { kind: 'stats'; resolve: (r: EngineStats) => void; reject: (e: Error) => void }

  const pending = new Map<number, PendingEntry>()
  const progressListeners = new Set<(event: ProgressEvent) => void>()

  // ── Watchdog ──────────────────────────────────────────────────────────

  function clearWatchdog() {
    if (watchdogTimer !== null) {
      clearTimeout(watchdogTimer)
      watchdogTimer = null
    }
  }

  function startWatchdog(requestId: number) {
    clearWatchdog()
    watchdogTimer = setTimeout(() => {
      console.warn(`[cs:engine] Watchdog fired — requestId=${requestId}, recreating worker`)
      dlog.warn('engine', 'Watchdog fired — recreating worker', { requestId, timeoutMs: WATCHDOG_TIMEOUT_MS })
      void doRecreate()
    }, WATCHDOG_TIMEOUT_MS)
  }

  // ── Message handler ───────────────────────────────────────────────────

  function setupMessageHandler(w: Worker) {
    w.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      // Ignore messages from the old worker after recreation.
      if (w !== worker) return

      const msg = e.data

      if (msg.type === 'progress') {
        const event: ProgressEvent = {
          requestId: msg.requestId,
          evaluatedNodes: msg.evaluatedNodes,
          totalNodesEstimate: msg.totalNodesEstimate,
          elapsedMs: msg.elapsedMs,
        }
        for (const listener of progressListeners) {
          listener(event)
        }
        return
      }

      if (msg.type === 'stats') {
        clearWatchdog()
        const p = pending.get(msg.requestId)
        if (!p) return
        pending.delete(msg.requestId)
        if (p.kind === 'stats') {
          p.resolve(msg.stats)
        }
        return
      }

      if (msg.type === 'result' || msg.type === 'incremental' || msg.type === 'error') {
        clearWatchdog()
        const p = pending.get(msg.requestId)
        if (!p) return
        pending.delete(msg.requestId)

        if (msg.type === 'error') {
          p.reject(new Error(`[${msg.error.code}] ${msg.error.message}`))
        } else if (msg.type === 'result' && p.kind === 'full') {
          p.resolve(msg.result)
        } else if (msg.type === 'incremental' && p.kind === 'incremental') {
          p.resolve(msg.result)
        }
      }
    })
  }

  // ── Worker recreation ─────────────────────────────────────────────────

  async function doRecreate(): Promise<void> {
    if (isRecreating || disposed) return
    isRecreating = true
    clearWatchdog()

    // Terminate old worker and reject all pending requests.
    worker.terminate()
    const watchdogError = new Error('[WORKER_WATCHDOG] Worker unresponsive — recreating')
    for (const [, p] of pending) {
      p.reject(watchdogError)
    }
    pending.clear()

    try {
      // Create a fresh worker and wait for it to be ready.
      const newWorker = workerFactory()
      await waitForWorkerReady(newWorker)
      worker = newWorker
      setupMessageHandler(worker)
      dlog.info('engine', 'Worker recreated', { snapshotRestored: !!lastSnapshotArgs })

      // Reload the last snapshot so the worker's engine state is consistent.
      if (lastSnapshotArgs) {
        const id = nextId++
        // Fire-and-forget: we only need the worker state restored, not the result.
        pending.set(id, {
          kind: 'full',
          resolve: () => {},
          reject: () => {},
        })
        worker.postMessage({
          type: 'loadSnapshot',
          requestId: id,
          snapshot: lastSnapshotArgs.snapshot,
        } satisfies WorkerRequest)
      }
    } catch (err) {
      console.error('[cs:engine] Worker recreation failed:', err)
      dlog.error('engine', 'Worker recreation failed', { error: String(err) })
    } finally {
      isRecreating = false
    }
  }

  // ── Initial worker setup ──────────────────────────────────────────────

  let catalog: CatalogEntry[] = []
  let constantValues: Record<string, number> = {}
  let engineVersion = ''
  let contractVersion = 0

  await waitForWorkerReady(worker, (c, cv, ev, contractV) => {
    catalog = c
    constantValues = cv
    engineVersion = ev
    contractVersion = contractV
  })

  setupMessageHandler(worker)
  dlog.info('engine', 'Worker ready', { engineVersion, contractVersion, catalogSize: catalog.length })

  // ── postRequest ───────────────────────────────────────────────────────

  function postRequest(msg: WorkerRequest) {
    worker.postMessage(msg)
  }

  // ── Public API ────────────────────────────────────────────────────────

  return {
    evaluateGraph(snapshot, options) {
      return new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { kind: 'full', resolve, reject })
        startWatchdog(id)
        postRequest({ type: 'evaluate', requestId: id, snapshot, options })
      })
    },

    loadSnapshot(snapshot, options) {
      lastSnapshotArgs = { snapshot, options }
      return new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { kind: 'full', resolve, reject })
        startWatchdog(id)
        postRequest({ type: 'loadSnapshot', requestId: id, snapshot, options })
      })
    },

    applyPatch(ops, options) {
      return new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { kind: 'incremental', resolve, reject })
        startWatchdog(id)
        postRequest({ type: 'applyPatch', requestId: id, ops, options })
      })
    },

    setInput(nodeId, portId, value) {
      return new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { kind: 'incremental', resolve, reject })
        startWatchdog(id)
        postRequest({ type: 'setInput', requestId: id, nodeId, portId, value })
      })
    },

    getStats() {
      return new Promise<EngineStats>((resolve, reject) => {
        const id = nextId++
        pending.set(id, { kind: 'stats', resolve, reject })
        startWatchdog(id)
        postRequest({ type: 'getStats', requestId: id })
      })
    },

    registerDataset(id, data) {
      const buffer = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength,
      ) as ArrayBuffer
      worker.postMessage(
        { type: 'registerDataset', datasetId: id, buffer } satisfies WorkerRequest,
        [buffer],
      )
    },

    releaseDataset(id) {
      worker.postMessage({ type: 'releaseDataset', datasetId: id } satisfies WorkerRequest)
    },

    catalog,
    constantValues,
    engineVersion,
    contractVersion,

    onProgress(handler) {
      progressListeners.add(handler)
      return () => {
        progressListeners.delete(handler)
      }
    },

    dispose() {
      disposed = true
      clearWatchdog()
      worker.terminate()
      for (const [, p] of pending) {
        p.reject(new Error('Engine disposed'))
      }
      pending.clear()
    },
  }
}
