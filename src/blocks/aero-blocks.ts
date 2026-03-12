/**
 * aero-blocks.ts — Aerospace Engineering block pack (BLK-03).
 *
 * 13 blocks: ISA atmosphere, aerodynamics, propulsion, orbital mechanics.
 * Evaluation handled by Rust/WASM engine ops (aero.* namespace).
 */

import type { BlockDef } from './types'

export function registerAeroBlocks(register: (def: BlockDef) => void): void {
  // ── ISA Standard Atmosphere ─────────────────────────────────────────

  register({
    type: 'aero.ISA_T',
    label: 'ISA T(h)',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [{ id: 'h', label: 'h (m)' }],
    defaultData: { blockType: 'aero.ISA_T', label: 'ISA Temperature' },
    synonyms: ['ISA', 'standard atmosphere', 'temperature altitude'],
    tags: ['aerospace', 'atmosphere'],
  })

  register({
    type: 'aero.ISA_P',
    label: 'ISA P(h)',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [{ id: 'h', label: 'h (m)' }],
    defaultData: { blockType: 'aero.ISA_P', label: 'ISA Pressure' },
    synonyms: ['ISA', 'standard atmosphere', 'pressure altitude'],
  })

  register({
    type: 'aero.ISA_rho',
    label: 'ISA ρ(h)',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [{ id: 'h', label: 'h (m)' }],
    defaultData: { blockType: 'aero.ISA_rho', label: 'ISA Density' },
    synonyms: ['ISA', 'air density', 'standard atmosphere'],
  })

  register({
    type: 'aero.ISA_a',
    label: 'ISA a(h)',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [{ id: 'h', label: 'h (m)' }],
    defaultData: { blockType: 'aero.ISA_a', label: 'Speed of Sound' },
    synonyms: ['speed of sound', 'ISA', 'acoustic velocity'],
  })

  // ── Aerodynamics ────────────────────────────────────────────────────

  register({
    type: 'aero.mach_from_v',
    label: 'M = v/a',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'v', label: 'v (m/s)' },
      { id: 'a', label: 'a (m/s)' },
    ],
    defaultData: { blockType: 'aero.mach_from_v', label: 'Mach Number' },
    synonyms: ['mach', 'mach number', 'velocity'],
  })

  register({
    type: 'aero.dynamic_q',
    label: 'q = ½ρv²',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'rho', label: 'ρ (kg/m³)' },
      { id: 'v', label: 'v (m/s)' },
    ],
    defaultData: { blockType: 'aero.dynamic_q', label: 'Dynamic Pressure' },
    synonyms: ['dynamic pressure', 'aerodynamic pressure'],
  })

  register({
    type: 'aero.lift',
    label: 'L = CL·q·S',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'CL', label: 'C_L' },
      { id: 'q', label: 'q (Pa)' },
      { id: 'S', label: 'S (m²)' },
    ],
    defaultData: { blockType: 'aero.lift', label: 'Lift Force' },
    synonyms: ['lift', 'aerodynamic lift'],
  })

  register({
    type: 'aero.drag',
    label: 'D = CD·q·S',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'CD', label: 'C_D' },
      { id: 'q', label: 'q (Pa)' },
      { id: 'S', label: 'S (m²)' },
    ],
    defaultData: { blockType: 'aero.drag', label: 'Drag Force' },
    synonyms: ['drag', 'aerodynamic drag'],
  })

  // ── Propulsion ──────────────────────────────────────────────────────

  register({
    type: 'aero.tsfc',
    label: 'TSFC',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'thrust', label: 'Thrust (N)' },
      { id: 'fuel_flow', label: 'ṁ_fuel (kg/s)' },
    ],
    defaultData: { blockType: 'aero.tsfc', label: 'TSFC' },
    synonyms: ['TSFC', 'thrust specific fuel consumption', 'fuel efficiency'],
  })

  register({
    type: 'aero.tsiolkovsky',
    label: 'Δv = Isp·g₀·ln(m₀/mf)',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'Isp', label: 'Isp (s)' },
      { id: 'g0', label: 'g₀ (m/s²)' },
      { id: 'm0', label: 'm₀ (kg)' },
      { id: 'mf', label: 'm_f (kg)' },
    ],
    defaultData: {
      blockType: 'aero.tsiolkovsky',
      label: 'Tsiolkovsky Δv',
      manualValues: { g0: 9.80665 },
    },
    synonyms: ['rocket equation', 'Tsiolkovsky', 'delta-v'],
  })

  // ── Orbital Mechanics ───────────────────────────────────────────────

  register({
    type: 'aero.orbital_v',
    label: 'v = √(GM/r)',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'GM', label: 'GM (m³/s²)' },
      { id: 'r', label: 'r (m)' },
    ],
    defaultData: {
      blockType: 'aero.orbital_v',
      label: 'Orbital Velocity',
      manualValues: { GM: 3.986004418e14 },
    },
    synonyms: ['orbital velocity', 'circular orbit'],
  })

  register({
    type: 'aero.escape_v',
    label: 'v_esc = √(2GM/r)',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'GM', label: 'GM (m³/s²)' },
      { id: 'r', label: 'r (m)' },
    ],
    defaultData: {
      blockType: 'aero.escape_v',
      label: 'Escape Velocity',
      manualValues: { GM: 3.986004418e14 },
    },
    synonyms: ['escape velocity', 'escape speed'],
  })

  register({
    type: 'aero.hohmann_dv1',
    label: 'Hohmann Δv₁',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'GM', label: 'GM (m³/s²)' },
      { id: 'r1', label: 'r₁ (m)' },
      { id: 'r2', label: 'r₂ (m)' },
    ],
    defaultData: {
      blockType: 'aero.hohmann_dv1',
      label: 'Hohmann Δv₁',
      manualValues: { GM: 3.986004418e14 },
    },
    synonyms: ['Hohmann transfer', 'orbital transfer', 'delta-v'],
  })

  register({
    type: 'aero.hohmann_dv2',
    label: 'Hohmann Δv₂',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [
      { id: 'GM', label: 'GM (m³/s²)' },
      { id: 'r1', label: 'r₁ (m)' },
      { id: 'r2', label: 'r₂ (m)' },
    ],
    defaultData: {
      blockType: 'aero.hohmann_dv2',
      label: 'Hohmann Δv₂',
      manualValues: { GM: 3.986004418e14 },
    },
    synonyms: ['Hohmann transfer', 'orbital transfer', 'delta-v'],
  })
}
