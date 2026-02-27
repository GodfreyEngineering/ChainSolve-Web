/**
 * offlineQueue.ts — Retry queue state machine for failed saves.
 *
 * Holds at most one pending save function and retries it with exponential
 * backoff. Fully synchronous except for the async flush; no DOM or React
 * dependencies — usable in unit tests with fake timers.
 *
 * Lifecycle:
 *   idle    → enqueueSave(fn)   → pending (backoff timer started)
 *   pending → flush() success   → idle
 *   pending → flush() failure   → pending (retry count++, new timer)
 *   pending → cancel()          → idle
 *   pending → enqueueSave(fn)   → pending (fn replaced, retry count reset)
 */

export interface OfflineQueueState {
  /** Whether there is a queued save waiting to be retried. */
  hasPending: boolean
  /** How many retry attempts have been made since enqueueing. */
  retryCount: number
  /** Timestamp (ms since epoch) when the next auto-retry will fire, or null. */
  nextRetryAt: number | null
}

export type OfflineQueueListener = (state: OfflineQueueState) => void

const DEFAULT_BACKOFF_DELAYS_MS: readonly number[] = [3_000, 6_000, 12_000, 24_000, 60_000]

export class OfflineQueue {
  private pendingFn: (() => Promise<void>) | null = null
  private retryCount = 0
  private nextRetryAt: number | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<OfflineQueueListener>()

  /** Backoff delay sequence in ms. Can be overridden in tests. */
  readonly backoffDelays: readonly number[]

  constructor(backoffDelays: readonly number[] = DEFAULT_BACKOFF_DELAYS_MS) {
    this.backoffDelays = backoffDelays
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  getState(): OfflineQueueState {
    return {
      hasPending: this.pendingFn !== null,
      retryCount: this.retryCount,
      nextRetryAt: this.nextRetryAt,
    }
  }

  subscribe(listener: OfflineQueueListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private emit(): void {
    const state = this.getState()
    this.listeners.forEach((l) => l(state))
  }

  private clearTimer(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private scheduleRetry(): void {
    const delayMs = this.backoffDelays[Math.min(this.retryCount, this.backoffDelays.length - 1)]
    this.nextRetryAt = Date.now() + delayMs
    this.emit()
    this.retryTimer = setTimeout(() => {
      void this.flush()
    }, delayMs)
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Enqueue a save function. Replaces any existing pending save and resets
   * the retry counter. Immediately schedules a retry using the first backoff
   * delay.
   */
  enqueue(fn: () => Promise<void>): void {
    this.clearTimer()
    this.pendingFn = fn
    this.retryCount = 0
    this.nextRetryAt = null
    this.emit()
    this.scheduleRetry()
  }

  /**
   * Attempt the pending save now (e.g. when the user comes back online or
   * clicks "retry now"). Clears the backoff timer before attempting.
   *
   * Resolves once the attempt completes (success or failure). On failure,
   * schedules the next backoff retry.
   */
  async flush(): Promise<void> {
    if (!this.pendingFn) return
    this.clearTimer()
    const fn = this.pendingFn
    try {
      await fn()
      // Success — clear the queue
      this.pendingFn = null
      this.retryCount = 0
      this.nextRetryAt = null
      this.emit()
    } catch {
      // Still failing — schedule the next backoff retry
      this.retryCount++
      this.scheduleRetry()
    }
  }

  /**
   * Cancel and discard any pending save.
   */
  cancel(): void {
    this.clearTimer()
    this.pendingFn = null
    this.retryCount = 0
    this.nextRetryAt = null
    this.emit()
  }
}

/** App-wide singleton. Tests should create their own instances. */
export const offlineQueue = new OfflineQueue()
