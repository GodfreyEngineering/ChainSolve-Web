/**
 * scope-blocks.ts — 6.14: Scope block (real-time signal visualization).
 *
 * UI-only block. Reads its connected input's computed scalar value on
 * every engine evaluation cycle and accumulates a ring buffer of samples.
 * Renders a live line chart (SVG) showing signal evolution over time.
 *
 * Bridge remaps blockType='scope' → 'display' (pass-through).
 */

import type { BlockDef } from './registry'

export function registerScopeBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'scope',
    label: 'Scope',
    category: 'output',
    nodeKind: 'csScope',
    inputs: [{ id: 'signal', label: 'Signal' }],
    proOnly: false,
    defaultData: {
      blockType: 'scope',
      label: 'Scope',
      /** Number of samples to keep in the ring buffer. */
      scopeBufferSize: 100,
      /** Whether to show a horizontal zero reference line. */
      scopeShowZero: true,
      /** Whether to auto-scale Y axis. */
      scopeAutoScale: true,
      /** Manual Y axis min (when autoScale is false). */
      scopeYMin: -1,
      /** Manual Y axis max (when autoScale is false). */
      scopeYMax: 1,
    },
  })
}
