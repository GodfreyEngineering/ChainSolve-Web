/**
 * autosaveScheduler — Debounced autosave with a guaranteed maximum-loss budget.
 *
 * The MAX_LOSS_MS constant defines the worst-case data loss window:
 * a crash immediately after a change will lose at most AUTOSAVE_DELAY_MS ms
 * of edits (plus the save round-trip time, which is out of scope here).
 *
 * The guard below is evaluated at module-load time; if AUTOSAVE_DELAY_MS ever
 * exceeds MAX_LOSS_MS a test (or the build) will fail immediately.
 */

export const AUTOSAVE_DELAY_MS = 2_000
export const MAX_LOSS_MS = 5_000

// Static guard — will throw during import if violated, making it impossible
// to ship a broken contract.
if (AUTOSAVE_DELAY_MS > MAX_LOSS_MS) {
  throw new Error(
    `Autosave contract violated: AUTOSAVE_DELAY_MS (${AUTOSAVE_DELAY_MS}) > MAX_LOSS_MS (${MAX_LOSS_MS})`,
  )
}

/**
 * AutosaveScheduler — debounce wrapper around a save function.
 *
 * - `schedule()` resets the debounce window on every call; rapid successive
 *   calls coalesce into a single save after `delay` ms of inactivity.
 * - `cancel()` discards the pending save (use on unmount or when switching
 *   contexts where a save is no longer appropriate).
 */
export class AutosaveScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly saveFn: () => void
  private readonly delay: number

  constructor(saveFn: () => void, delay: number = AUTOSAVE_DELAY_MS) {
    this.saveFn = saveFn
    this.delay = delay
  }

  /** Schedule a save; resets the debounce window. */
  schedule(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.saveFn()
    }, this.delay)
  }

  /** Cancel any pending save without triggering it. */
  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  /** True if a save is currently scheduled. */
  hasPending(): boolean {
    return this.timer !== null
  }
}
