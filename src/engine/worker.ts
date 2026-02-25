/**
 * Web Worker entry point for the WASM compute engine.
 *
 * Lifecycle:
 *  1. Worker loads → imports WASM init + glue
 *  2. Calls init(wasmUrl) to instantiate the WASM module
 *  3. Posts { type: 'ready' } to main thread
 *  4. Listens for messages: evaluate, loadSnapshot, applyPatch, setInput, registerDataset, releaseDataset
 *  5. Returns typed responses to main thread
 */

import initWasm, {
  evaluate,
  load_snapshot,
  apply_patch,
  set_input,
  register_dataset,
  release_dataset,
  get_catalog,
  get_engine_version,
} from '@engine-wasm/engine_wasm.js'
import wasmUrl from '@engine-wasm/engine_wasm_bg.wasm?url'
import type {
  WorkerRequest,
  WorkerResponse,
  EngineEvalResult,
  EngineErrorResult,
  IncrementalEvalResult,
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

async function initialize() {
  try {
    await initWasm(wasmUrl)
    const catalog = JSON.parse(get_catalog())
    const engineVersion = get_engine_version()
    post({ type: 'ready', catalog, engineVersion })
  } catch (err) {
    post({
      type: 'init-error',
      error: {
        code: 'WASM_INIT_FAILED',
        message: err instanceof Error ? err.message : String(err),
      },
    })
  }
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data

  switch (msg.type) {
    case 'evaluate': {
      try {
        const raw = evaluate(JSON.stringify(msg.snapshot))
        parseFullResult(raw, msg.requestId)
      } catch (err) {
        postError(msg.requestId, 'EVAL_EXCEPTION', err)
      }
      break
    }

    case 'loadSnapshot': {
      try {
        const raw = load_snapshot(JSON.stringify(msg.snapshot))
        parseFullResult(raw, msg.requestId)
      } catch (err) {
        postError(msg.requestId, 'LOAD_EXCEPTION', err)
      }
      break
    }

    case 'applyPatch': {
      try {
        const raw = apply_patch(JSON.stringify(msg.ops))
        parseIncrementalResult(raw, msg.requestId)
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
  }
}

initialize()
