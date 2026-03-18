/**
 * statespace-blocks.ts — 2.66: StateSpace block.
 *
 * Define a continuous-time LTI system:
 *   dx/dt = Ax + Bu
 *   y     = Cx + Du
 *
 * where A (n×n), B (n×m), C (p×n), D (p×m) are specified as comma/newline
 * separated matrices (rows separated by semicolons or newlines).
 *
 * Outputs:
 *   - step response (simulate with RK4, u=1)
 *   - eigenvalues (real/imaginary parts, for stability)
 *   - controllability rank
 *   - observability rank
 *
 * Bridge: blockType='stateSpace' → 'display' (UI-computed).
 */

import type { BlockDef } from './registry'

export function registerStateSpaceBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'stateSpace',
    label: 'State Space',
    category: 'controlSystems',
    nodeKind: 'csStateSpace',
    inputs: ['u'],
    proOnly: false,
    defaultData: {
      blockType: 'stateSpace',
      label: 'State Space',
      /** A matrix — rows separated by semicolons. E.g. '0,1;-2,-3' for 2nd order. */
      matA: '0, 1; -2, -3',
      /** B matrix. */
      matB: '0; 1',
      /** C matrix. */
      matC: '1, 0',
      /** D matrix (scalar or matrix). */
      matD: '0',
      /** Number of points for simulation. */
      nPoints: 200,
      /** End time for simulation (0 = auto). */
      tEnd: 0,
      /** Output mode: 'step' | 'impulse' | 'eigen'. */
      outputMode: 'step',
    },
    synonyms: [
      'state space', 'LTI', 'linear system', 'dx/dt', 'A B C D matrix',
      'controllability', 'observability', 'eigenvalue', 'poles',
    ],
    tags: ['control', 'LTI', 'state space', 'eigenvalue'],
    description:
      'Define dx/dt=Ax+Bu, y=Cx+Du. Simulates step/impulse response via RK4 and computes eigenvalues for stability analysis, controllability, and observability.',
  })
}
