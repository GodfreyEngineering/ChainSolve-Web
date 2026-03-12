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
/** D8-1 / SCI-02 / SCI-05 / SCI-07: Optional formatting preferences for numeric display. */
export interface FormatOptions {
  /** Number of decimal places. -1 = auto (smart precision). Default: -1. */
  decimalPlaces?: number
  /** Abs value above this uses scientific notation. Default: 1e6. */
  scientificNotationThreshold?: number
  /** Whether to add thousands separators. Default: false. */
  thousandsSeparator?: boolean
  /** SCI-07: thousands separator character (used when thousandsSeparator is true). */
  thousandsSeparatorChar?: 'comma' | 'period' | 'space' | 'underscore' | 'apostrophe'
  /** SCI-07: decimal separator character. */
  decimalSeparator?: '.' | ','
  /** SCI-05: number display mode. */
  numberDisplayMode?: 'auto' | 'decimal' | 'sig_figs' | 'scientific'
  /** SCI-05: significant figures count (used when numberDisplayMode === 'sig_figs'). */
  sigFigs?: number
  /**
   * SCI-02: Optional callback to look up a high-precision string for a scalar.
   * Provided by useFormatValue when the user has highPrecisionConstants enabled.
   * Returns null if the value does not match a known constant.
   */
  highPrecisionLookup?: (n: number, decimalPlaces: number) => string | null
  /** PREC-04: Negative number display style. 'minus' (default) = -1.5, 'parens' = (1.5). */
  negativeStyle?: 'minus' | 'parens'
  /** PREC-04: Show trailing zeros in fixed-decimal mode. E.g. 1.50 vs 1.5. Default: false. */
  trailingZeros?: boolean
}

const THOUSANDS_SEP_CHARS: Record<string, string> = {
  comma: ',',
  period: '.',
  space: '\u2009', // thin space
  underscore: '_',
  apostrophe: "'",
}

export function formatValue(v: Value | undefined, locale?: string, opts?: FormatOptions): string {
  if (v === undefined) return '\u2014' // em dash
  switch (v.kind) {
    case 'scalar': {
      const n = v.value
      if (isNaN(n)) return 'NaN'
      if (!isFinite(n)) return n > 0 ? '+\u221E' : '\u2212\u221E'
      const abs = Math.abs(n)
      if (abs === 0) return '0'

      const mode = opts?.numberDisplayMode ?? 'auto'
      const decSep = opts?.decimalSeparator ?? '.'
      const thouSep = opts?.thousandsSeparator ? (THOUSANDS_SEP_CHARS[opts.thousandsSeparatorChar ?? 'comma'] ?? ',') : null
      const negStyle = opts?.negativeStyle ?? 'minus'
      const keepTrailingZeros = opts?.trailingZeros ?? false

      // PREC-04: post-process helper to apply negative style + trailing zero stripping
      const postProcess = (s: string): string => {
        // Strip trailing zeros in fixed-decimal when trailingZeros is off
        let result = s
        if (!keepTrailingZeros && !result.includes('e') && !result.includes('E')) {
          const decChar = decSep
          if (result.includes(decChar)) {
            result = result.replace(new RegExp(`(\\${decChar}\\d*[1-9])0+$`), '$1')
                          .replace(new RegExp(`\\${decChar}0+$`), '')
          }
        }
        // Apply negative style
        if (negStyle === 'parens' && result.startsWith('-')) {
          result = `(${result.slice(1)})`
        }
        return result
      }

      // SCI-02: high-precision constant substitution (callback provided by useFormatValue)
      if (opts?.highPrecisionLookup) {
        const hpResult = opts.highPrecisionLookup(n, opts.decimalPlaces ?? -1)
        if (hpResult !== null) {
          return postProcess(applySeparators(hpResult, decSep, thouSep))
        }
      }

      // SCI-05: significant figures mode
      if (mode === 'sig_figs') {
        const sf = opts?.sigFigs ?? 4
        const formatted = formatSigFigs(n, sf)
        return postProcess(applySeparators(formatted, decSep, thouSep))
      }

      // SCI-05: always scientific notation
      if (mode === 'scientific') {
        const dp = opts?.decimalPlaces
        const formatted = n.toExponential(dp !== undefined && dp >= 0 ? dp : 4)
        return postProcess(applySeparators(formatted, decSep, thouSep))
      }

      const sciThreshold = opts?.scientificNotationThreshold ?? 1e6
      // Scientific notation for large/small values (auto or decimal mode)
      if (mode !== 'decimal' && (abs >= sciThreshold || (abs > 0 && abs < 1e-3))) {
        const dp = opts?.decimalPlaces
        const formatted = n.toExponential(dp !== undefined && dp >= 0 ? dp : 4)
        return postProcess(applySeparators(formatted, decSep, thouSep))
      }

      // Fixed decimal places mode
      if (opts?.decimalPlaces !== undefined && opts.decimalPlaces >= 0) {
        const formatted = n.toFixed(opts.decimalPlaces)
        return postProcess(applySeparators(formatted, decSep, thouSep))
      }

      // Auto precision mode: use Intl.NumberFormat or toPrecision(6)
      if (thouSep !== null || locale) {
        try {
          const intlOpts: Intl.NumberFormatOptions = { maximumSignificantDigits: 6 }
          intlOpts.useGrouping = thouSep !== null
          const str = new Intl.NumberFormat(locale ?? 'en', intlOpts).format(n)
          // Apply custom separators on top of Intl output if requested
          if (decSep !== '.' || (thouSep !== null && thouSep !== ',')) {
            return postProcess(applySeparators(str.replace(/,/g, '\uE000').replace(/\./g, '\uE001').replace(/\uE000/g, thouSep ?? ',').replace(/\uE001/g, decSep), decSep, null))
          }
          return postProcess(str)
        } catch {
          // Unknown locale tag — fall through to default formatting.
        }
      }

      const raw = parseFloat(n.toPrecision(6)).toString()
      return postProcess(applySeparators(raw, decSep, thouSep))
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

/** SCI-05: Format a number to N significant figures. */
function formatSigFigs(n: number, sf: number): string {
  if (sf <= 0) return n.toString()
  // toPrecision handles sig figs correctly
  return parseFloat(n.toPrecision(sf)).toString()
}

/**
 * SCI-07: Apply decimal and thousands separators to a formatted number string.
 * Works on fixed-point strings (e.g. "1234.56"). Skips scientific notation exponents.
 */
function applySeparators(s: string, decSep: '.' | ',', thouSep: string | null): string {
  // Don't apply separators inside scientific notation exponent
  const eIdx = s.indexOf('e')
  const mantissa = eIdx >= 0 ? s.slice(0, eIdx) : s
  const exponent = eIdx >= 0 ? s.slice(eIdx) : ''

  const parts = mantissa.split('.')
  let intPart = parts[0]
  const decPart = parts[1]

  if (thouSep !== null && thouSep !== '') {
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thouSep)
  }

  let result = intPart
  if (decPart !== undefined) {
    result += decSep + decPart
  }
  return result + exponent
}

