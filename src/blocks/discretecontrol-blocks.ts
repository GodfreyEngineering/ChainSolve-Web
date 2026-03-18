/**
 * discretecontrol-blocks.ts — 2.70: ZeroOrderHold and RateTransition blocks.
 *
 * Mixed continuous/discrete simulation building blocks:
 *
 *  ZeroOrderHold: Samples the input at T_s intervals and holds the value
 *    until the next sample. In ChainSolve's reactive model, the block stores
 *    its last-sampled timestamp and value; outputs are updated only when the
 *    elapsed time since last sample exceeds T_s.
 *
 *  RateTransition: Converts data between different sample rates. In reactive
 *    mode, acts as a buffer that outputs the last received value at the target
 *    sample rate. Also enforces data type consistency at rate boundaries.
 *
 * Bridge: both block types → 'number' (pass-through in reactive eval).
 * Full hold semantics require the simulation worker (Category 8).
 */

import type { BlockDef } from './registry'

export function registerDiscreteControlBlocks(register: (def: BlockDef) => void): void {
  // ── Zero-Order Hold ────────────────────────────────────────────────────────
  register({
    type: 'ctrl.zoh',
    label: 'Zero-Order Hold',
    category: 'controlSystems',
    nodeKind: 'csZOH',
    inputs: [{ id: 'u', label: 'u (input)' }],
    proOnly: false,
    defaultData: {
      blockType: 'ctrl.zoh',
      label: 'Zero-Order Hold',
      /** Sample period in seconds. */
      samplePeriod: 0.01,
      /** Last sampled value (held output). */
      heldValue: 0,
      /** Simulation time of last sample (seconds). */
      lastSampleTime: -1,
      /** Current output value passed to engine. */
      value: 0,
    },
    synonyms: [
      'zero order hold',
      'ZOH',
      'sample hold',
      'discrete',
      'sampling',
      'ADC',
      'sample and hold',
    ],
    tags: ['control', 'discrete', 'sample', 'hold'],
    description:
      'Samples the input signal at the specified sample period and holds the value until the next sample — converts continuous signals to discrete-time.',
  })

  // ── Rate Transition ─────────────────────────────────────────────────────────
  register({
    type: 'ctrl.rateTransition',
    label: 'Rate Transition',
    category: 'controlSystems',
    nodeKind: 'csRateTransition',
    inputs: [{ id: 'u', label: 'u (input)' }],
    proOnly: false,
    defaultData: {
      blockType: 'ctrl.rateTransition',
      label: 'Rate Transition',
      /** Input sample rate (Hz). */
      inputRate: 1000,
      /** Output sample rate (Hz). */
      outputRate: 100,
      /** Interpolation at rate change: 'zoh' | 'linear'. */
      interpolation: 'zoh',
      /** Last received value from input side. */
      value: 0,
    },
    synonyms: [
      'rate transition',
      'sample rate',
      'decimation',
      'upsampling',
      'downsampling',
      'rate change',
      'multirate',
    ],
    tags: ['control', 'discrete', 'rate', 'sampling'],
    description:
      'Transfers data between blocks running at different sample rates (e.g., 1kHz sensor → 100Hz controller). Prevents data corruption at rate boundaries.',
  })
}
