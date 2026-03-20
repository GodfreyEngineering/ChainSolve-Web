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
    description:
      'ISA standard atmosphere temperature at altitude h (m). Uses lapse rate model for troposphere and stratosphere.',
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
    description:
      'ISA standard atmosphere pressure at altitude h (m). Barometric formula for troposphere and stratosphere.',
    synonyms: ['ISA', 'standard atmosphere', 'pressure altitude'],
    tags: ['aerospace', 'atmosphere'],
  })

  register({
    type: 'aero.ISA_rho',
    label: 'ISA ρ(h)',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [{ id: 'h', label: 'h (m)' }],
    defaultData: { blockType: 'aero.ISA_rho', label: 'ISA Density' },
    description:
      'ISA standard atmosphere air density at altitude h (m). Derived from pressure and temperature via ideal gas law.',
    synonyms: ['ISA', 'air density', 'standard atmosphere'],
    tags: ['aerospace', 'atmosphere'],
  })

  register({
    type: 'aero.ISA_a',
    label: 'ISA a(h)',
    category: 'aerospace',
    nodeKind: 'csOperation',
    inputs: [{ id: 'h', label: 'h (m)' }],
    defaultData: { blockType: 'aero.ISA_a', label: 'Speed of Sound' },
    description: 'Speed of sound at altitude h (m). a = sqrt(γ·R·T) using ISA temperature.',
    synonyms: ['speed of sound', 'ISA', 'acoustic velocity'],
    tags: ['aerospace', 'atmosphere'],
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
    description: 'Mach number: M = v / a. Ratio of velocity to speed of sound.',
    synonyms: ['mach', 'mach number', 'velocity'],
    tags: ['aerospace', 'aerodynamics'],
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
    description: 'Dynamic pressure: q = ½ρv². Kinetic energy per unit volume of the airflow (Pa).',
    synonyms: ['dynamic pressure', 'aerodynamic pressure'],
    tags: ['aerospace', 'aerodynamics'],
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
    description:
      'Aerodynamic lift force: L = C_L · q · S. Product of lift coefficient, dynamic pressure, and reference area (N).',
    synonyms: ['lift', 'aerodynamic lift'],
    tags: ['aerospace', 'aerodynamics'],
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
    description:
      'Aerodynamic drag force: D = C_D · q · S. Product of drag coefficient, dynamic pressure, and reference area (N).',
    synonyms: ['drag', 'aerodynamic drag'],
    tags: ['aerospace', 'aerodynamics'],
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
    description:
      'Thrust Specific Fuel Consumption: TSFC = ṁ_fuel / Thrust. Lower is more fuel-efficient (kg/(N·s)).',
    synonyms: ['TSFC', 'thrust specific fuel consumption', 'fuel efficiency'],
    tags: ['aerospace', 'propulsion'],
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
    description:
      'Tsiolkovsky rocket equation: Δv = Isp · g₀ · ln(m₀/m_f). Computes maximum velocity change from propellant mass ratio.',
    synonyms: ['rocket equation', 'Tsiolkovsky', 'delta-v'],
    tags: ['aerospace', 'propulsion', 'orbital'],
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
    description:
      'Circular orbital velocity: v = √(GM/r). Speed for a circular orbit at radius r from body center.',
    synonyms: ['orbital velocity', 'circular orbit'],
    tags: ['aerospace', 'orbital'],
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
    description:
      'Escape velocity: v_esc = √(2GM/r). Minimum speed to escape gravitational field from radius r.',
    synonyms: ['escape velocity', 'escape speed'],
    tags: ['aerospace', 'orbital'],
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
    description:
      'First burn Δv for a Hohmann transfer orbit from radius r₁ to r₂. Accelerates from circular orbit to transfer ellipse.',
    synonyms: ['Hohmann transfer', 'orbital transfer', 'delta-v'],
    tags: ['aerospace', 'orbital'],
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
    description:
      'Second burn Δv for a Hohmann transfer orbit. Circularises from the transfer ellipse into the target orbit at r₂.',
    synonyms: ['Hohmann transfer', 'orbital transfer', 'delta-v'],
    tags: ['aerospace', 'orbital'],
  })
}
