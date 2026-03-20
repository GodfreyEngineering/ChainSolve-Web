/**
 * ctrl-blocks.ts — Control Systems block pack (BLK-04).
 *
 * 11 blocks: step response, PID, frequency domain, stability metrics.
 * Evaluation handled by Rust/WASM engine ops (ctrl.* namespace).
 */

import type { BlockDef } from './types'

export function registerCtrlBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'ctrl.step_1st_order',
    label: 'Step 1st Order',
    category: 'controlSystems',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'K', label: 'K (gain)' },
      { id: 'tau', label: 'τ (s)' },
      { id: 't', label: 't (s)' },
    ],
    defaultData: { blockType: 'ctrl.step_1st_order', label: 'Step 1st Order' },
    description:
      'First-order step response: y(t) = K·(1 − e^(−t/τ)). Models RC circuits, thermal systems, and simple lags.',
    synonyms: ['first order', 'step response', 'time constant'],
    tags: ['control', 'dynamics'],
  })

  register({
    type: 'ctrl.step_2nd_order',
    label: 'Step 2nd Order',
    category: 'controlSystems',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'K', label: 'K (gain)' },
      { id: 'wn', label: 'ωn (rad/s)' },
      { id: 'zeta', label: 'ζ' },
      { id: 't', label: 't (s)' },
    ],
    defaultData: { blockType: 'ctrl.step_2nd_order', label: 'Step 2nd Order' },
    description:
      'Second-order step response with gain K, natural frequency ωn, and damping ratio ζ. Underdamped, critically damped, or overdamped.',
    synonyms: ['second order', 'step response', 'natural frequency'],
    tags: ['control', 'dynamics'],
  })

  register({
    type: 'ctrl.pid_output',
    label: 'PID Output',
    category: 'controlSystems',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Kp', label: 'K_p' },
      { id: 'Ki', label: 'K_i' },
      { id: 'Kd', label: 'K_d' },
      { id: 'error', label: 'e(t)' },
      { id: 'integral', label: '∫e dt' },
      { id: 'dt', label: 'Δt (s)' },
    ],
    defaultData: { blockType: 'ctrl.pid_output', label: 'PID Output' },
    description:
      'PID controller output: u = Kp·e + Ki·∫e dt + Kd·de/dt. Computes the control signal from error, integral, and derivative terms.',
    synonyms: ['PID', 'PID controller', 'proportional integral derivative'],
    tags: ['control', 'feedback'],
  })

  register({
    type: 'ctrl.rms',
    label: 'RMS',
    category: 'controlSystems',
    nodeKind: 'csOperation',
    inputs: [{ id: 'y', label: 'y (vector)' }],
    defaultData: { blockType: 'ctrl.rms', label: 'RMS' },
    description:
      'Root Mean Square of a signal vector: RMS = √(mean(y²)). Common measure of signal power.',
    synonyms: ['root mean square', 'RMS'],
    tags: ['control', 'signal'],
  })

  register({
    type: 'ctrl.peak2peak',
    label: 'Peak-to-Peak',
    category: 'controlSystems',
    nodeKind: 'csOperation',
    inputs: [{ id: 'y', label: 'y (vector)' }],
    defaultData: { blockType: 'ctrl.peak2peak', label: 'Peak-to-Peak' },
    description: 'Peak-to-peak amplitude of a signal vector: max(y) − min(y).',
    synonyms: ['peak to peak', 'amplitude', 'p2p'],
    tags: ['control', 'signal'],
  })

  register({
    type: 'ctrl.settling_time_2pct',
    label: 't_s ≈ 4τ',
    category: 'controlSystems',
    nodeKind: 'csOperation',
    inputs: [{ id: 'tau', label: 'τ (s)' }],
    defaultData: { blockType: 'ctrl.settling_time_2pct', label: 'Settling Time (2%)' },
    description:
      'Settling time (2% criterion): t_s ≈ 4τ. Time for the response to stay within 2% of final value.',
    synonyms: ['settling time', 'time constant'],
    tags: ['control', 'dynamics'],
  })

  register({
    type: 'ctrl.overshoot_2nd',
    label: '%OS',
    category: 'controlSystems',
    nodeKind: 'csOperation',
    inputs: [{ id: 'zeta', label: 'ζ (damping)' }],
    defaultData: { blockType: 'ctrl.overshoot_2nd', label: '% Overshoot' },
    description:
      'Percent overshoot for a second-order system: %OS = 100·exp(−π·ζ/√(1−ζ²)). Depends only on damping ratio.',
    synonyms: ['overshoot', 'percent overshoot', 'damping ratio'],
    tags: ['control', 'dynamics'],
  })

  register({
    type: 'ctrl.natural_freq',
    label: 'ωn = √(k/m)',
    category: 'controlSystems',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'k', label: 'k (N/m)' },
      { id: 'm', label: 'm (kg)' },
    ],
    defaultData: { blockType: 'ctrl.natural_freq', label: 'Natural Frequency' },
    description:
      'Undamped natural frequency: ωn = √(k/m). Resonant frequency of a spring-mass system (rad/s).',
    synonyms: ['natural frequency', 'undamped frequency'],
    tags: ['control', 'vibration'],
  })

  register({
    type: 'ctrl.damping_ratio',
    label: 'ζ = c/(2√km)',
    category: 'controlSystems',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'c', label: 'c (N·s/m)' },
      { id: 'k', label: 'k (N/m)' },
      { id: 'm', label: 'm (kg)' },
    ],
    defaultData: { blockType: 'ctrl.damping_ratio', label: 'Damping Ratio' },
    description:
      'Damping ratio: ζ = c / (2√(km)). ζ < 1 underdamped, ζ = 1 critically damped, ζ > 1 overdamped.',
    synonyms: ['damping ratio', 'critical damping'],
    tags: ['control', 'vibration'],
  })

  register({
    type: 'ctrl.bode_mag_1st',
    label: '|H(jω)| 1st Order',
    category: 'controlSystems',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'K', label: 'K (gain)' },
      { id: 'omega', label: 'ω (rad/s)' },
      { id: 'tau', label: 'τ (s)' },
    ],
    defaultData: { blockType: 'ctrl.bode_mag_1st', label: 'Bode Magnitude' },
    description:
      'Bode magnitude of a 1st-order transfer function: |H(jω)| = K / √(1 + (ωτ)²). Frequency response in dB.',
    synonyms: ['bode plot', 'frequency response', 'magnitude'],
    tags: ['control', 'frequency'],
  })

  // ── 2.67: Nonlinear control elements ────────────────────────────────────────

  register({
    type: 'ctrl.saturation',
    label: 'Saturation',
    category: 'controlSystems',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'val', label: 'u (signal)' },
      { id: 'lo', label: 'u_min' },
      { id: 'hi', label: 'u_max' },
    ],
    defaultData: { blockType: 'ctrl.saturation', label: 'Saturation', lo: -1, hi: 1 },
    synonyms: ['saturation', 'clamp output', 'limiter', 'limit signal', 'saturate'],
    tags: ['control', 'nonlinear', 'signal'],
    description:
      'Saturates signal u to [u_min, u_max]. Equivalent to a clamp. Output = u_min if u < u_min, u_max if u > u_max, else u. Essential nonlinear control element.',
  })

  // ── 2.68: Signal routing blocks ──────────────────────────────────────────────

  register({
    type: 'ctrl.switch',
    label: 'Switch',
    category: 'controlSystems',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'cond', label: 'Condition' },
      { id: 'then', label: 'u1 (if ≠ 0)' },
      { id: 'else', label: 'u2 (if = 0)' },
    ],
    defaultData: { blockType: 'ctrl.switch', label: 'Switch' },
    synonyms: ['switch', 'selector', 'conditional select', 'signal select', 'mux switch'],
    tags: ['control', 'routing', 'signal'],
    description:
      'Outputs u1 when condition is non-zero, u2 when condition is zero. Signal routing switch — like Simulink Switch.',
  })

  register({
    type: 'ctrl.mux',
    label: 'MUX',
    category: 'controlSystems',
    nodeKind: 'csOperation',
    variadic: true,
    inputs: [
      { id: 'in_0', label: 'u1' },
      { id: 'in_1', label: 'u2' },
    ],
    defaultData: { blockType: 'ctrl.mux', label: 'MUX', dynamicInputCount: 2 },
    synonyms: [
      'mux',
      'multiplex',
      'combine signals',
      'vector build',
      'signal combiner',
      'bus creator',
    ],
    tags: ['control', 'routing', 'signal', 'vector'],
    description:
      'Combines N scalar or vector signals into a single vector. Control-systems MUX — like Simulink Mux.',
  })
}
