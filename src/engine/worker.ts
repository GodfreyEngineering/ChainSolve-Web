/**
 * Web Worker entry point for the WASM compute engine.
 *
 * Lifecycle:
 *  1. Worker loads → imports WASM init + glue
 *  2. Calls init(wasmUrl) to instantiate the WASM module
 *  3. Posts { type: 'ready' } to main thread
 *  4. Listens for messages: evaluate, loadSnapshot, applyPatch, setInput, registerDataset, releaseDataset, cancel
 *  5. Returns typed responses to main thread
 */

import initWasm, {
  evaluate,
  load_snapshot,
  load_snapshot_with_options,
  apply_patch,
  apply_patch_with_options,
  set_input,
  register_dataset,
  release_dataset,
  get_catalog,
  get_constant_values,
  get_engine_version,
  get_engine_contract_version,
  dataset_count,
  dataset_total_bytes,
} from '@engine-wasm/engine_wasm.js'
import wasmUrl from '@engine-wasm/engine_wasm_bg.wasm?url'
import type {
  WorkerRequest,
  WorkerResponse,
  EngineEvalResult,
  EngineErrorResult,
  IncrementalEvalResult,
  EvalOptions,
} from './wasm-types.ts'

function post(msg: WorkerResponse) {
  self.postMessage(msg)
}

function postError(requestId: number, code: string, err: unknown) {
  post({
    type: 'error',
    requestId,
    error: {
      code,
      message: err instanceof Error ? err.message : String(err),
    },
  })
}

/** Parse a JSON result that may be an EvalResult or an error object. */
function parseFullResult(raw: string, requestId: number): void {
  const parsed: EngineEvalResult | EngineErrorResult = JSON.parse(raw)
  if ('error' in parsed) {
    post({ type: 'error', requestId, error: parsed.error })
  } else {
    post({ type: 'result', requestId, result: parsed })
  }
}

/** Parse a JSON result that may be an IncrementalEvalResult or an error object. */
function parseIncrementalResult(raw: string, requestId: number): void {
  const parsed: IncrementalEvalResult | EngineErrorResult = JSON.parse(raw)
  if ('error' in parsed) {
    post({ type: 'error', requestId, error: parsed.error })
  } else {
    post({ type: 'incremental', requestId, result: parsed })
  }
}

/** Check if eval options require the *_with_options WASM path. */
function needsOptions(opts?: EvalOptions): opts is EvalOptions {
  return !!opts && (!!opts.trace || !!opts.timeBudgetMs || !!opts.maxTraceNodes)
}

// ── Cooperative cancellation (defence-in-depth) ───────────────────────────
//
// WASM is synchronous: no message can arrive while WASM is evaluating.
// Therefore a 'cancel' message can never interrupt an in-progress eval.
// The main thread handles stale results via `pendingRef` coalescing.
//
// We track `latestEvalSeq` to document intent and to discard the response for
// any request that was superseded by a cancel BEFORE WASM started (the case
// where cancel + eval are both queued and cancel is processed first).
let latestEvalSeq = 0

/** Create a progress callback that posts progress messages. */
function makeProgressCb(requestId: number, startMs: number) {
  return (evaluated: number, total: number) => {
    const elapsedMs = performance.now() - startMs
    post({
      type: 'progress',
      requestId,
      evaluatedNodes: evaluated,
      totalNodesEstimate: total,
      elapsedMs,
    })
  }
}

