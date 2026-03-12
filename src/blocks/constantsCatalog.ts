/**
 * constantsCatalog.ts — Standalone constants catalog for the unified Constant picker (H4-1).
 *
 * All math, physics, atmospheric, thermodynamic, and electrical constants live here
 * with their exact values, labels, and descriptions. The unified Constant block reads
 * from this catalog; individual constant blocks are no longer registered.
 *
 * Legacy block types (pi, euler, tau, phi, const.*) still evaluate in the Rust engine
 * for backward compatibility with existing saved projects.
 */

export interface ConstantEntry {
  type: string
  label: string
  category: 'constants' | 'constMath' | 'constPhysics' | 'constAtmos' | 'constThermo' | 'constElec'
  value: number
  description: string
  /** PREC-03: Math symbol (e.g. "π", "e", "c"). */
  symbol?: string
  /** PREC-03: SI unit string (e.g. "m/s", "J·s", "C"). */
  unit?: string
  /** PREC-03: CODATA 2022 uncertainty string (e.g. "±1.9e-17"). Exact constants have "exact". */
  uncertainty?: string
  /** PREC-03: Source citation (default "CODATA 2022" for physics constants). */
  source?: string
}

// ── Catalog ─────────────────────────────────────────────────────────────────

export const CONSTANTS_CATALOG: ConstantEntry[] = [
  // ── Core math constants ─────────────────────────────────────────────────
  {
    type: 'pi',
    label: 'Pi',
    category: 'constants',
    value: Math.PI,
    description: 'Ratio of circumference to diameter',
    symbol: '\u03C0',
    uncertainty: 'exact (irrational)',
    source: 'Mathematics',
  },
  {
    type: 'euler',
    label: 'e (Euler)',
    category: 'constants',
    value: Math.E,
    description: 'Base of natural logarithms',
    symbol: 'e',
    uncertainty: 'exact (irrational)',
    source: 'Mathematics',
  },
  {
    type: 'tau',
    label: 'Tau',
    category: 'constants',
    value: 2 * Math.PI,
    description: 'Full turn in radians, 2\u03C0',
    symbol: '\u03C4',
    uncertainty: 'exact (irrational)',
    source: 'Mathematics',
  },
  {
    type: 'phi',
    label: 'Phi (Golden Ratio)',
    category: 'constants',
    value: 1.618_033_988_749_895,
    description: 'Golden ratio, (1+\u221A5)/2',
    symbol: '\u03C6',
    uncertainty: 'exact (irrational)',
    source: 'Mathematics',
  },

  // ── Additional math constants ───────────────────────────────────────────
  {
    type: 'const.math.sqrt2',
    label: 'sqrt(2)',
    category: 'constMath',
    value: Math.SQRT2,
    description: 'Square root of 2',
    symbol: '\u221A2',
    uncertainty: 'exact (irrational)',
    source: 'Mathematics',
  },
  {
    type: 'const.math.ln2',
    label: 'ln 2',
    category: 'constMath',
    value: Math.LN2,
    description: 'Natural logarithm of 2',
    symbol: 'ln 2',
    uncertainty: 'exact (irrational)',
    source: 'Mathematics',
  },
  {
    type: 'const.math.ln10',
    label: 'ln 10',
    category: 'constMath',
    value: Math.LN10,
    description: 'Natural logarithm of 10',
    symbol: 'ln 10',
    uncertainty: 'exact (irrational)',
    source: 'Mathematics',
  },

  // ── Physics constants ───────────────────────────────────────────────────
  {
    type: 'const.physics.g0',
    label: 'g0 (9.807 m/s²)',
    category: 'constPhysics',
    value: 9.806_65,
    description: 'Standard gravitational acceleration',
    symbol: 'g\u2080',
    unit: 'm/s\u00B2',
    uncertainty: 'exact',
    source: 'CGPM 1901',
  },
  {
    type: 'const.physics.R_molar',
    label: 'R (8.314 J/mol·K)',
    category: 'constPhysics',
    value: 8.314_462_618,
    description: 'Universal gas constant',
    symbol: 'R',
    unit: 'J\u00B7mol\u207B\u00B9\u00B7K\u207B\u00B9',
    uncertainty: 'exact',
    source: 'CODATA 2018',
  },
  {
    type: 'const.physics.c',
    label: 'c (2.998×10⁸ m/s)',
    category: 'constPhysics',
    value: 299_792_458.0,
    description: 'Speed of light in vacuum',
    symbol: 'c',
    unit: 'm/s',
    uncertainty: 'exact',
    source: 'SI 2019',
  },
  {
    type: 'const.physics.h',
    label: 'h (Planck, 6.626×10⁻³⁴ J·s)',
    category: 'constPhysics',
    value: 6.626_070_15e-34,
    description: 'Planck constant',
    symbol: 'h',
    unit: 'J\u00B7s',
    uncertainty: 'exact',
    source: 'SI 2019',
  },
  {
    type: 'const.physics.hbar',
    label: 'ℏ (1.055×10⁻³⁴ J·s)',
    category: 'constPhysics',
    value: 1.054_571_817e-34,
    description: 'Reduced Planck constant, h/(2\u03C0)',
    symbol: '\u210F',
    unit: 'J\u00B7s',
    uncertainty: 'exact',
    source: 'SI 2019',
  },
  {
    type: 'const.physics.kB',
    label: 'kB (Boltzmann, 1.381×10⁻²³ J/K)',
    category: 'constPhysics',
    value: 1.380_649e-23,
    description: 'Boltzmann constant',
    symbol: 'k\u1D05',
    unit: 'J/K',
    uncertainty: 'exact',
    source: 'SI 2019',
  },
  {
    type: 'const.physics.Na',
    label: 'NA (Avogadro, 6.022×10²³ mol⁻¹)',
    category: 'constPhysics',
    value: 6.022_140_76e23,
    description: "Avogadro's number",
    symbol: 'N\u2080',
    unit: 'mol\u207B\u00B9',
    uncertainty: 'exact',
    source: 'SI 2019',
  },
  {
    type: 'const.physics.qe',
    label: 'e (1.602×10⁻¹⁹ C)',
    category: 'constPhysics',
    value: 1.602_176_634e-19,
    description: 'Elementary charge',
    symbol: 'e',
    unit: 'C',
    uncertainty: 'exact',
    source: 'SI 2019',
  },
  {
    type: 'const.physics.F',
    label: 'F (Faraday, 96 485 C/mol)',
    category: 'constPhysics',
    value: 96_485.332_12,
    description: 'Faraday constant, charge per mole of electrons',
    symbol: 'F',
    unit: 'C/mol',
    uncertainty: '\u00B10.000 30',
    source: 'CODATA 2022',
  },
  {
    type: 'const.physics.me',
    label: 'me (electron mass, 9.109×10⁻³¹ kg)',
    category: 'constPhysics',
    value: 9.109_383_7015e-31,
    description: 'Electron rest mass',
    symbol: 'm\u2091',
    unit: 'kg',
    uncertainty: '\u00B10.000 000 0028e-31',
    source: 'CODATA 2022',
  },
  {
    type: 'const.physics.mp',
    label: 'mp (proton mass, 1.673×10⁻²⁷ kg)',
    category: 'constPhysics',
    value: 1.672_621_923_69e-27,
    description: 'Proton rest mass',
    symbol: 'm\u209A',
    unit: 'kg',
    uncertainty: '\u00B10.000 000 000 51e-27',
    source: 'CODATA 2022',
  },
  {
    type: 'const.physics.G',
    label: 'G (gravitational, 6.674×10⁻¹¹ m³/kg·s²)',
    category: 'constPhysics',
    value: 6.674_30e-11,
    description: 'Newtonian gravitational constant',
    symbol: 'G',
    unit: 'm\u00B3/(kg\u00B7s\u00B2)',
    uncertainty: '\u00B10.000 15e-11',
    source: 'CODATA 2022',
  },
  {
    type: 'const.physics.mu0',
    label: 'μ0 (permeability, 1.257×10⁻⁶ H/m)',
    category: 'constPhysics',
    value: 1.256_637_062_12e-6,
    description: 'Vacuum magnetic permeability',
    symbol: '\u03BC\u2080',
    unit: 'H/m',
    uncertainty: '\u00B10.000 000 000 19e-6',
    source: 'CODATA 2022',
  },
  {
    type: 'const.physics.eps0',
    label: 'ε0 (permittivity, 8.854×10⁻¹² F/m)',
    category: 'constPhysics',
    value: 8.854_187_8128e-12,
    description: 'Vacuum electric permittivity',
    symbol: '\u03B5\u2080',
    unit: 'F/m',
    uncertainty: '\u00B10.000 000 0013e-12',
    source: 'CODATA 2022',
  },
  {
    type: 'const.physics.sigma_sb',
    label: 'σ (Stefan-Boltzmann, 5.671×10⁻⁸ W/m²·K⁴)',
    category: 'constPhysics',
    value: 5.670_374_419e-8,
    description: 'Stefan-Boltzmann constant',
    symbol: '\u03C3',
    unit: 'W/(m\u00B2\u00B7K\u2074)',
    uncertainty: 'exact',
    source: 'SI 2019',
  },

  // ── Atmospheric constants ───────────────────────────────────────────────
  {
    type: 'const.atmos.p0_pa',
    label: 'p0 (101 325 Pa)',
    category: 'constAtmos',
    value: 101_325.0,
    description: 'Standard atmospheric pressure at sea level',
  },
  {
    type: 'const.atmos.t0_k',
    label: 'T0 (288.15 K)',
    category: 'constAtmos',
    value: 288.15,
    description: 'ISA sea-level temperature',
  },
  {
    type: 'const.atmos.rho_air_sl',
    label: 'rho_air (1.225 kg/m3)',
    category: 'constAtmos',
    value: 1.225,
    description: 'Air density at sea level, standard conditions',
  },
  {
    type: 'const.atmos.gamma_air',
    label: 'gamma_air (1.4)',
    category: 'constAtmos',
    value: 1.4,
    description: 'Ratio of specific heats for air',
  },
  {
    type: 'const.atmos.R_air',
    label: 'R_air (287.05 J/kg K)',
    category: 'constAtmos',
    value: 287.05,
    description: 'Specific gas constant for dry air',
  },
  {
    type: 'const.atmos.mu_air_20c',
    label: 'mu_air (1.81e-5 Pa s)',
    category: 'constAtmos',
    value: 1.81e-5,
    description: 'Dynamic viscosity of air at 20 C',
  },
  {
    type: 'const.atmos.a_air_20c',
    label: 'a_air (343 m/s)',
    category: 'constAtmos',
    value: 343.0,
    description: 'Speed of sound in air at 20 C',
  },

  // ── Thermodynamic constants ─────────────────────────────────────────────
  {
    type: 'const.thermo.cp_air',
    label: 'cp_air (1005 J/kg K)',
    category: 'constThermo',
    value: 1005.0,
    description: 'Specific heat of air at constant pressure',
  },
  {
    type: 'const.thermo.cv_air',
    label: 'cv_air (718 J/kg K)',
    category: 'constThermo',
    value: 718.0,
    description: 'Specific heat of air at constant volume',
  },
  {
    type: 'const.thermo.k_air',
    label: 'k_air (0.026 W/m K)',
    category: 'constThermo',
    value: 0.0262,
    description: 'Thermal conductivity of air at 20 C',
  },
  {
    type: 'const.thermo.k_water',
    label: 'k_water (0.606 W/m K)',
    category: 'constThermo',
    value: 0.6,
    description: 'Thermal conductivity of water at 25 C',
  },

  // ── Electrical constants ────────────────────────────────────────────────
  {
    type: 'const.elec.rho_copper',
    label: 'rho_Cu (1.68e-8 ohm m)',
    category: 'constElec',
    value: 1.68e-8,
    description: 'Electrical resistivity of copper at 20 C',
  },
  {
    type: 'const.elec.rho_aluminium',
    label: 'rho_Al (2.82e-8 ohm m)',
    category: 'constElec',
    value: 2.82e-8,
    description: 'Electrical resistivity of aluminium at 20 C',
  },
]

// ── Lookup map: type → value ─────────────────────────────────────────────────

export const CONSTANT_VALUES: Record<string, number> = Object.fromEntries(
  CONSTANTS_CATALOG.map((c) => [c.type, c.value]),
)
