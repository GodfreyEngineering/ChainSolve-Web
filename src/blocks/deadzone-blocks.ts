/**
 * deadzone-blocks.ts — 2.67: Dead Zone nonlinear control element.
 *
 * UI-only block (no Rust catalog entry). Applies a dead zone to its input:
 *   - if |u| <= band: output = 0
 *   - if u >  band: output = u - band
 *   - if u < -band: output = u + band
 *
 * (Offset dead zone — standard control theory definition, as in Simulink.)
 *
 * Bridge remaps blockType='ctrl.deadZone' → 'number' with node.data.value.
 * Input edges are excluded from the engine snapshot (UI-managed computation).
 */

import type { BlockDef } from './registry'

export function registerDeadZoneBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'ctrl.deadZone',
    label: 'Dead Zone',
    category: 'controlSystems',
    nodeKind: 'csDeadZone',
    inputs: [{ id: 'u', label: 'u (signal)' }],
    proOnly: false,
    defaultData: {
      blockType: 'ctrl.deadZone',
      label: 'Dead Zone',
      value: 0,
      /** Half-width of the dead zone. Input with |u| ≤ band maps to 0. */
      dzBand: 0.1,
    },
    synonyms: ['dead zone', 'deadband', 'dead band', 'threshold', 'nonlinear'],
    tags: ['control', 'nonlinear', 'signal'],
    description:
      'Dead zone: output = 0 when |u| ≤ band, u − band when u > band, u + band when u < −band. Standard nonlinear control element.',
  })
}
