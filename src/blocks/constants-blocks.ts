/**
 * constants-blocks.ts — Constants block pack (W11c).
 *
 * 31 source blocks across 5 categories: Math Constants, Physics,
 * Atmospheric, Thermodynamic, Electrical.
 *
 * Material/fluid presets are handled by the unified Material node (H3-1)
 * via materialCatalog.ts and no longer registered as individual blocks.
 *
 * All blocks are FREE (not Pro-only). Each is a zero-input source
 * that outputs a single scalar constant evaluated by the Rust/WASM engine.
 *
 * Exports a registration function called by registry.ts.
 */

import type { BlockDef } from './types'

export function registerConstantsBlocks(register: (def: BlockDef) => void): void {
  // ── Math Constants ──────────────────────────────────────────────────

  register({
    type: 'const.math.sqrt2',
    label: '√2',
    category: 'constMath',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.math.sqrt2', label: '√2' },
  })

  register({
    type: 'const.math.ln2',
    label: 'ln 2',
    category: 'constMath',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.math.ln2', label: 'ln 2' },
  })

  register({
    type: 'const.math.ln10',
    label: 'ln 10',
    category: 'constMath',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.math.ln10', label: 'ln 10' },
  })

  // ── Physics Constants ───────────────────────────────────────────────

  register({
    type: 'const.physics.g0',
    label: 'g₀ (9.807 m/s²)',
    category: 'constPhysics',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.physics.g0', label: 'g₀' },
  })

  register({
    type: 'const.physics.R_molar',
    label: 'R (8.314 J/mol·K)',
    category: 'constPhysics',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.physics.R_molar', label: 'R' },
  })

  register({
    type: 'const.physics.c',
    label: 'c (3×10⁸ m/s)',
    category: 'constPhysics',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.physics.c', label: 'c' },
  })

  register({
    type: 'const.physics.h',
    label: 'h (Planck)',
    category: 'constPhysics',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.physics.h', label: 'h' },
  })

  register({
    type: 'const.physics.hbar',
    label: 'ℏ (h-bar)',
    category: 'constPhysics',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.physics.hbar', label: 'ℏ' },
  })

  register({
    type: 'const.physics.kB',
    label: 'kB (Boltzmann)',
    category: 'constPhysics',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.physics.kB', label: 'kB' },
  })

  register({
    type: 'const.physics.Na',
    label: 'Nₐ (Avogadro)',
    category: 'constPhysics',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.physics.Na', label: 'Nₐ' },
  })

  register({
    type: 'const.physics.qe',
    label: 'qₑ (electron charge)',
    category: 'constPhysics',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.physics.qe', label: 'qₑ' },
  })

  register({
    type: 'const.physics.F',
    label: 'F (Faraday)',
    category: 'constPhysics',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.physics.F', label: 'F' },
  })

  register({
    type: 'const.physics.me',
    label: 'mₑ (electron mass)',
    category: 'constPhysics',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.physics.me', label: 'mₑ' },
  })

  register({
    type: 'const.physics.mp',
    label: 'mₚ (proton mass)',
    category: 'constPhysics',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.physics.mp', label: 'mₚ' },
  })

  register({
    type: 'const.physics.G',
    label: 'G (gravitational)',
    category: 'constPhysics',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.physics.G', label: 'G' },
  })

  register({
    type: 'const.physics.mu0',
    label: 'μ₀ (permeability)',
    category: 'constPhysics',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.physics.mu0', label: 'μ₀' },
  })

  register({
    type: 'const.physics.eps0',
    label: 'ε₀ (permittivity)',
    category: 'constPhysics',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.physics.eps0', label: 'ε₀' },
  })

  register({
    type: 'const.physics.sigma_sb',
    label: 'σ (Stefan-Boltzmann)',
    category: 'constPhysics',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.physics.sigma_sb', label: 'σ_SB' },
  })

  // ── Atmospheric Constants ───────────────────────────────────────────

  register({
    type: 'const.atmos.p0_pa',
    label: 'p₀ (101 325 Pa)',
    category: 'constAtmos',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.atmos.p0_pa', label: 'p₀' },
  })

  register({
    type: 'const.atmos.t0_k',
    label: 'T₀ (288.15 K)',
    category: 'constAtmos',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.atmos.t0_k', label: 'T₀' },
  })

  register({
    type: 'const.atmos.rho_air_sl',
    label: 'ρ_air (1.225 kg/m³)',
    category: 'constAtmos',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.atmos.rho_air_sl', label: 'ρ_air' },
  })

  register({
    type: 'const.atmos.gamma_air',
    label: 'γ_air (1.4)',
    category: 'constAtmos',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.atmos.gamma_air', label: 'γ_air' },
  })

  register({
    type: 'const.atmos.R_air',
    label: 'R_air (287.05 J/kg·K)',
    category: 'constAtmos',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.atmos.R_air', label: 'R_air' },
  })

  register({
    type: 'const.atmos.mu_air_20c',
    label: 'μ_air (1.81e-5 Pa·s)',
    category: 'constAtmos',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.atmos.mu_air_20c', label: 'μ_air' },
  })

  register({
    type: 'const.atmos.a_air_20c',
    label: 'a_air (343 m/s)',
    category: 'constAtmos',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.atmos.a_air_20c', label: 'a_air' },
  })

  // ── Thermodynamic Constants ─────────────────────────────────────────

  register({
    type: 'const.thermo.cp_air',
    label: 'cp_air (1005 J/kg·K)',
    category: 'constThermo',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.thermo.cp_air', label: 'cp_air' },
  })

  register({
    type: 'const.thermo.cv_air',
    label: 'cv_air (718 J/kg·K)',
    category: 'constThermo',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.thermo.cv_air', label: 'cv_air' },
  })

  register({
    type: 'const.thermo.k_air',
    label: 'k_air (0.026 W/m·K)',
    category: 'constThermo',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.thermo.k_air', label: 'k_air' },
  })

  register({
    type: 'const.thermo.k_water',
    label: 'k_water (0.606 W/m·K)',
    category: 'constThermo',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.thermo.k_water', label: 'k_water' },
  })

  // ── Electrical Constants ────────────────────────────────────────────

  register({
    type: 'const.elec.rho_copper',
    label: 'ρ_Cu (1.68e-8 Ω·m)',
    category: 'constElec',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.elec.rho_copper', label: 'ρ_Cu' },
  })

  register({
    type: 'const.elec.rho_aluminium',
    label: 'ρ_Al (2.65e-8 Ω·m)',
    category: 'constElec',
    nodeKind: 'csSource',
    inputs: [],
    defaultData: { blockType: 'const.elec.rho_aluminium', label: 'ρ_Al' },
  })

  // H3-1: Material/fluid presets removed — now handled by unified Material
  // node via materialCatalog.ts. Legacy Rust eval handlers remain for
  // backward compatibility with old saved projects.
}
