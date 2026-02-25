/**
 * data-blocks.ts — Data input blocks (Pro only).
 *
 * VectorInput, TableInput, CSVImport — all use the csData node kind.
 * Imported as a side-effect from registry.ts.
 */

import { regValue, type NodeData } from './registry'
import { mkVector, mkTable, mkError } from '../engine/value'

// ── Vector Input ─────────────────────────────────────────────────────────────

regValue({
  type: 'vectorInput',
  label: 'Vector Input',
  category: 'data',
  nodeKind: 'csData',
  inputs: [],
  proOnly: true,
  defaultData: {
    blockType: 'vectorInput',
    label: 'Vector',
    vectorData: [],
  },
  evaluate: (_inputs, data) => mkVector((data.vectorData as number[] | undefined) ?? []),
})

// ── Table Input ──────────────────────────────────────────────────────────────

regValue({
  type: 'tableInput',
  label: 'Table Input',
  category: 'data',
  nodeKind: 'csData',
  inputs: [],
  proOnly: true,
  defaultData: {
    blockType: 'tableInput',
    label: 'Table',
    tableData: { columns: ['A'], rows: [] },
  },
  evaluate: (_inputs, data) => {
    const td = data.tableData as { columns: string[]; rows: number[][] } | undefined
    return td ? mkTable(td.columns, td.rows) : mkTable(['A'], [])
  },
})

// ── CSV Import ───────────────────────────────────────────────────────────────

regValue({
  type: 'csvImport',
  label: 'CSV Import',
  category: 'data',
  nodeKind: 'csData',
  inputs: [],
  proOnly: true,
  defaultData: {
    blockType: 'csvImport',
    label: 'CSV Import',
  },
  evaluate: (_inputs, data: NodeData) => {
    const td = data.tableData as { columns: string[]; rows: number[][] } | undefined
    return td ? mkTable(td.columns, td.rows) : mkError('No CSV loaded')
  },
})
