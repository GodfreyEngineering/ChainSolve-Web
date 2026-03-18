/**
 * fileinput-blocks.ts — 2.9: FileInput drag-and-drop block.
 *
 * A unified file import block that accepts CSV, TSV, JSON, and plain-text
 * numeric formats via drag-and-drop or file picker. Parsed data is stored
 * as tableData (same format as tableInput) and bridge-remapped to 'tableInput'
 * so the Rust engine processes it as a standard table.
 *
 * Supported formats (client-side parsing):
 *   - CSV (comma-delimited, auto-detects header row)
 *   - TSV (tab-delimited)
 *   - JSON (array of arrays OR array of objects)
 *   - Plain text (whitespace-delimited numbers)
 *
 * Note: HDF5, Parquet, MATLAB .mat, NumPy .npz require additional WASM
 * libraries and are out of scope for this initial client-side implementation.
 */

import type { BlockDef } from './registry'

export function registerFileInputBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'fileInput',
    label: 'File Input',
    category: 'data',
    nodeKind: 'csFileInput',
    inputs: [],
    proOnly: true,
    defaultData: {
      blockType: 'fileInput',
      label: 'File Input',
      tableData: { columns: [] as string[], rows: [] as number[][] },
      /** Original file name for display. */
      fileName: '',
      /** File size in bytes (for display). */
      fileSize: 0,
      /** Whether the first row of CSV was treated as a header. */
      hasHeader: true,
    },
    synonyms: ['file', 'import', 'drag drop', 'csv file', 'data file', 'upload', 'load'],
    tags: ['data', 'import', 'file'],
    description:
      'Drag-and-drop file import block. Accepts CSV, TSV, JSON, and plain-text numeric data. Outputs per-column vectors or the whole table.',
  })
}
