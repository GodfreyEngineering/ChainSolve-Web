/**
 * @chainsolve/sdk — JS/TS SDK for the ChainSolve computation engine (10.7).
 *
 * ## Quick start
 *
 * ### Programmatic graph construction
 * ```typescript
 * import { GraphBuilder } from '@chainsolve/sdk'
 *
 * const snapshot = new GraphBuilder()
 *   .number('a', 3)
 *   .number('b', 4)
 *   .op('sum', 'add', { inputs: ['a', 'b'] })
 *   .build()
 *
 * console.log(JSON.stringify(snapshot, null, 2))
 * ```
 *
 * ### Remote execution via REST API
 * ```typescript
 * import { ChainSolveClient, GraphBuilder } from '@chainsolve/sdk'
 *
 * const client = new ChainSolveClient({
 *   baseUrl: 'https://app.chainsolve.dev/api',
 *   accessToken: mySession.access_token,
 * })
 *
 * const result = await client.execute(
 *   new GraphBuilder()
 *     .number('x', 0)
 *     .number('y', 0)
 *     .op('out', 'add', { inputs: ['x', 'y'] })
 *     .build(),
 *   { params: { x: 10, y: 20 } },
 * )
 * console.log(result.scalar('out'))  // 30
 * ```
 *
 * ### Working with results
 * ```typescript
 * const r = new ResultAccessor(rawEvalResult)
 * r.scalar('nodeId')         // → number
 * r.vector('nodeId')         // → number[]
 * r.matrix('nodeId')         // → { rows, cols, data }
 * r.text('nodeId')           // → string
 * r.complex('nodeId')        // → { re, im }
 * r.table('nodeId')          // → { columns, rows }
 * r.hasError('nodeId')       // → boolean
 * r.errorMessage('nodeId')   // → string | undefined
 * ```
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  GraphSnapshot,
  NodeDef,
  EdgeDef,
  EvalResult,
  Value,
  Diagnostic,
  ExecuteOptions,
  ClientOptions,
} from './types.ts'
export { ApiError, ValueTypeError, NodeNotFoundError } from './types.ts'

// ── Graph builder ─────────────────────────────────────────────────────────────
export { GraphBuilder, parseSnapshot, applyParams } from './graphBuilder.ts'

// ── Result accessor ───────────────────────────────────────────────────────────
export { ResultAccessor } from './result.ts'

// ── API client ────────────────────────────────────────────────────────────────
export { ChainSolveClient } from './client.ts'
