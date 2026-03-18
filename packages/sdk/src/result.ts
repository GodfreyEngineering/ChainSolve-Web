/**
 * Typed accessor helpers for EvalResult (10.7).
 *
 * Wraps a raw `EvalResult` and provides type-safe value extraction with
 * useful error messages on type mismatch.
 */

import type { EvalResult, Value } from './types.ts'
import { NodeNotFoundError, ValueTypeError } from './types.ts'

// ── ResultAccessor ────────────────────────────────────────────────────────────

/**
 * A wrapper around `EvalResult` providing typed per-node value accessors.
 *
 * ## Usage
 * ```typescript
 * const r = new ResultAccessor(evalResult)
 * const s = r.scalar('node_id')        // → number
 * const v = r.vector('node_id')        // → number[]
 * const m = r.matrix('node_id')        // → { rows, cols, data }
 * const t = r.text('node_id')          // → string
 * const c = r.complex('node_id')       // → { re, im }
 * const all = r.values                 // → Record<string, Value>
 * ```
 */
export class ResultAccessor {
  constructor(private readonly _result: EvalResult) {}

  /** The raw values map (read-only). */
  get values(): Readonly<Record<string, Value>> {
    return this._result.values
  }

  /** Evaluation time in microseconds. */
  get elapsedUs(): number {
    return this._result.elapsedUs
  }

  /** Non-fatal diagnostics from the evaluation. */
  get diagnostics(): EvalResult['diagnostics'] {
    return this._result.diagnostics
  }

  /** All node IDs present in the result. */
  get nodeIds(): string[] {
    return Object.keys(this._result.values)
  }

  private _get(nodeId: string): Value {
    const v = this._result.values[nodeId]
    if (v === undefined) throw new NodeNotFoundError(nodeId)
    return v
  }

  /**
   * Extract a scalar value.
   * @throws `NodeNotFoundError` if node not in result.
   * @throws `ValueTypeError` if the value is not a scalar.
   * @throws `Error` (with EvalError message) if the node errored.
   */
  scalar(nodeId: string): number {
    const v = this._get(nodeId)
    if (v.kind === 'error') throw new Error(`[EVAL_ERROR] ${v.message}`)
    if (v.kind !== 'scalar') throw new ValueTypeError(nodeId, 'scalar', v.kind)
    return v.value
  }

  /**
   * Extract a vector value as `number[]`.
   * @throws `NodeNotFoundError` | `ValueTypeError` | `Error`
   */
  vector(nodeId: string): number[] {
    const v = this._get(nodeId)
    if (v.kind === 'error') throw new Error(`[EVAL_ERROR] ${v.message}`)
    if (v.kind !== 'vector') throw new ValueTypeError(nodeId, 'vector', v.kind)
    return v.value
  }

  /**
   * Extract a matrix value.
   * @throws `NodeNotFoundError` | `ValueTypeError` | `Error`
   */
  matrix(nodeId: string): { rows: number; cols: number; data: number[] } {
    const v = this._get(nodeId)
    if (v.kind === 'error') throw new Error(`[EVAL_ERROR] ${v.message}`)
    if (v.kind !== 'matrix') throw new ValueTypeError(nodeId, 'matrix', v.kind)
    return { rows: v.rows, cols: v.cols, data: v.data }
  }

  /**
   * Extract a text value.
   * @throws `NodeNotFoundError` | `ValueTypeError` | `Error`
   */
  text(nodeId: string): string {
    const v = this._get(nodeId)
    if (v.kind === 'error') throw new Error(`[EVAL_ERROR] ${v.message}`)
    if (v.kind !== 'text') throw new ValueTypeError(nodeId, 'text', v.kind)
    return v.value
  }

  /**
   * Extract a complex value.
   * @throws `NodeNotFoundError` | `ValueTypeError` | `Error`
   */
  complex(nodeId: string): { re: number; im: number } {
    const v = this._get(nodeId)
    if (v.kind === 'error') throw new Error(`[EVAL_ERROR] ${v.message}`)
    if (v.kind !== 'complex') throw new ValueTypeError(nodeId, 'complex', v.kind)
    return { re: v.re, im: v.im }
  }

  /**
   * Extract a table value.
   * @throws `NodeNotFoundError` | `ValueTypeError` | `Error`
   */
  table(nodeId: string): { columns: string[]; rows: number[][] } {
    const v = this._get(nodeId)
    if (v.kind === 'error') throw new Error(`[EVAL_ERROR] ${v.message}`)
    if (v.kind !== 'table') throw new ValueTypeError(nodeId, 'table', v.kind)
    return { columns: v.columns, rows: v.rows }
  }

  /**
   * Check if a node has an error value.
   */
  hasError(nodeId: string): boolean {
    const v = this._result.values[nodeId]
    return v?.kind === 'error'
  }

  /**
   * Return the error message for a node, or `undefined` if no error.
   */
  errorMessage(nodeId: string): string | undefined {
    const v = this._result.values[nodeId]
    return v?.kind === 'error' ? v.message : undefined
  }

  /**
   * Return the raw `Value` for a node without type assertion.
   * Returns `undefined` if the node is not in the result.
   */
  raw(nodeId: string): Value | undefined {
    return this._result.values[nodeId]
  }
}
