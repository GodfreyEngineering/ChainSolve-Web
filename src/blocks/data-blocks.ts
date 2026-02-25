/**
 * data-blocks.ts — Data input blocks (Pro only).
 *
 * VectorInput, TableInput, CSVImport — all use the csData node kind.
 * Evaluation is handled by the Rust/WASM engine (W9.1).
 * Exports a registration function called by registry.ts (no circular imports).
 */

import type { BlockDef } from './types'

export function registerDataBlocks(register: (def: BlockDef) => void): void {
  register({
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
  })

  register({
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
  })

  register({
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
  })
}
