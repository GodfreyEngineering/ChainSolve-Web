/**
 * test-blocks.ts — 11.14: Assertion and test blocks for graph validation.
 *
 * TestBlock: compares actual (connected input) against expected (node data)
 * with configurable absolute or relative tolerance. Shows ✓ PASS / ✗ FAIL.
 * Engine-side: remapped to 'display' pass-through in bridge.ts (no WASM change).
 */

import type { BlockDef } from './types'

export function registerTestBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'testBlock',
    label: 'Test (Assert)',
    category: 'output',
    nodeKind: 'csTest',
    inputs: [{ id: 'actual', label: 'Actual' }],
    proOnly: false,
    description:
      'Assertion block: compares the connected "actual" scalar value against an "expected" value within a configurable tolerance. Shows ✓ PASS (green) or ✗ FAIL (red) inline. Useful for building regression-test graphs.',
    defaultData: {
      blockType: 'testBlock',
      label: 'Assert',
      expected: 0,
      tolerance: 1e-9,
      toleranceMode: 'absolute',
    },
  })
}
