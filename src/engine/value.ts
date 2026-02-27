/**
 * value.ts — Polymorphic value system for ChainSolve's engine.
 *
 * All block evaluate functions produce and consume `Value` instead of raw
 * `number`. Scalar blocks are wrapped via an adapter in registry.ts so
 * existing block definitions remain unchanged.
 */

// ── Value types ──────────────────────────────────────────────────────────────

export interface ScalarValue {
  readonly kind: 'scalar'
  readonly value: number
}

export interface VectorValue {
  readonly kind: 'vector'
  readonly value: readonly number[]
}

export interface TableValue {
  readonly kind: 'table'
  readonly columns: readonly string[]
  readonly rows: readonly (readonly number[])[]
}

export interface ErrorValue {
  readonly kind: 'error'
  readonly message: string
}

export type Value = ScalarValue | VectorValue | TableValue | ErrorValue

// ── Factory helpers ──────────────────────────────────────────────────────────

export function mkScalar(n: number): ScalarValue {
  return { kind: 'scalar', value: n }
}

export function mkVector(arr: readonly number[]): VectorValue {
  return { kind: 'vector', value: arr }
}

export function mkTable(
  columns: readonly string[],
  rows: readonly (readonly number[])[],
): TableValue {
  return { kind: 'table', columns, rows }
}

export function mkError(message: string): ErrorValue {
  return { kind: 'error', message }
}

// ── Type guards ──────────────────────────────────────────────────────────────

export function isScalar(v: Value): v is ScalarValue {
  return v.kind === 'scalar'
}

export function isVector(v: Value): v is VectorValue {
  return v.kind === 'vector'
}

export function isTable(v: Value): v is TableValue {
  return v.kind === 'table'
}

export function isError(v: Value): v is ErrorValue {
  return v.kind === 'error'
}

// ── Extract scalar (for adapter) ─────────────────────────────────────────────

/** Unwrap a Value to a plain number. Non-scalar values return null. */
export function extractScalar(v: Value | null): number | null {
  if (v === null) return null
  if (v.kind === 'scalar') return v.value
  return null
}

// ── Display formatting ───────────────────────────────────────────────────────

/**
 * Format a Value for display in nodes and the inspector.
 *
 * @param locale  Optional BCP 47 locale tag (e.g. 'de', 'fr').  When supplied,
 *                finite scalars are formatted with `Intl.NumberFormat` so that
 *                the decimal separator and grouping match the user's language.
 *                Omit (or pass undefined) for locale-neutral output (exports).
 */
export function formatValue(v: Value | undefined, locale?: string): string {
  if (v === undefined) return '\u2014' // em dash
  switch (v.kind) {
    case 'scalar': {
      const n = v.value
      if (isNaN(n)) return 'NaN'
      if (!isFinite(n)) return n > 0 ? '+\u221E' : '\u2212\u221E'
      const abs = Math.abs(n)
      if (abs === 0) return '0'
      // Scientific notation is universally understood; keep locale-neutral.
      if (abs >= 1e6 || (abs > 0 && abs < 1e-3)) return n.toExponential(4)
      if (locale) {
        try {
          return new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 }).format(n)
        } catch {
          // Unknown locale tag — fall through to default formatting.
        }
      }
      return parseFloat(n.toPrecision(6)).toString()
    }
    case 'vector':
      if (v.value.length === 0) return '[empty]'
      if (v.value.length <= 4) return `[${v.value.join(', ')}]`
      return `[${v.value.length} items]`
    case 'table':
      return `${v.rows.length}\u00D7${v.columns.length} table`
    case 'error':
      return v.message
  }
}
