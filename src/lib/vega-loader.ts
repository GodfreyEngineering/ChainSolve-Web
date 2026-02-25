/**
 * vega-loader.ts — Lazy-loads the Vega rendering pipeline.
 *
 * CSP-compliant: uses vega-interpreter for AST-based expression
 * evaluation instead of Function() constructor (no unsafe-eval needed).
 *
 * Returns a cached promise so only one load per session occurs.
 */

import type { View as VegaView } from 'vega'

export interface VegaAPI {
  /** Compile a Vega-Lite spec into a Vega spec. */
  compile: (vlSpec: Record<string, unknown>) => { spec: Record<string, unknown> }
  /** Parse a Vega spec with AST mode enabled. */
  parse: (spec: Record<string, unknown>) => unknown
  /** Create a Vega View. */
  View: new (runtime: unknown, opts?: Record<string, unknown>) => VegaView
  /** Expression interpreter for CSP environments. */
  expressionInterpreter: unknown
}

let cached: Promise<VegaAPI> | null = null

export function loadVega(): Promise<VegaAPI> {
  if (cached) return cached
  cached = (async () => {
    const [vega, vegaLite, vegaInterpreter] = await Promise.all([
      import('vega'),
      import('vega-lite'),
      import('vega-interpreter'),
    ])
    return {
      compile: vegaLite.compile as unknown as VegaAPI['compile'],
      parse: (spec: Record<string, unknown>) => vega.parse(spec as never, undefined, { ast: true }),
      View: vega.View as unknown as VegaAPI['View'],
      expressionInterpreter:
        (vegaInterpreter as Record<string, unknown>).default ?? vegaInterpreter,
    }
  })()
  return cached
}
