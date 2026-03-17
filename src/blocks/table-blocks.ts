/**
 * table-blocks.ts — Table input block (Phase 9).
 *
 * Spreadsheet-style multi-column input with per-column output ports.
 * Evaluation handled by the Rust/WASM engine.
 */

import type { BlockDef } from './types'

export function registerTableBlocks(register: (def: BlockDef) => void): void {
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
      tableData: { columns: ['A', 'B'], rows: [[0, 0]] },
    },
  })

  // 2.7: MatrixInput — 2D numeric array with row/col index headers.
  // Engine evaluates it as tableInput (reads tableData). Free tier.
  register({
    type: 'matrixInput',
    label: 'Matrix Input',
    category: 'data',
    nodeKind: 'csData',
    inputs: [],
    proOnly: false,
    defaultData: {
      blockType: 'matrixInput',
      label: 'Matrix',
      tableData: {
        columns: ['1', '2', '3'],
        rows: [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ],
      },
    },
  })

  register({
    type: 'table_extract_col',
    label: 'Table Column',
    category: 'tableOps',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'table', label: 'Table' },
      { id: 'index', label: 'Column Index' },
    ],
    proOnly: true,
    defaultData: {
      blockType: 'table_extract_col',
      label: 'Table Col',
    },
  })
}
