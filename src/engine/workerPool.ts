/**
 * Worker pool for parallel canvas evaluation (ENG-04).
 *
 * Manages up to N WASM engine workers so that multiple canvases can evaluate
 * simultaneously (e.g. in tiled view, or as background canvases).
 *
 * Pool size: Math.min(navigator.hardwareConcurrency - 1, 4), minimum 1.
 *
 * Each canvas gets its own dedicated worker via acquireEngine(canvasId).
 * The WASM engine keeps per-canvas graph state in the worker, so switching
 * back to a canvas does not require a full snapshot reload.
 *
 * When the pool is at capacity and a new canvas needs a worker, the
 * least-recently-used canvas's worker is evicted (disposed).
 *
 * releaseCanvas(canvasId) marks a canvas as inactive (for LRU ordering) but
 * does NOT dispose the worker — the graph state is preserved for fast re-entry.
 */

import { createEngine, type EngineAPI, type WorkerFactory } from './index.ts'

// ── Pool size ────────────────────────────────────────────────────────────────

function defaultMaxPoolSize(): number {
  const concurrency =
    typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
      ? navigator.hardwareConcurrency
      : 4
  return Math.max(1, Math.min(concurrency - 1, 4))
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface WorkerPoolStats {
  poolSize: number
  maxSize: number
  /** canvasIds currently assigned to a worker, in MRU order. */
  assignedCanvases: string[]
}

export interface WorkerPoolAPI {
  /**
   * Get or create a dedicated engine for the given canvas.
   *
   * Resolves with the engine when it is ready. If an engine already exists
   * for this canvas it is returned immediately (no re-initialization).
   * The engine maintains its own WASM graph state across calls.
   */
  acquireEngine(canvasId: string): Promise<EngineAPI>

  /**
   * Mark a canvas as inactive (updates LRU order).
   * The worker is NOT disposed — its graph state is preserved.
   * Call this when a canvas tab is hidden/unmounted so it becomes
   * a lower-priority candidate for eviction.
   */
  releaseCanvas(canvasId: string): void

  /** Immediately dispose the engine for a canvas and free the worker slot. */
  evictCanvas(canvasId: string): void

  /** Dispose all workers. After this call the pool cannot be used. */
  dispose(): void

  /** Current pool statistics for diagnostics. */
  readonly stats: WorkerPoolStats
}

// ── createWorkerPool ─────────────────────────────────────────────────────────

/**
 * Create a new worker pool.
 *
 * @param factory Optional worker factory for testing.
 * @param maxWorkers Override the pool size (default: hardwareConcurrency-based).
 */
export function createWorkerPool(
  factory?: WorkerFactory,
  maxWorkers: number = defaultMaxPoolSize(),
): WorkerPoolAPI {
  // canvasId → resolved engine (fully initialized, ready to use)
  const engines = new Map<string, EngineAPI>()

  // canvasId → in-flight initialization promise (not yet ready)
  const pending = new Map<string, Promise<EngineAPI>>()

  // LRU order: head = most-recently used, tail = least-recently used.
  // Contains all canvasIds that currently have an assigned worker slot
  // (engines map). Does NOT include pending-initialization canvases.
  const lruOrder: string[] = []

  let disposed = false

  // ── LRU helpers ────────────────────────────────────────────────────────

  function touch(canvasId: string) {
    const idx = lruOrder.indexOf(canvasId)
    if (idx !== -1) lruOrder.splice(idx, 1)
    lruOrder.unshift(canvasId) // move to front (MRU)
  }

  function evictLru() {
    // Evict the least-recently-used canvas (tail of lruOrder)
    const victim = lruOrder[lruOrder.length - 1]
    if (victim !== undefined) {
      evictCanvas(victim)
    }
  }

  // ── Pool API ───────────────────────────────────────────────────────────

  async function acquireEngine(canvasId: string): Promise<EngineAPI> {
    if (disposed) throw new Error('WorkerPool has been disposed')

    // Already have a ready engine for this canvas.
    const existing = engines.get(canvasId)
    if (existing) {
      touch(canvasId)
      return existing
    }

    // Already initializing — return the in-flight promise.
    const inFlight = pending.get(canvasId)
    if (inFlight) {
      return inFlight
    }

    // Need to create a new engine. Evict LRU if at capacity.
    const totalSlots = engines.size + pending.size
    if (totalSlots >= maxWorkers) {
      // Only evict ready engines (pending ones are still starting up).
      if (engines.size > 0) {
        evictLru()
      }
      // If still over capacity (only pending slots), we create anyway —
      // better to have a briefly over-capacity pool than to block the canvas.
    }

    const p = createEngine(factory).then((eng) => {
      if (disposed) {
        eng.dispose()
        throw new Error('WorkerPool disposed during engine initialization')
      }
      pending.delete(canvasId)
      engines.set(canvasId, eng)
      touch(canvasId)
      return eng
    })

    pending.set(canvasId, p)
    return p
  }

  function releaseCanvas(canvasId: string): void {
    // Move to LRU tail so it gets evicted first when pool is full.
    const idx = lruOrder.indexOf(canvasId)
    if (idx !== -1) {
      lruOrder.splice(idx, 1)
      lruOrder.push(canvasId) // move to tail (LRU)
    }
  }

  function evictCanvas(canvasId: string): void {
    const eng = engines.get(canvasId)
    if (eng) {
      eng.dispose()
      engines.delete(canvasId)
    }
    // Cancel pending (the promise will reject after disposal is set)
    pending.delete(canvasId)
    const idx = lruOrder.indexOf(canvasId)
    if (idx !== -1) lruOrder.splice(idx, 1)
  }

  function dispose(): void {
    disposed = true
    for (const eng of engines.values()) {
      eng.dispose()
    }
    engines.clear()
    pending.clear()
    lruOrder.length = 0
  }

  return {
    acquireEngine,
    releaseCanvas,
    evictCanvas,
    dispose,
    get stats(): WorkerPoolStats {
      return {
        poolSize: engines.size + pending.size,
        maxSize: maxWorkers,
        assignedCanvases: [...lruOrder],
      }
    },
  }
}
