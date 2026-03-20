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
    description:
      'Spreadsheet-style table input with named columns. Each column is a separate output port. Import from CSV or type values directly.',
    synonyms: ['spreadsheet', 'csv', 'data table', 'grid'],
    tags: ['data', 'input'],
  })

  // 2.7: MatrixInput — 2D numeric array with row/col index headers.
  // Engine evaluates it as tableInput (reads tableData). Pro only (data category).
  register({
    type: 'matrixInput',
    label: 'Matrix Input',
    category: 'data',
    nodeKind: 'csData',
    inputs: [],
    proOnly: true,
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
    description:
      '2D numeric matrix input with row/col index headers. Single output port emits the whole matrix as a Table value.',
    synonyms: ['matrix', 'grid', '2d array', 'numeric table'],
    tags: ['data', 'input', 'matrix'],
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
    description:
      'Extracts a single column from a table as a list. Specify the column index (0-based).',
    synonyms: ['column', 'extract', 'select column'],
    tags: ['data', 'table'],
  })
}
