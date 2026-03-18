/**
 * parquet-blocks.ts — 4.8: Parquet columnar format import/export.
 *
 * Parquet is the de facto standard for large-scale columnar data exchange
 * (Apache Spark, Pandas, DuckDB, etc.). These blocks bridge between the
 * Parquet binary format and ChainSolve's Table value type.
 *
 * Engine blocks:
 *   - parquet_import: reads parquetBytes (u8 array) → Table
 *   - parquet_export: Table → parquetBytes (Vector of u8 as f64)
 *
 * The UI serialises the file as a JSON array of byte values stored in
 * data.parquetBytes. This matches the pattern used by mat_import.
 */

import type { BlockDef } from './registry'

export function registerParquetBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'parquet_import',
    label: 'Parquet Import',
    category: 'data',
    nodeKind: 'csSource',
    inputs: [],
    proOnly: false,
    defaultData: {
      blockType: 'parquet_import',
      label: 'Parquet Import',
      /** Raw Parquet file bytes as a JSON array of u8 integers. */
      parquetBytes: [] as number[],
      /** Original file name for display. */
      fileName: '',
      /** File size in bytes (for display). */
      fileSize: 0,
    },
    synonyms: [
      'parquet', 'columnar', 'arrow', 'pandas', 'spark',
      'duckdb', '.parquet', 'import parquet', 'load parquet',
    ],
    tags: ['data', 'import', 'file', 'columnar', 'parquet'],
    description:
      'Import a Parquet columnar data file. Accepts a .parquet file (PLAIN encoding, UNCOMPRESSED). ' +
      'All numeric columns (DOUBLE, FLOAT, INT32, INT64) are combined into a Table output.',
  })

  register({
    type: 'parquet_export',
    label: 'Parquet Export',
    category: 'data',
    nodeKind: 'csOperation',
    inputs: [{ id: 'table', label: 'Table' }],
    proOnly: false,
    defaultData: {
      blockType: 'parquet_export',
      label: 'Parquet Export',
    },
    synonyms: [
      'parquet', 'columnar', 'export parquet', 'save parquet', 'download parquet',
      'write parquet', '.parquet',
    ],
    tags: ['data', 'export', 'file', 'columnar', 'parquet'],
    description:
      'Export a Table to Parquet binary format. Outputs a Vector of byte values (u8 as f64). ' +
      'The UI downloads this as a .parquet file. Uses PLAIN encoding, UNCOMPRESSED.',
  })
}
