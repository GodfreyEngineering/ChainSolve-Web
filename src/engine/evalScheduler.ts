/**
 * EvalScheduler — controls when accumulated patch ops are dispatched to the
 * WASM engine based on the current evaluation mode.
 *
 * Three modes:
 *   - auto:     dispatch after PATCH_DEBOUNCE_MS (structural changes bypass debounce)
 *   - deferred: dispatch after 2s idle (requestIdleCallback) or on explicit flush
 *   - manual:   dispatch only on explicit flush (Run button)
 *
 * The scheduler is a plain class (not a React hook) so it can be instantiated
 * once per hook lifetime and disposed on cleanup.
 */

import type { PatchOp } from './wasm-types.ts'

export type EvalMode = 'auto' | 'deferred' | 'manual'

const PATCH_DEBOUNCE_MS = 50
const DEFERRED_IDLE_TIMEOUT_MS = 2000

/**
 * Returns true when at least one op is a structural change (add/remove
 * node or edge). Structural ops require immediate dispatch so the engine
 * graph stays consistent.
 */
function hasStructuralChange(ops: PatchOp[]): boolean {
  return ops.some((op) => op.op !== 'updateNodeData')
}

export class EvalScheduler {
  private _mode: EvalMode
  private _pendingOps: PatchOp[] = []
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null
  private _idleHandle: number | null = null
  private _idleFallbackTimer: ReturnType<typeof setTimeout> | null = null
  private _onFlush: ((ops: PatchOp[]) => void) | null = null
  private _onPendingChange: ((count: number) => void) | null = null
  private _disposed = false

  constructor(mode: EvalMode = 'auto') {
    this._mode = mode
  }

  get mode(): EvalMode {
    return this._mode
  }

  set mode(m: EvalMode) {
    this._mode = m
    // If switching to auto and there are pending ops, schedule them
    if (m === 'auto' && this._pendingOps.length > 0) {
      this._scheduleAuto(hasStructuralChange(this._pendingOps))
    }
  }

  get pendingCount(): number {
    return this._pendingOps.length
  }

  /** Register the callback that dispatches ops to the engine. */
  onFlush(cb: (ops: PatchOp[]) => void): void {
    this._onFlush = cb
  }

  /** Register a callback for when pendingCount changes (for UI updates). */
  onPendingChange(cb: (count: number) => void): void {
    this._onPendingChange = cb
  }

  /**
   * Enqueue patch ops. The scheduler decides when to dispatch based on mode.
   */
  enqueue(ops: PatchOp[]): void {
    if (this._disposed || ops.length === 0) return

    this._pendingOps.push(...ops)
    this._notifyPending()

    const structural = hasStructuralChange(ops)

    switch (this._mode) {
      case 'auto':
        this._scheduleAuto(structural)
        break
      case 'deferred':
        this._scheduleDeferred(structural)
        break
      case 'manual':
        // Don't schedule anything — ops accumulate until explicit flush
        break
    }
  }

  /** Immediately dispatch all pending ops to the engine. */
  flush(): void {
    this._cancelTimers()
    if (this._pendingOps.length === 0 || !this._onFlush) return
    const ops = this._pendingOps
    this._pendingOps = []
    this._notifyPending()
    this._onFlush(ops)
  }

  /** Discard all pending ops without dispatching. */
  clear(): void {
    this._cancelTimers()
    this._pendingOps = []
    this._notifyPending()
  }

  /** Clean up timers and mark as disposed. */
  dispose(): void {
    this._disposed = true
    this._cancelTimers()
    this._pendingOps = []
    this._onFlush = null
    this._onPendingChange = null
  }

  // ── Private scheduling methods ─────────────────────────────────────

  private _scheduleAuto(structural: boolean): void {
    if (structural) {
      // Structural changes fire immediately — flush now
      this.flush()
    } else {
      // Data-only changes: debounce to coalesce rapid keystrokes
      this._cancelTimers()
      this._debounceTimer = setTimeout(() => {
        this._debounceTimer = null
        this.flush()
      }, PATCH_DEBOUNCE_MS)
    }
  }

  private _scheduleDeferred(structural: boolean): void {
    if (structural) {
      // Structural changes still fire immediately for graph consistency
      this.flush()
    } else {
      // Use requestIdleCallback with a fallback timeout
      this._cancelTimers()
      if (typeof requestIdleCallback === 'function') {
        this._idleHandle = requestIdleCallback(
          () => {
            this._idleHandle = null
            this._cancelFallbackTimer()
            this.flush()
          },
          { timeout: DEFERRED_IDLE_TIMEOUT_MS },
        )
      }
      // Fallback: if requestIdleCallback doesn't fire within the timeout
      // (e.g., heavy CPU usage), force-flush after the timeout
      this._idleFallbackTimer = setTimeout(() => {
        this._idleFallbackTimer = null
        this._cancelIdleCallback()
        this.flush()
      }, DEFERRED_IDLE_TIMEOUT_MS)
    }
  }

  private _cancelTimers(): void {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer)
      this._debounceTimer = null
    }
    this._cancelIdleCallback()
    this._cancelFallbackTimer()
  }

  private _cancelIdleCallback(): void {
    if (this._idleHandle !== null) {
      if (typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(this._idleHandle)
      }
      this._idleHandle = null
    }
  }

  private _cancelFallbackTimer(): void {
    if (this._idleFallbackTimer !== null) {
      clearTimeout(this._idleFallbackTimer)
      this._idleFallbackTimer = null
    }
  }

  private _notifyPending(): void {
    this._onPendingChange?.(this._pendingOps.length)
  }
}

/**
 * Suggest an eval mode based on graph size.
 * Users can override per project, but this provides a sensible default.
 */
export function suggestEvalMode(nodeCount: number): EvalMode {
  if (nodeCount < 50) return 'auto'
  if (nodeCount < 300) return 'deferred'
  return 'manual'
}
