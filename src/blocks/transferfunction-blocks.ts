/**
 * transferfunction-blocks.ts — 2.65: TransferFunction block.
 *
 * Define a continuous-time linear transfer function G(s) = num(s)/den(s)
 * specified by polynomial coefficient arrays (highest power first, MATLAB style).
 *
 * Outputs:
 *   - step_time: vector of time points for step response
 *   - step_response: vector of output values
 *   - bode_freq: vector of frequencies (rad/s)
 *   - bode_mag: vector of magnitudes (dB)
 *   - bode_phase: vector of phases (degrees)
 *
 * The block is UI-computed: step/impulse response and frequency response are
 * evaluated in TypeScript using the bilinear transform (Tustin) for step
 * response and direct evaluation of |G(jω)| for Bode.
 *
 * Bridge: blockType='transferFunction' → 'display' (no engine computation).
 */

import type { BlockDef } from './registry'

export function registerTransferFunctionBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'transferFunction',
    label: 'Transfer Function',
    category: 'controlSystems',
    nodeKind: 'csTransferFunction',
    inputs: ['u'],
    proOnly: false,
    defaultData: {
      blockType: 'transferFunction',
      label: 'Transfer Function',
      /** Numerator coefficients, highest power first. E.g. [1] for G(s)=1/(s²+2s+1). */
      numerator: [1],
      /** Denominator coefficients, highest power first. E.g. [1,2,1] for 2nd order. */
      denominator: [1, 2, 1],
      /** Number of time points for step/impulse response. */
      nPoints: 200,
      /** End time for step response (0 = auto from pole time constants). */
      tEnd: 0,
      /** Frequency range start (rad/s) for Bode. */
      wMin: 0.01,
      /** Frequency range end (rad/s) for Bode. */
      wMax: 100,
      /** Output mode: 'step' | 'impulse' | 'bode'. */
      outputMode: 'step',
    },
    synonyms: [
      'transfer function', 'Laplace', 'G(s)', 'frequency response', 'Bode', 'step response',
      'impulse response', 'LTI', 'linear time invariant', 'numerator', 'denominator', 'poles zeros',
    ],
    tags: ['control', 'LTI', 'frequency', 'Bode'],
    description:
      'Define G(s) = num(s)/den(s) as coefficient arrays. Computes step response, impulse response, and Bode plot (magnitude + phase vs frequency).',
  })
}
