/**
 * Web Worker entry point for the WASM compute engine.
 *
 * Lifecycle:
 *  1. Worker loads → imports WASM init + glue
 *  2. Calls init(wasmUrl) to instantiate the WASM module
 *  3. Posts { type: 'ready' } to main thread
 *  4. Listens for { type: 'evaluate', requestId, snapshot } messages
 *  5. Returns { type: 'result', requestId, result } or { type: 'error', ... }
 */

import initWasm, { evaluate } from '@engine-wasm/engine_wasm.js'
import wasmUrl from '@engine-wasm/engine_wasm_bg.wasm?url'
import type {
  WorkerRequest,
  WorkerResponse,
  EngineEvalResult,
  EngineErrorResult,
} from './wasm-types.ts'

function post(msg: WorkerResponse) {
  self.postMessage(msg)
}

async function initialize() {
  try {
    await initWasm(wasmUrl)
    post({ type: 'ready' })
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

  if (msg.type === 'evaluate') {
    try {
      const json = JSON.stringify(msg.snapshot)
      const raw = evaluate(json)
      const parsed: EngineEvalResult | EngineErrorResult = JSON.parse(raw)

      if ('error' in parsed) {
        post({
          type: 'error',
          requestId: msg.requestId,
          error: parsed.error,
        })
      } else {
        post({
          type: 'result',
          requestId: msg.requestId,
          result: parsed,
        })
      }
    } catch (err) {
      post({
        type: 'error',
        requestId: msg.requestId,
        error: {
          code: 'EVAL_EXCEPTION',
          message: err instanceof Error ? err.message : String(err),
        },
      })
    }
  }
}

initialize()
