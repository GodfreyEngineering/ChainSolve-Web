/**
 * Lightweight performance metrics store for the Perf HUD.
 *
 * Framework-agnostic: uses a subscriber pattern compatible with
 * React 19's `useSyncExternalStore`. Zero dependencies, zero React imports.
 */

export interface PerfSnapshot {
  lastEvalMs: number
  nodesEvaluated: number
  totalNodes: number
  isPartial: boolean
  workerRoundTripMs: number
  datasetCount: number
  datasetTotalBytes: number
  timestamp: number
}

const INITIAL: PerfSnapshot = {
  lastEvalMs: 0,
  nodesEvaluated: 0,
  totalNodes: 0,
  isPartial: false,
  workerRoundTripMs: 0,
  datasetCount: 0,
  datasetTotalBytes: 0,
  timestamp: 0,
}

let current: PerfSnapshot = { ...INITIAL }
const listeners = new Set<() => void>()

/** Update one or more fields in the perf snapshot and notify subscribers. */
export function updatePerfMetrics(partial: Partial<PerfSnapshot>): void {
  current = { ...current, ...partial, timestamp: Date.now() }
  for (const fn of listeners) {
    fn()
  }
}

/** Get the current snapshot (stable reference until next update). */
export function getPerfSnapshot(): PerfSnapshot {
  return current
}

/** Subscribe to snapshot changes. Returns an unsubscribe function. */
export function subscribePerfMetrics(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/**
 * Export recent User Timing measures for diagnostics bundles.
 * Returns at most 20 entries to keep the payload small.
 * Lazily imports marks.ts to avoid loading perf infrastructure in workers.
 */
export async function userTimingExport(): Promise<
  ReadonlyArray<{ name: string; durationMs: number; startTime: number }>
> {
  const { getRecentMeasures } = await import('../perf/marks.ts')
  return getRecentMeasures().slice(-20)
}
