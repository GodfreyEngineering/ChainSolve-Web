/**
 * valueFormat.ts — Extended value formatters for copy/export.
 *
 * Re-exports the compact `formatValue` from value.ts and adds:
 *   - formatValueFull: full-precision string for clipboard
 *   - formatValueJson: JSON representation
 *   - copyValueToClipboard: write value to system clipboard
 */

import type { Value } from './value'

// ── Full-precision formatter ──────────────────────────────────────────────────

/** Format a Value at full precision for clipboard / detailed view. */
export function formatValueFull(v: Value | undefined): string {
  if (v === undefined) return '\u2014'
  switch (v.kind) {
    case 'scalar': {
      const n = v.value
      if (isNaN(n)) return 'NaN'
      if (!isFinite(n)) return n > 0 ? '+Infinity' : '-Infinity'
      return n.toPrecision(17).replace(/0+$/, '').replace(/\.$/, '')
    }
    case 'vector':
      return `[${v.value.join(', ')}]`
    case 'table': {
      const header = v.columns.join('\t')
      const rows = v.rows.map((r) => r.join('\t')).join('\n')
      return `${header}\n${rows}`
    }
    case 'error':
      return `Error: ${v.message}`
  }
}

// ── JSON formatter ────────────────────────────────────────────────────────────

/** Format a Value as JSON for clipboard / export. */
export function formatValueJson(v: Value | undefined): string {
  if (v === undefined) return 'null'
  switch (v.kind) {
    case 'scalar':
      if (isNaN(v.value)) return '"NaN"'
      if (!isFinite(v.value)) return v.value > 0 ? '"Infinity"' : '"-Infinity"'
      return JSON.stringify(v.value)
    case 'vector':
      return JSON.stringify(v.value)
    case 'table':
      return JSON.stringify({ columns: v.columns, rows: v.rows }, null, 2)
    case 'error':
      return JSON.stringify({ error: v.message })
  }
}

// ── Clipboard helper ──────────────────────────────────────────────────────────

import { formatValue } from './value'

/** Copy a value to the system clipboard. */
export function copyValueToClipboard(
  v: Value | undefined,
  mode: 'compact' | 'full' | 'json' = 'compact',
): void {
  let text: string
  switch (mode) {
    case 'compact':
      text = formatValue(v)
      break
    case 'full':
      text = formatValueFull(v)
      break
    case 'json':
      text = formatValueJson(v)
      break
  }
  navigator.clipboard?.writeText(text).catch(() => {
    /* clipboard not available */
  })
}
