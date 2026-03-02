/**
 * vector-blocks.ts — List operation blocks (Pro only).
 *
 * All use csOperation node kind. Evaluation is handled by the
 * Rust/WASM engine. Internal type IDs remain as "vector*" for
 * backward compatibility with existing projects.
 * Exports a registration function called by registry.ts (no circular imports).
 */

import type { BlockDef } from './types'

export function registerVectorBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'vectorLength',
    label: 'List Length',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'List' }],
    proOnly: true,
    defaultData: { blockType: 'vectorLength', label: 'Length' },
  })

  register({
    type: 'vectorSum',
    label: 'List Sum',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'List' }],
    proOnly: true,
    defaultData: { blockType: 'vectorSum', label: 'Sum' },
  })

  register({
    type: 'vectorMean',
    label: 'List Mean',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'List' }],
    proOnly: true,
    defaultData: { blockType: 'vectorMean', label: 'Mean' },
  })

  register({
    type: 'vectorMin',
    label: 'List Min',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'List' }],
    proOnly: true,
    defaultData: { blockType: 'vectorMin', label: 'Min' },
  })

  register({
    type: 'vectorMax',
    label: 'List Max',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'List' }],
    proOnly: true,
    defaultData: { blockType: 'vectorMax', label: 'Max' },
  })

  register({
    type: 'vectorSort',
    label: 'List Sort',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'List' }],
    proOnly: true,
    defaultData: { blockType: 'vectorSort', label: 'Sort' },
  })

  register({
    type: 'vectorReverse',
    label: 'List Reverse',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'List' }],
    proOnly: true,
    defaultData: { blockType: 'vectorReverse', label: 'Reverse' },
  })

  register({
    type: 'vectorSlice',
    label: 'List Slice',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'vec', label: 'List' },
      { id: 'start', label: 'Start' },
      { id: 'end', label: 'End' },
    ],
    proOnly: true,
    defaultData: { blockType: 'vectorSlice', label: 'Slice' },
  })

  register({
    type: 'vectorConcat',
    label: 'List Concat',
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
    label: 'List x Scalar',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'vec', label: 'List' },
      { id: 'scalar', label: 'Scalar' },
    ],
    proOnly: true,
    defaultData: { blockType: 'vectorMap', label: 'List x Scalar' },
  })
}