async function initialize() {
  try {
    await initWasm(wasmUrl)
    const catalog = JSON.parse(get_catalog())
    const constantValues = JSON.parse(get_constant_values()) as Record<string, number>
    const engineVersion = get_engine_version()
    const contractVersion = get_engine_contract_version()
    post({ type: 'ready', catalog, constantValues, engineVersion, contractVersion })
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    // Detect CSP-blocked WebAssembly compilation.
    // Chrome ≥95:  "call to WebAssembly.instantiateStreaming() blocked by CSP"
    // Firefox ≥102: "Content Security Policy: The page's settings blocked …"
    // Safari ≥16:  similar phrasing with "Content Security Policy"
    const isCspBlock = /\bCSP\b|Content.{0,5}Security.{0,5}Policy|blocked by/i.test(raw)
    post({
      type: 'init-error',
      error: {
        code: isCspBlock ? 'WASM_CSP_BLOCKED' : 'WASM_INIT_FAILED',
        message: isCspBlock
          ? `Blocked by CSP: add 'wasm-unsafe-eval' to script-src. (${raw})`
          : raw,
      },
    })
  }
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data

  switch (msg.type) {
    case 'evaluate': {
      try {
        if (needsOptions(msg.options)) {
          // When options are present, use persistent graph path for trace/budget support.
          const startMs = performance.now()
          const raw = load_snapshot_with_options(
            JSON.stringify(msg.snapshot),
            JSON.stringify(msg.options),
            makeProgressCb(msg.requestId, startMs),
          )
          parseFullResult(raw, msg.requestId)
        } else {
          const raw = evaluate(JSON.stringify(msg.snapshot))
          parseFullResult(raw, msg.requestId)
        }
      } catch (err) {
        postError(msg.requestId, 'EVAL_EXCEPTION', err)
      }
      break
    }

    case 'loadSnapshot': {
      try {
        if (needsOptions(msg.options)) {
          const startMs = performance.now()
          const raw = load_snapshot_with_options(
            JSON.stringify(msg.snapshot),
            JSON.stringify(msg.options),
            makeProgressCb(msg.requestId, startMs),
          )
          parseFullResult(raw, msg.requestId)
        } else {
          const raw = load_snapshot(JSON.stringify(msg.snapshot))
          parseFullResult(raw, msg.requestId)
        }
      } catch (err) {
        postError(msg.requestId, 'LOAD_EXCEPTION', err)
      }
      break
    }

    case 'applyPatch': {
      const patchSeq = ++latestEvalSeq
      try {
        if (needsOptions(msg.options)) {
          const startMs = performance.now()
          const raw = apply_patch_with_options(
            JSON.stringify(msg.ops),
            JSON.stringify(msg.options),
            makeProgressCb(msg.requestId, startMs),
          )
          // Discard if a cancel arrived before this eval began (seq mismatch).
          if (patchSeq !== latestEvalSeq) break
          parseIncrementalResult(raw, msg.requestId)
        } else {
          const raw = apply_patch(JSON.stringify(msg.ops))
          if (patchSeq !== latestEvalSeq) break
          parseIncrementalResult(raw, msg.requestId)
        }
      } catch (err) {
        postError(msg.requestId, 'PATCH_EXCEPTION', err)
      }
      break
    }

    case 'setInput': {
      try {
        const raw = set_input(msg.nodeId, msg.portId, msg.value)
        parseIncrementalResult(raw, msg.requestId)
      } catch (err) {
        postError(msg.requestId, 'SET_INPUT_EXCEPTION', err)
      }
      break
    }

    case 'registerDataset': {
      try {
        const arr = new Float64Array(msg.buffer)
        register_dataset(msg.datasetId, arr)
      } catch {
        // Fire-and-forget — no requestId to report back on.
      }
      break
    }

    case 'releaseDataset': {
      try {
        release_dataset(msg.datasetId)
      } catch {
        // Fire-and-forget.
      }
      break
    }

    case 'getStats': {
      try {
        post({
          type: 'stats',
          requestId: msg.requestId,
          stats: {
            datasetCount: dataset_count(),
            datasetTotalBytes: dataset_total_bytes(),
          },
        })
      } catch (err) {
        postError(msg.requestId, 'STATS_EXCEPTION', err)
      }
      break
    }

    case 'cancel': {
      // WASM is synchronous — can't interrupt mid-execution once started.
      // Set latestEvalSeq to a sentinel so any request that hasn't started
      // yet (queued before this cancel) discards its result.
      // The main thread also handles stale results via pendingRef coalescing.
      latestEvalSeq = Number.MAX_SAFE_INTEGER
      break
    }
  }
}

initialize()
