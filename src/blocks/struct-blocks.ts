/**
 * struct-blocks.ts — Structural / Civil Engineering block pack (BLK-02).
 *
 * 9 blocks covering beam deflection, buckling, stress, and bearing capacity.
 * Evaluation handled by Rust/WASM engine ops (struct.* namespace).
 */

import type { BlockDef } from './types'

export function registerStructBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'struct.beam_deflect_ss',
    label: 'δ = PL³/48EI',
    category: 'structural',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'P', label: 'P (N)' },
      { id: 'L', label: 'L (m)' },
      { id: 'E', label: 'E (Pa)' },
      { id: 'I', label: 'I (m⁴)' },
    ],
    defaultData: { blockType: 'struct.beam_deflect_ss', label: 'Beam Deflection SS' },
    synonyms: ['beam', 'deflection', 'simply supported'],
    tags: ['structural', 'civil'],
  })

  register({
    type: 'struct.beam_deflect_cantilever',
    label: 'δ = PL³/3EI',
    category: 'structural',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'P', label: 'P (N)' },
      { id: 'L', label: 'L (m)' },
      { id: 'E', label: 'E (Pa)' },
      { id: 'I', label: 'I (m⁴)' },
    ],
    defaultData: { blockType: 'struct.beam_deflect_cantilever', label: 'Cantilever Deflection' },
    synonyms: ['cantilever', 'beam', 'deflection'],
  })

  register({
    type: 'struct.beam_moment_ss',
    label: 'M = Pab/L',
    category: 'structural',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'P', label: 'P (N)' },
      { id: 'a', label: 'a (m)' },
      { id: 'b', label: 'b (m)' },
      { id: 'L', label: 'L (m)' },
    ],
    defaultData: { blockType: 'struct.beam_moment_ss', label: 'Beam Moment SS' },
    synonyms: ['bending moment', 'beam'],
  })

  register({
    type: 'struct.euler_buckling',
    label: 'P_cr = π²EI/(KL)²',
    category: 'structural',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'E', label: 'E (Pa)' },
      { id: 'I', label: 'I (m⁴)' },
      { id: 'L', label: 'L (m)' },
      { id: 'K', label: 'K (eff. len)' },
    ],
    defaultData: {
      blockType: 'struct.euler_buckling',
      label: 'Euler Buckling',
      manualValues: { K: 1.0 },
    },
    synonyms: ['buckling', 'column', 'critical load'],
  })

  register({
    type: 'struct.von_mises',
    label: 'σ_vm (Von Mises)',
    category: 'structural',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'sx', label: 'σ_x (Pa)' },
      { id: 'sy', label: 'σ_y (Pa)' },
      { id: 'txy', label: 'τ_xy (Pa)' },
    ],
    defaultData: { blockType: 'struct.von_mises', label: 'Von Mises' },
    synonyms: ['von mises', 'yield', 'equivalent stress'],
  })

  register({
    type: 'struct.combined_stress',
    label: 'σ = σ_ax + σ_bend',
    category: 'structural',
    nodeKind: 'csOperation',
    inputs: [
      { id: 's_ax', label: 'σ_axial (Pa)' },
      { id: 's_bend', label: 'σ_bending (Pa)' },
    ],
    defaultData: { blockType: 'struct.combined_stress', label: 'Combined Stress' },
  })

  register({
    type: 'struct.steel_check',
    label: 'Util = σ/(Fy·φ)',
    category: 'structural',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'sigma', label: 'σ (Pa)' },
      { id: 'Fy', label: 'F_y (Pa)' },
      { id: 'phi', label: 'φ' },
    ],
    defaultData: {
      blockType: 'struct.steel_check',
      label: 'Steel Utilization',
      manualValues: { phi: 0.9 },
    },
    synonyms: ['utilization ratio', 'AISC', 'steel design'],
  })

  register({
    type: 'struct.bearing_capacity',
    label: 'q_ult (Terzaghi)',
    category: 'structural',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'c', label: 'c (Pa)' },
      { id: 'gamma', label: 'γ (kN/m³)' },
      { id: 'D', label: 'D_f (m)' },
      { id: 'B', label: 'B (m)' },
      { id: 'Nc', label: 'N_c' },
      { id: 'Nq', label: 'N_q' },
      { id: 'Ngamma', label: 'N_γ' },
    ],
    defaultData: { blockType: 'struct.bearing_capacity', label: 'Bearing Capacity' },
    synonyms: ['bearing capacity', 'Terzaghi', 'foundation'],
  })

  register({
    type: 'struct.concrete_moment_aci',
    label: 'M_n (ACI)',
    category: 'structural',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'fc', label: "f'c (Pa)" },
      { id: 'b', label: 'b (m)' },
      { id: 'd', label: 'd (m)' },
      { id: 'As', label: 'A_s (m²)' },
      { id: 'fy', label: 'f_y (Pa)' },
    ],
    defaultData: { blockType: 'struct.concrete_moment_aci', label: 'ACI Moment Capacity' },
    synonyms: ['ACI', 'concrete', 'flexural capacity'],
  })
}
