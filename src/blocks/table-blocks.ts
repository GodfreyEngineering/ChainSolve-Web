/**
 * table-blocks.ts — Table operation blocks (Pro only).
 *
 * All use csOperation node kind. Evaluation is handled by the
 * Rust/WASM engine (W9.1).
 * Exports a registration function called by registry.ts (no circular imports).
 */

import type { BlockDef } from './types'

export function registerTableBlocks(register: (def: BlockDef) => void): void {
  register({
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
  })

  register({
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
  })

  register({
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
  })

  register({
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
  })

  register({
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
  })
}
