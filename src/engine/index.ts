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
 */

import type {
  EngineSnapshotV1,
  EngineEvalResult,
  IncrementalEvalResult,
  PatchOp,
  CatalogEntry,
  EvalOptions,
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
} from './wasm-types.ts'

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
  /** Engine version string from Rust crate. */
  readonly engineVersion: string
  /** Engine contract version (bumped on correctness policy changes). */
  readonly contractVersion: number
  /** Subscribe to progress events. Returns unsubscribe function. */
  onProgress(handler: (event: ProgressEvent) => void): () => void
  /** Terminate the worker. After this call, the engine cannot be used. */
  dispose(): void
}

/**
 * Create and initialize the WASM engine worker.
 *
 * Resolves when the worker reports 'ready' (WASM loaded successfully).
 * Rejects if WASM fails to initialize.
 */
export async function createEngine(): Promise<EngineAPI> {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })

  // Wait for the worker to signal readiness.
  let catalog: CatalogEntry[] = []
  let engineVersion = ''
  let contractVersion = 0
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('WASM engine init timed out after 10 s'))
    }, 10_000)

    function handler(e: MessageEvent<WorkerResponse>) {
      if (e.data.type === 'ready') {
        catalog = e.data.catalog
        engineVersion = e.data.engineVersion
        contractVersion = e.data.contractVersion
        cleanup()
        resolve()
      } else if (e.data.type === 'init-error') {
        cleanup()
        reject(new Error(`[${e.data.error.code}] ${e.data.error.message}`))
      }
    }

    function cleanup() {
      clearTimeout(timeout)
      worker.removeEventListener('message', handler)
    }

    worker.addEventListener('message', handler)
  })

  // Request/response bookkeeping.
  // Pending map supports both full results (EngineEvalResult) and incremental results.
  let nextId = 0
  type PendingEntry =
    | { kind: 'full'; resolve: (r: EngineEvalResult) => void; reject: (e: Error) => void }
    | {
        kind: 'incremental'
        resolve: (r: IncrementalEvalResult) => void
        reject: (e: Error) => void
      }
  const pending = new Map<number, PendingEntry>()

  // Progress event subscribers.
  const progressListeners = new Set<(event: ProgressEvent) => void>()

  worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
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

    if (msg.type === 'result' || msg.type === 'incremental' || msg.type === 'error') {
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

  function postRequest(msg: WorkerRequest) {
    worker.postMessage(msg)
  }

  return {
    evaluateGraph(snapshot, options) {
      return new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { kind: 'full', resolve, reject })
        postRequest({ type: 'evaluate', requestId: id, snapshot, options })
      })
    },

    loadSnapshot(snapshot, options) {
      return new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { kind: 'full', resolve, reject })
        postRequest({ type: 'loadSnapshot', requestId: id, snapshot, options })
      })
    },

    applyPatch(ops, options) {
      return new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { kind: 'incremental', resolve, reject })
        postRequest({ type: 'applyPatch', requestId: id, ops, options })
      })
    },

    setInput(nodeId, portId, value) {
      return new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { kind: 'incremental', resolve, reject })
        postRequest({ type: 'setInput', requestId: id, nodeId, portId, value })
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
    engineVersion,
    contractVersion,

    onProgress(handler) {
      progressListeners.add(handler)
      return () => {
        progressListeners.delete(handler)
      }
    },

    dispose() {
      worker.terminate()
      for (const [, p] of pending) {
        p.reject(new Error('Engine disposed'))
      }
      pending.clear()
    },
  }
}
