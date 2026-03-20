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
    description: 'Returns the number of elements in a list.',
    synonyms: ['count', 'size', 'list length'],
    tags: ['list', 'aggregate'],
  })

  register({
    type: 'vectorSum',
    label: 'List Sum',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'List' }],
    proOnly: true,
    defaultData: { blockType: 'vectorSum', label: 'Sum' },
    description: 'Sums all elements of a list.',
    synonyms: ['total', 'sum list', 'aggregate'],
    tags: ['list', 'aggregate'],
  })

  register({
    type: 'vectorMean',
    label: 'List Mean',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'List' }],
    proOnly: true,
    defaultData: { blockType: 'vectorMean', label: 'Mean' },
    description: 'Arithmetic mean (average) of all elements in a list.',
    synonyms: ['average', 'mean list', 'avg'],
    tags: ['list', 'aggregate'],
  })

  register({
    type: 'vectorMin',
    label: 'List Min',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'List' }],
    proOnly: true,
    defaultData: { blockType: 'vectorMin', label: 'Min' },
    description: 'Returns the minimum value in a list.',
    synonyms: ['minimum', 'smallest', 'list min'],
    tags: ['list', 'aggregate'],
  })

  register({
    type: 'vectorMax',
    label: 'List Max',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'List' }],
    proOnly: true,
    defaultData: { blockType: 'vectorMax', label: 'Max' },
    description: 'Returns the maximum value in a list.',
    synonyms: ['maximum', 'largest', 'list max'],
    tags: ['list', 'aggregate'],
  })

  register({
    type: 'vectorSort',
    label: 'List Sort',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'List' }],
    proOnly: true,
    defaultData: { blockType: 'vectorSort', label: 'Sort' },
    description: 'Sorts a list in ascending order.',
    synonyms: ['sort', 'order', 'ascending'],
    tags: ['list', 'transform'],
  })

  register({
    type: 'vectorReverse',
    label: 'List Reverse',
    category: 'vectorOps',
    nodeKind: 'csOperation',
    inputs: [{ id: 'vec', label: 'List' }],
    proOnly: true,
    defaultData: { blockType: 'vectorReverse', label: 'Reverse' },
    description: 'Reverses the order of elements in a list.',
    synonyms: ['reverse', 'flip', 'invert order'],
    tags: ['list', 'transform'],
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
    description: 'Extracts a sub-list from Start to End index (0-based, exclusive end).',
    synonyms: ['sublist', 'range', 'slice'],
    tags: ['list', 'transform'],
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
    description: 'Concatenates two lists into one.',
    synonyms: ['join', 'merge', 'append lists'],
    tags: ['list', 'transform'],
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
    description: 'Multiplies every element of a list by a scalar value.',
    synonyms: ['scale', 'multiply list', 'scalar multiply'],
    tags: ['list', 'transform'],
  })
}
