/**
 * useCanvasEngine — acquire a dedicated engine for a canvas from the pool.
 *
 * Returns the primary (global) engine immediately, then upgrades to a
 * canvas-specific pool engine once it has finished initializing.
 * The `engineSwitchCount` increments each time the underlying engine
 * switches, so callers can use it as a `refreshKey` to force a snapshot reload.
 */

import { useEffect, useRef, useState } from 'react'
import type { EngineAPI } from '../engine/index.ts'
import { useWorkerPool } from '../contexts/WorkerPoolContext.ts'
import { EngineEvictedError } from '../engine/workerPool.ts'

export interface CanvasEngineResult {
  /** The engine to use for this canvas (primary until dedicated is ready). */
  engine: EngineAPI
  /**
   * Increments each time the engine upgrades from primary → dedicated.
   * Use as a `refreshKey` to force a full snapshot reload in the new engine.
   */
  engineSwitchCount: number
}

interface CanvasEngineState {
  dedicatedEngine: EngineAPI | null
  engineSwitchCount: number
}

/**
 * Get the best available engine for a canvas.
 *
 * @param canvasId Canvas ID to acquire a dedicated worker for. When undefined
 *   (scratch mode), always returns the primary engine.
 * @param primaryEngine The global singleton engine from EngineContext.
 */
export function useCanvasEngine(
  canvasId: string | undefined,
  primaryEngine: EngineAPI,
): CanvasEngineResult {
  const pool = useWorkerPool()
  const [{ dedicatedEngine, engineSwitchCount }, setEngineState] = useState<CanvasEngineState>({
    dedicatedEngine: null,
    engineSwitchCount: 0,
  })

  // Tracks the current canvasId for stale-result rejection in the async callback.
  const activeCanvasIdRef = useRef<string | undefined>(undefined)
  // Monotonically-increasing counter to detect superseded acquireEngine calls.
  const generationRef = useRef(0)

  useEffect(() => {
    // No pool or scratch mode — primary engine is used, nothing to acquire.
    if (!pool || !canvasId) {
      activeCanvasIdRef.current = canvasId
      return
    }

    // Same canvas as before — nothing to do.
    if (canvasId === activeCanvasIdRef.current) return

    const prevCanvasId = activeCanvasIdRef.current
    activeCanvasIdRef.current = canvasId
    const generation = ++generationRef.current

    // Mark previous canvas as LRU so it can be evicted when pool is full.
    if (prevCanvasId) pool.releaseCanvas(prevCanvasId)

    // Acquire a dedicated engine for this canvas.
    // setState is called only in the async callback, satisfying the
    // react-hooks/set-state-in-effect lint rule.
    pool
      .acquireEngine(canvasId)
      .then((eng) => {
        // Guard: canvasId may have changed while we were waiting.
        if (generationRef.current !== generation) return
        setEngineState((prev) => ({
          dedicatedEngine: eng,
          engineSwitchCount: prev.engineSwitchCount + 1,
        }))
      })
      .catch((err) => {
        // EngineEvictedError is expected during project/canvas switching —
        // the canvas was navigated away from before its engine finished init.
        if (err instanceof EngineEvictedError) return
        console.error('[useCanvasEngine] Engine acquisition failed:', err)
      })

    // Cleanup: release the canvas worker on unmount or canvasId change
    return () => {
      if (canvasId) pool.releaseCanvas(canvasId)
    }
  }, [canvasId, pool])

  return {
    engine: dedicatedEngine ?? primaryEngine,
    engineSwitchCount,
  }
}
