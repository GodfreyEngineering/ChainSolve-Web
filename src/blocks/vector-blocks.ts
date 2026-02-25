/**
 * vector-blocks.ts — Vector operation blocks (Pro only).
 *
 * All use csOperation node kind. Evaluation is handled by the
 * Rust/WASM engine (W9.1).
 * Exports a registration function called by registry.ts (no circular imports).
 */

import type { BlockDef } from './types'

export function registerVectorBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'vectorLength',
    label: 'Vec Length',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'Vec' }],
    proOnly: true,
    defaultData: { blockType: 'vectorLength', label: 'Length' },
  })

  register({
    type: 'vectorSum',
    label: 'Vec Sum',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'Vec' }],
    proOnly: true,
    defaultData: { blockType: 'vectorSum', label: 'Sum' },
  })

  register({
    type: 'vectorMean',
    label: 'Vec Mean',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'Vec' }],
    proOnly: true,
    defaultData: { blockType: 'vectorMean', label: 'Mean' },
  })

  register({
    type: 'vectorMin',
    label: 'Vec Min',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'Vec' }],
    proOnly: true,
    defaultData: { blockType: 'vectorMin', label: 'Min' },
  })

  register({
    type: 'vectorMax',
    label: 'Vec Max',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'Vec' }],
    proOnly: true,
    defaultData: { blockType: 'vectorMax', label: 'Max' },
  })

  register({
    type: 'vectorSort',
    label: 'Vec Sort',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'Vec' }],
    proOnly: true,
    defaultData: { blockType: 'vectorSort', label: 'Sort' },
  })

  register({
    type: 'vectorReverse',
    label: 'Vec Reverse',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'Vec' }],
    proOnly: true,
    defaultData: { blockType: 'vectorReverse', label: 'Reverse' },
  })

  register({
    type: 'vectorSlice',
    label: 'Vec Slice',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'vec', label: 'Vec' },
      { id: 'start', label: 'Start' },
      { id: 'end', label: 'End' },
    ],
    proOnly: true,
    defaultData: { blockType: 'vectorSlice', label: 'Slice' },
  })

  register({
    type: 'vectorConcat',
    label: 'Vec Concat',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    proOnly: true,
    defaultData: { blockType: 'vectorConcat', label: 'Concat' },
  })

  register({
    type: 'vectorMap',
    label: 'Vec × Scalar',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'vec', label: 'Vec' },
      { id: 'scalar', label: 'Scalar' },
    ],
    proOnly: true,
    defaultData: { blockType: 'vectorMap', label: 'Vec × Scalar' },
  })
}
