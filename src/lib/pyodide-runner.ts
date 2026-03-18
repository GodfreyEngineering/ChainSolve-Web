/**
 * pyodide-runner.ts — Pyodide Python execution manager (2.127).
 *
 * Spawns a classic Web Worker that lazy-loads Pyodide (WASM CPython 3.11)
 * from the jsdelivr CDN on first use, then runs Python code snippets with
 * injected variable bindings.
 *
 * The worker is a singleton per tab — all PythonScriptNodes share one
 * Pyodide instance to keep memory usage bounded.
 *
 * CSP requirement: script-src must include https://cdn.jsdelivr.net
 * (for Pyodide bootstrap) and https://files.pythonhosted.org (for pip packages).
 *
 * Usage:
 *   const { result, error } = await runPython(nodeId, code, { x: 3.14 })
 */

// ── Worker singleton ──────────────────────────────────────────────────────────

let worker: Worker | null = null
const pending = new Map<string, { resolve: (v: PythonResult) => void }>()
let reqCounter = 0

// Pyodide CDN URL (v0.27.4 — latest stable with NumPy/SciPy support)
const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.4/full'

export interface PythonResult {
  result: unknown
  error?: string
  /** Execution time in ms. */
  elapsed: number
}

function getWorker(): Worker {
  if (worker) return worker

  // Build worker source as a Blob URL (classic worker, avoids ESM/Vite complexity)
  const src = `
// Pyodide Python execution worker.
// Loads Pyodide lazily on first runPython call.
// Shares one Pyodide instance across all requests from the same tab.

var pyodide = null;
var initPromise = null;

function ensurePyodide() {
  if (initPromise) return initPromise;
  initPromise = (async function() {
    importScripts('${PYODIDE_CDN}/pyodide.js');
    pyodide = await self.loadPyodide({ indexURL: '${PYODIDE_CDN}/' });
    // Pre-import common packages if available
    try {
      await pyodide.loadPackage(['numpy']);
    } catch(e) {
      // numpy might not load in restricted environments; continue
    }
  })();
  return initPromise;
}

self.onmessage = async function(e) {
  var id = e.data.id;
  var code = e.data.code;
  var variables = e.data.variables || {};
  var t0 = Date.now();
  try {
    await ensurePyodide();
    // Inject variables into Python global scope
    for (var name in variables) {
      var val = variables[name];
      pyodide.globals.set(name, val);
    }
    var result = pyodide.runPython(code);
    // Convert Pyodide proxy objects to JS
    if (result && typeof result.toJs === 'function') {
      result = result.toJs({ dict_converter: Object.fromEntries });
    }
    self.postMessage({ id: id, result: result, elapsed: Date.now() - t0 });
  } catch(err) {
    self.postMessage({ id: id, error: String(err), elapsed: Date.now() - t0 });
  }
};
`

  const blob = new Blob([src], { type: 'application/javascript' })
  const url = URL.createObjectURL(blob)
  worker = new Worker(url)

  worker.onmessage = (e: MessageEvent) => {
    const { id, result, error, elapsed } = e.data as {
      id: string
      result?: unknown
      error?: string
      elapsed: number
    }
    const p = pending.get(id)
    if (p) {
      pending.delete(id)
      p.resolve({ result, error, elapsed })
    }
  }

  worker.onerror = (e) => {
    // Resolve all pending with error
    const msg = `Worker error: ${e.message}`
    for (const [_id, p] of pending) {
      p.resolve({ result: undefined, error: msg, elapsed: 0 })
    }
    pending.clear()
    // Reset worker on fatal error
    worker = null
  }

  return worker
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run a Python code snippet with named variable bindings.
 * Returns the last expression value (like Python REPL) or the value
 * of `result` if set in the code.
 */
export function runPython(
  _nodeId: string,
  code: string,
  variables: Record<string, unknown> = {},
): Promise<PythonResult> {
  return new Promise((resolve) => {
    const id = String(++reqCounter)
    pending.set(id, { resolve })
    try {
      getWorker().postMessage({ id, code, variables })
    } catch (err) {
      pending.delete(id)
      resolve({ result: undefined, error: String(err), elapsed: 0 })
    }
  })
}

/**
 * Terminate the Pyodide worker (e.g. on tab unload).
 * The next call to runPython will start a fresh worker.
 */
export function terminatePyodideWorker(): void {
  if (worker) {
    worker.terminate()
    worker = null
  }
  for (const [_id, p] of pending) {
    p.resolve({ result: undefined, error: 'Worker terminated', elapsed: 0 })
  }
  pending.clear()
}
