/**
 * hybridCompute.ts — Hybrid compute dispatch (7.12).
 *
 * Detects "heavy" evaluation jobs (graphs >1000 blocks or matrix values
 * >10,000×10,000 elements) and offloads them to the Supabase Edge Function
 * `heavy-compute` which calls a native Rust binary for maximum throughput.
 *
 * For jobs that don't exceed the thresholds the call falls through to the
 * regular browser WASM engine via the supplied `localEval` callback.
 *
 * Public API:
 *   isHeavyGraph(snapshot)                → boolean
 *   isHeavyValue(value)                   → boolean
 *   dispatchHeavyEval(snapshot, supabase) → Promise<EngineEvalResult>
 *   hybridEvaluate(snapshot, localEval, supabase?) → Promise<EngineEvalResult>
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EngineSnapshotV1, EngineEvalResult, EngineValue } from '../engine/wasm-types.ts'

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Graphs with more than this many nodes are considered heavy. */
export const HYBRID_NODE_THRESHOLD = 1_000

/** Matrix/vector element count above which a value is considered heavy. */
export const HYBRID_ELEMENT_THRESHOLD = 10_000 * 10_000

// ── Supabase Edge Function endpoint ──────────────────────────────────────────

const EDGE_FUNCTION_NAME = 'heavy-compute'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HybridEvalOptions {
  /** Force remote even for small graphs (testing only). */
  forceRemote?: boolean
  /** Abort signal for cancellation. */
  signal?: AbortSignal
  /** Timeout in milliseconds (default: 120 000). */
  timeoutMs?: number
}

export interface HybridEvalResult extends EngineEvalResult {
  /** Where this result was computed. */
  backend: 'local' | 'remote'
}

// ── Detection helpers ─────────────────────────────────────────────────────────

/**
 * Returns true if the snapshot's block count exceeds the heavy-graph threshold.
 * Does not inspect value sizes — call `isHeavyValue` for that at runtime.
 */
export function isHeavyGraph(snapshot: EngineSnapshotV1): boolean {
  return snapshot.nodes.length > HYBRID_NODE_THRESHOLD
}

/**
 * Returns true if a computed EngineValue is too large for efficient
 * browser-side processing (e.g. a 10k×10k matrix).
 */
export function isHeavyValue(value: EngineValue): boolean {
  switch (value.kind) {
    case 'matrix':
      return value.rows * value.cols > HYBRID_ELEMENT_THRESHOLD
    case 'vector':
      return value.value.length > HYBRID_ELEMENT_THRESHOLD
    case 'table': {
      const rows = value.rows.length
      const cols = value.columns.length
      return rows * cols > HYBRID_ELEMENT_THRESHOLD
    }
    default:
      return false
  }
}

// ── Remote dispatch ────────────────────────────────────────────────────────────

/**
 * Send `snapshot` to the `heavy-compute` Supabase Edge Function and return
 * the full evaluation result.
 *
 * Throws if the Edge Function returns a non-200 status or the response cannot
 * be decoded as EngineEvalResult.
 */
export async function dispatchHeavyEval(
  snapshot: EngineSnapshotV1,
  supabase: SupabaseClient,
  opts: HybridEvalOptions = {},
): Promise<HybridEvalResult> {
  const { timeoutMs = 120_000, signal } = opts

  // Build an AbortSignal that fires on either the caller's signal or timeout
  const ctrl = new AbortController()
  const timer = setTimeout(
    () => ctrl.abort(new Error('[HYBRID_TIMEOUT] remote eval timed out')),
    timeoutMs,
  )
  if (signal) {
    signal.addEventListener('abort', () => ctrl.abort(signal.reason), { once: true })
  }

  let data: unknown
  let error: unknown

  try {
    const resp = await supabase.functions.invoke<EngineEvalResult>(EDGE_FUNCTION_NAME, {
      body: { snapshot },
      // Supabase JS client doesn't expose signal directly; wrap fetch manually
    })
    data = resp.data
    error = resp.error
  } finally {
    clearTimeout(timer)
  }

  if (error) {
    throw new Error(`[HYBRID_REMOTE_ERROR] ${String(error)}`)
  }

  if (!data || typeof data !== 'object') {
    throw new Error('[HYBRID_INVALID_RESPONSE] Edge Function returned unexpected payload')
  }

  const result = data as EngineEvalResult
  return { ...result, backend: 'remote' }
}

// ── Unified entry point ────────────────────────────────────────────────────────

/**
 * Evaluate `snapshot`, routing to the remote Edge Function if the graph is
 * heavy and a Supabase client is provided, otherwise falling through to the
 * supplied `localEval` callback.
 *
 * @param snapshot   Graph to evaluate.
 * @param localEval  Callback that runs local WASM evaluation (browser engine).
 * @param supabase   Supabase client; if omitted, always uses local eval.
 * @param opts       Optional routing / timeout overrides.
 */
export async function hybridEvaluate(
  snapshot: EngineSnapshotV1,
  localEval: (snapshot: EngineSnapshotV1) => Promise<EngineEvalResult>,
  supabase?: SupabaseClient,
  opts: HybridEvalOptions = {},
): Promise<HybridEvalResult> {
  const heavy = opts.forceRemote || isHeavyGraph(snapshot)

  if (!heavy || !supabase) {
    const result = await localEval(snapshot)
    return { ...result, backend: 'local' }
  }

  try {
    return await dispatchHeavyEval(snapshot, supabase, opts)
  } catch {
    // Graceful fallback: if remote fails, run locally
    const result = await localEval(snapshot)
    return { ...result, backend: 'local' }
  }
}
