/**
 * User Timing API wrappers for ChainSolve performance instrumentation.
 *
 * Naming convention: cs:<component>:<span>
 *   cs:eval:snapshot  — full snapshot load (first render or recreate)
 *   cs:eval:patch     — incremental patch (subsequent renders)
 *   cs:eval:partial   — eval returned partial:true (time budget hit)
 *   cs:engine:boot    — WASM engine init (Worker ready)
 *
 * All marks/measures use the User Timing API (Level 2+).  These are:
 *   - Zero overhead in production (browser ignores if not profiling)
 *   - Visible in Chrome DevTools Performance panel
 *   - Queryable via performance.getEntriesByType('measure')
 *   - Supported in Web Workers (marks.ts can be imported there too)
 *
 * Usage:
 *   perfMark('cs:eval:start')
 *   const result = await engine.applyPatch(...)
 *   perfMeasure('cs:eval:patch', 'cs:eval:start')
 *
 * Retrieving measures for diagnostics export:
 *   const measures = getRecentMeasures()
 */

const MARK_PREFIX = 'cs:'
const MAX_RETAINED = 30 // max measures kept in ring buffer

/** Ring buffer of recent measures for diagnostics export. */
const recentMeasures: Array<{ name: string; durationMs: number; startTime: number }> = []

/** Drop a named mark at the current time. Silently no-ops if API unavailable. */
export function perfMark(name: string): void {
  try {
    performance.mark(name)
  } catch {
    // Silently ignore — performance.mark unavailable (rare, e.g. old Safari)
  }
}

/**
 * Record a measure between a start mark and now.
 * Silently no-ops if either mark is missing or the API is unavailable.
 * Also pushes the measure into the in-memory ring buffer for export.
 */
export function perfMeasure(name: string, startMark: string): number {
  let durationMs = 0
  try {
    const m = performance.measure(name, startMark)
    durationMs = m.duration

    // Push into ring buffer (trim oldest if full)
    recentMeasures.push({ name, durationMs, startTime: m.startTime })
    if (recentMeasures.length > MAX_RETAINED) {
      recentMeasures.shift()
    }

    // Clean up marks to avoid unbounded accumulation
    performance.clearMarks(startMark)
    performance.clearMeasures(name)
  } catch {
    // Silently ignore — mark may not exist yet
  }
  return durationMs
}

/**
 * Returns a snapshot of the recent measure ring buffer.
 * Used by diagnostics export to include perf data without bloating the payload.
 * Returns at most MAX_RETAINED entries; each entry is ≤ 60 bytes JSON.
 */
export function getRecentMeasures(): ReadonlyArray<{
  name: string
  durationMs: number
  startTime: number
}> {
  return recentMeasures
}

/** Clear the ring buffer (useful for testing). */
export function clearRecentMeasures(): void {
  recentMeasures.length = 0
}

/** Returns true if the name looks like a ChainSolve timing mark. */
export function isCsMark(name: string): boolean {
  return name.startsWith(MARK_PREFIX)
}
