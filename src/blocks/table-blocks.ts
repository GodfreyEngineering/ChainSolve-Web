/**
 * table-blocks.ts — Table operation blocks (Pro only).
 *
 * All use csOperation node kind and Value-aware evaluate.
 * Imported as a side-effect from registry.ts.
 */

import { regValue } from './registry'
import {
  type Value,
  mkVector,
  mkTable,
  mkError,
  isTable,
  isScalar,
  isVector,
} from '../engine/value'

function requireTable(
  v: Value | null,
  name: string,
): { columns: readonly string[]; rows: readonly (readonly number[])[] } | ErrorValue {
  if (v === null) return { kind: 'error', message: `${name}: no input` } as const
  if (!isTable(v)) return { kind: 'error', message: `${name}: expected table` } as const
  return v
}

type ErrorValue = { readonly kind: 'error'; readonly message: string }

function isErr(
  v: { columns: readonly string[]; rows: readonly (readonly number[])[] } | ErrorValue,
): v is ErrorValue {
  return 'kind' in v && v.kind === 'error'
}

// ── Table Filter ─────────────────────────────────────────────────────────────

regValue({
  type: 'tableFilter',
  label: 'Table Filter',
  category: 'tableOps',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'table', label: 'Table' },
    { id: 'col', label: 'Col #' },
    { id: 'threshold', label: 'Threshold' },
  ],
  proOnly: true,
  defaultData: { blockType: 'tableFilter', label: 'Filter' },
  evaluate: ([table, col, threshold]) => {
    const t = requireTable(table, 'Filter')
    if (isErr(t)) return t
    if (col === null || !isScalar(col)) return mkError('Filter: expected column index')
    if (threshold === null || !isScalar(threshold)) return mkError('Filter: expected threshold')
    const ci = Math.floor(col.value)
    if (ci < 0 || ci >= t.columns.length) return mkError('Filter: column index out of range')
    const filtered = t.rows.filter((row) => row[ci] > threshold.value)
    return mkTable(t.columns, filtered)
  },
})

// ── Table Sort ───────────────────────────────────────────────────────────────

regValue({
  type: 'tableSort',
  label: 'Table Sort',
  category: 'tableOps',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'table', label: 'Table' },
    { id: 'col', label: 'Col #' },
  ],
  proOnly: true,
  defaultData: { blockType: 'tableSort', label: 'Sort' },
  evaluate: ([table, col]) => {
    const t = requireTable(table, 'Sort')
    if (isErr(t)) return t
    if (col === null || !isScalar(col)) return mkError('Sort: expected column index')
    const ci = Math.floor(col.value)
    if (ci < 0 || ci >= t.columns.length) return mkError('Sort: column index out of range')
    const sorted = [...t.rows].sort((a, b) => (a[ci] ?? 0) - (b[ci] ?? 0))
    return mkTable(t.columns, sorted)
  },
})

// ── Table Column (extract column → vector) ───────────────────────────────────

regValue({
  type: 'tableColumn',
  label: 'Table Column',
  category: 'tableOps',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'table', label: 'Table' },
    { id: 'col', label: 'Col #' },
  ],
  proOnly: true,
  defaultData: { blockType: 'tableColumn', label: 'Column' },
  evaluate: ([table, col]) => {
    const t = requireTable(table, 'Column')
    if (isErr(t)) return t
    if (col === null || !isScalar(col)) return mkError('Column: expected column index')
    const ci = Math.floor(col.value)
    if (ci < 0 || ci >= t.columns.length) return mkError('Column: column index out of range')
    return mkVector(t.rows.map((row) => row[ci] ?? NaN))
  },
})

// ── Table Add Column ─────────────────────────────────────────────────────────

regValue({
  type: 'tableAddColumn',
  label: 'Add Column',
  category: 'tableOps',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'table', label: 'Table' },
    { id: 'vec', label: 'Vec' },
  ],
  proOnly: true,
  defaultData: { blockType: 'tableAddColumn', label: 'Add Col' },
  evaluate: ([table, vec]) => {
    const t = requireTable(table, 'AddColumn')
    if (isErr(t)) return t
    if (vec === null || !isVector(vec)) return mkError('AddColumn: expected vector')
    const colName = `Col${t.columns.length + 1}`
    const newCols = [...t.columns, colName]
    const maxLen = Math.max(t.rows.length, vec.value.length)
    const newRows: number[][] = []
    for (let i = 0; i < maxLen; i++) {
      const existing = i < t.rows.length ? [...t.rows[i]] : new Array(t.columns.length).fill(NaN)
      existing.push(i < vec.value.length ? vec.value[i] : NaN)
      newRows.push(existing)
    }
    return mkTable(newCols, newRows)
  },
})

// ── Table Join (horizontal zip) ──────────────────────────────────────────────

regValue({
  type: 'tableJoin',
  label: 'Table Join',
  category: 'tableOps',
  nodeKind: 'csOperation',
  inputs: [
    { id: 'a', label: 'Table A' },
    { id: 'b', label: 'Table B' },
  ],
  proOnly: true,
  defaultData: { blockType: 'tableJoin', label: 'Join' },
  evaluate: ([a, b]) => {
    const tA = requireTable(a, 'Join')
    if (isErr(tA)) return tA
    const tB = requireTable(b, 'Join')
    if (isErr(tB)) return tB
    const newCols = [...tA.columns, ...tB.columns]
    const maxLen = Math.max(tA.rows.length, tB.rows.length)
    const newRows: number[][] = []
    for (let i = 0; i < maxLen; i++) {
      const rowA = i < tA.rows.length ? [...tA.rows[i]] : new Array(tA.columns.length).fill(NaN)
      const rowB = i < tB.rows.length ? [...tB.rows[i]] : new Array(tB.columns.length).fill(NaN)
      newRows.push([...rowA, ...rowB])
    }
    return mkTable(newCols, newRows)
  },
})
