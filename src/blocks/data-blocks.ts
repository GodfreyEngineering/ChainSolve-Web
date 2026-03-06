/**
 * data-blocks.ts — Data input blocks (Pro only).
 *
 * List Input — uses the csData node kind, produces a 1xN vector.
 * Evaluation is handled by the Rust/WASM engine.
 * Exports a registration function called by registry.ts (no circular imports).
 */

import type { BlockDef } from './types'

export function registerDataBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'vectorInput',
    label: 'Array Input',
    category: 'data',
    nodeKind: 'csData',
    inputs: [],
    proOnly: true,
    defaultData: {
      blockType: 'vectorInput',
      label: 'Array',
      vectorData: [],
    },
  })
}
