/**
 * hdf5-blocks.ts — HDF5 import/export block pack (4.7).
 *
 * Blocks for reading and writing HDF5 hierarchical datasets.
 * Uses h5wasm (libhdf5 compiled to WASM) loaded lazily from CDN.
 */

import type { BlockDef } from './types'

export function registerHdf5Blocks(register: (def: BlockDef) => void): void {
  // ── HDF5 Import ───────────────────────────────────────────────────────────

  register({
    type: 'data.hdf5Import',
    label: 'HDF5 Import',
    category: 'data',
    nodeKind: 'csHdf5Import',
    inputs: [],
    proOnly: true,
    defaultData: {
      blockType: 'data.hdf5Import',
      label: 'HDF5 Import',
      hdf5FileName: null,
      hdf5DatasetPaths: [],
      hdf5SelectedDataset: null,
      tableData: null,
    },
    synonyms: [
      'hdf5',
      'h5',
      'hierarchical data format',
      'he5',
      'netcdf',
      'scientific data',
      'large arrays',
      'hdf',
    ],
    tags: ['hdf5', 'import', 'data', 'scientific'],
    description:
      'HDF5 Import: read .h5 / .hdf5 files containing scientific datasets. ' +
      'Loads all numeric datasets from the file hierarchy. ' +
      '1D datasets become table columns; 2D datasets unfold to rows×columns. ' +
      'Powered by h5wasm (libhdf5 compiled to WASM, ~2MB, CDN on first use). ' +
      'Output: table.',
  })

  // ── HDF5 Export ───────────────────────────────────────────────────────────

  register({
    type: 'data.hdf5Export',
    label: 'HDF5 Export',
    category: 'data',
    nodeKind: 'csOperation',
    inputs: [{ id: 'data', label: 'Table or vector' }],
    proOnly: true,
    defaultData: {
      blockType: 'data.hdf5Export',
      label: 'HDF5 Export',
      hdf5DatasetName: 'data',
    },
    synonyms: ['hdf5 export', 'h5 export', 'save hdf5', 'write hdf5'],
    tags: ['hdf5', 'export', 'data'],
    description:
      'HDF5 Export: write a table or vector to an HDF5 file. ' +
      'Downloads a .h5 file with the data stored as a dataset. ' +
      'Powered by h5wasm. Input: table or vector.',
  })
}
