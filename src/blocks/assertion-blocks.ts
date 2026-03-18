/**
 * assertion-blocks.ts — 2.130: Assertion (runtime validation) block.
 *
 * UI-only block (no Rust catalog entry). Reads an input value and checks:
 *   - Not NaN (unless allowNan)
 *   - Not Infinite (unless allowInf)
 *   - Within [min, max] range if set
 *
 * Rendered by AssertionNode. Bridge remaps blockType='assertion' → 'display'
 * so the engine treats it as pass-through.
 */

import type { BlockDef } from './registry'

export function registerAssertionBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'assertion',
    label: 'Assert',
    category: 'output',
    nodeKind: 'csAssertion',
    inputs: [{ id: 'value', label: 'Value' }],
    proOnly: false,
    defaultData: {
      blockType: 'assertion',
      label: 'Assert',
      /** Minimum allowed value (null = no lower bound). */
      min: null as number | null,
      /** Maximum allowed value (null = no upper bound). */
      max: null as number | null,
      /** Whether NaN is considered a pass. */
      allowNan: false,
      /** Whether ±Infinity is considered a pass. */
      allowInf: false,
      /** Optional message shown on failure. */
      message: '',
    },
  })
}
