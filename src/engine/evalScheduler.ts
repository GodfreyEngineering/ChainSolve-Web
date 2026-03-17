/**
 * EvalScheduler — controls when accumulated patch ops are dispatched to the
 * WASM engine based on the current evaluation mode.
 *
 * Two modes:
 *   - reactive: structural changes fire immediately, data-only changes
 *               debounce 50ms for keystroke coalescing then fire once
 *   - manual:   dispatch only on explicit flush (Run button / Ctrl+Enter)
 *
 * The scheduler is a plain class (not a React hook) so it can be instantiated
 * once per hook lifetime and disposed on cleanup.
 */

import type { PatchOp } from './wasm-types.ts'

export type EvalMode = 'reactive' | 'manual'

const PATCH_DEBOUNCE_MS = 50

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
  private _onFlush: ((ops: PatchOp[]) => void) | null = null
  private _onPendingChange: ((count: number) => void) | null = null
  private _disposed = false

  constructor(mode: EvalMode = 'reactive') {
    this._mode = mode
  }

  get mode(): EvalMode {
    return this._mode
  }

  set mode(m: EvalMode) {
    this._mode = m
    // If switching to reactive and there are pending ops, schedule them
    if (m === 'reactive' && this._pendingOps.length > 0) {
      this._scheduleReactive(hasStructuralChange(this._pendingOps))
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
      case 'reactive':
        this._scheduleReactive(structural)
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

  private _scheduleReactive(structural: boolean): void {
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

  private _cancelTimers(): void {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer)
      this._debounceTimer = null
    }
  }

  private _notifyPending(): void {
    this._onPendingChange?.(this._pendingOps.length)
  }
}
