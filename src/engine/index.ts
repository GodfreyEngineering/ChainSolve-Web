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
  WorkerResponse,
} from './wasm-types.ts'

export type { EngineSnapshotV1, EngineEvalResult } from './wasm-types.ts'

export interface EngineAPI {
  /** Evaluate a graph snapshot via Rust/WASM (async, off-main-thread). */
  evaluateGraph(snapshot: EngineSnapshotV1): Promise<EngineEvalResult>
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
  const worker = new Worker(
    new URL('./worker.ts', import.meta.url),
    { type: 'module' },
  )

  // Wait for the worker to signal readiness.
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('WASM engine init timed out after 10 s'))
    }, 10_000)

    function handler(e: MessageEvent<WorkerResponse>) {
      if (e.data.type === 'ready') {
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
  let nextId = 0
  const pending = new Map<
    number,
    { resolve: (r: EngineEvalResult) => void; reject: (e: Error) => void }
  >()

  worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data
    if (msg.type === 'result' || msg.type === 'error') {
      const p = pending.get(msg.requestId)
      if (!p) return
      pending.delete(msg.requestId)

      if (msg.type === 'result') {
        p.resolve(msg.result)
      } else {
        p.reject(new Error(`[${msg.error.code}] ${msg.error.message}`))
      }
    }
  })

  return {
    evaluateGraph(snapshot) {
      return new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { resolve, reject })
        worker.postMessage({ type: 'evaluate', requestId: id, snapshot })
      })
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
