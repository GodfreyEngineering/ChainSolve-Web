/**
 * timer-blocks.ts — 2.131: Timer block (wall-clock performance measurement).
 *
 * UI-only block. Measures wall-clock time between consecutive engine
 * evaluations. Shows: elapsed since last eval, mean interval, throughput
 * (evals/sec), and total eval count.
 *
 * Bridge remaps blockType='timer' → 'display' (pass-through).
 * The block has one optional input `signal` — its value is passed through
 * unchanged. The timer metrics are displayed inside the node.
 */

import type { BlockDef } from './registry'

export function registerTimerBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'timer',
    label: 'Timer',
    category: 'output',
    nodeKind: 'csTimer',
    inputs: [{ id: 'signal', label: 'Signal' }],
    proOnly: false,
    defaultData: {
      blockType: 'timer',
      label: 'Timer',
    },
  })
}
