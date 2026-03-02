/**
 * unitCompat.ts — Unit compatibility utilities for H1-2.
 *
 * Provides dimension lookup, mismatch detection, and conversion factor
 * calculation between units in the same physical dimension.
 *
 * Conversion factors are defined relative to a base unit per dimension.
 * Factor = toBase[from] / toBase[to], so multiplying a value in `from`
 * by the factor gives the value in `to`.
 *
 * Temperature conversions are affine (not purely multiplicative) and are
 * excluded from automatic factor-based conversion.
 *
 * IMPORTANT: This module must NOT import unitCatalog.ts because unitCatalog
 * is lazy-loaded. The dimension map is self-contained here.
 */

// ── Dimension definitions (self-contained — no unitCatalog import) ──────────

/** Unit IDs grouped by dimension. Order matches unitCatalog.ts. */
const DIM_UNITS: Record<string, readonly string[]> = {
  length: ['m', 'cm', 'mm', 'um', 'km', 'in', 'ft', 'yd', 'mi'],
  mass: ['kg', 'g', 'mg', 'lb', 'oz', 'tonne'],
  time: ['s', 'ms', 'us', 'min', 'h', 'day'],
  temperature: ['K', 'degC', 'degF'],
  force: ['N', 'kN', 'MN', 'lbf', 'kip'],
  pressure: ['Pa', 'kPa', 'MPa', 'GPa', 'bar', 'atm', 'psi', 'ksi', 'torr'],
  energy: ['J', 'kJ', 'MJ', 'cal', 'kcal', 'BTU', 'eV', 'kWh'],
  power: ['W', 'kW', 'MW', 'hp'],
  area: ['m2', 'cm2', 'mm2', 'km2', 'in2', 'ft2', 'acre', 'ha'],
  volume: ['m3', 'cm3', 'L', 'mL', 'gal', 'ft3', 'in3'],
  velocity: ['m/s', 'km/h', 'mph', 'ft/s', 'knot'],
  acceleration: ['m/s2', 'ft/s2', 'g0'],
  density: ['kg/m3', 'g/cm3', 'lb/ft3'],
  viscosity: ['Pa_s', 'mPa_s'],
  torque: ['N_m', 'kN_m', 'ft_lbf', 'in_lbf'],
  momentOfInertia: ['m4', 'cm4', 'mm4', 'in4'],
  angle: ['rad', 'deg', 'rev'],
  frequency: ['Hz', 'kHz', 'MHz', 'GHz', 'rpm'],
  electrical: ['V', 'mV', 'kV', 'A', 'mA', 'ohm', 'kohm', 'F_cap', 'uF', 'nF', 'pF', 'H_ind', 'mH'],
  ratio: ['pct', 'ppm'],
  currency: ['USD', 'EUR', 'GBP', 'JPY'],
}

// ── Dimension lookup ────────────────────────────────────────────────────────

/** Lazily-built reverse map: unitId -> dimensionId. */
let _unitToDim: Map<string, string> | null = null

function buildUnitToDim(): Map<string, string> {
  if (_unitToDim) return _unitToDim
  const m = new Map<string, string>()
  for (const [dim, ids] of Object.entries(DIM_UNITS)) {
    for (const id of ids) {
      m.set(id, dim)
    }
  }
  _unitToDim = m
  return m
}

/** Get the dimension ID for a unit (e.g. 'm' -> 'length'). */
export function getDimension(unitId: string): string | undefined {
  return buildUnitToDim().get(unitId)
}

/** Check if two units belong to the same physical dimension. */
export function areSameDimension(a: string, b: string): boolean {
  const da = getDimension(a)
  const db = getDimension(b)
  return da !== undefined && da === db
}

// ── Conversion factors ──────────────────────────────────────────────────────

/**
 * Conversion factor to the dimension's base unit.
 * value_in_base = value_in_unit * TO_BASE[unitId]
 *
 * Base units: m, kg, s, K, N, Pa, J, W, m2, m3, m/s, m/s2, kg/m3,
 *             Pa_s, N_m, m4, rad, Hz, V, (dimensionless), USD
 */
const TO_BASE: Record<string, number> = {
  // Length (base: m)
  m: 1,
  cm: 0.01,
  mm: 0.001,
  um: 1e-6,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,

  // Mass (base: kg)
  kg: 1,
  g: 0.001,
  mg: 1e-6,
  lb: 0.453592,
  oz: 0.0283495,
  tonne: 1000,

  // Time (base: s)
  s: 1,
  ms: 0.001,
  us: 1e-6,
  min: 60,
  h: 3600,
  day: 86400,

  // Temperature — affine, not purely multiplicative. Excluded from factor conversion.
  // K, degC, degF are intentionally absent.

  // Force (base: N)
  N: 1,
  kN: 1000,
  MN: 1e6,
  lbf: 4.44822,
  kip: 4448.22,

  // Pressure (base: Pa)
  Pa: 1,
  kPa: 1000,
  MPa: 1e6,
  GPa: 1e9,
  bar: 100000,
  atm: 101325,
  psi: 6894.757,
  ksi: 6894757,
  torr: 133.322,

  // Energy (base: J)
  J: 1,
  kJ: 1000,
  MJ: 1e6,
  cal: 4.184,
  kcal: 4184,
  BTU: 1055.06,
  eV: 1.602176634e-19,
  kWh: 3.6e6,

  // Power (base: W)
  W: 1,
  kW: 1000,
  MW: 1e6,
  hp: 745.7,

  // Area (base: m2)
  m2: 1,
  cm2: 1e-4,
  mm2: 1e-6,
  km2: 1e6,
  in2: 6.4516e-4,
  ft2: 0.092903,
  acre: 4046.86,
  ha: 10000,

  // Volume (base: m3)
  m3: 1,
  cm3: 1e-6,
  L: 0.001,
  mL: 1e-6,
  gal: 0.003785,
  ft3: 0.028317,
  in3: 1.6387e-5,

  // Velocity (base: m/s)
  'm/s': 1,
  'km/h': 1 / 3.6,
  mph: 0.44704,
  'ft/s': 0.3048,
  knot: 0.514444,

  // Acceleration (base: m/s2)
  'm/s2': 1,
  'ft/s2': 0.3048,
  g0: 9.80665,

  // Density (base: kg/m3)
  'kg/m3': 1,
  'g/cm3': 1000,
  'lb/ft3': 16.0185,

  // Viscosity (base: Pa_s)
  Pa_s: 1,
  mPa_s: 0.001,

  // Torque (base: N_m)
  N_m: 1,
  kN_m: 1000,
  ft_lbf: 1.35582,
  in_lbf: 0.112985,

  // Moment of Inertia (base: m4)
  m4: 1,
  cm4: 1e-8,
  mm4: 1e-12,
  in4: 4.162314e-7,

  // Angle (base: rad)
  rad: 1,
  deg: Math.PI / 180,
  rev: 2 * Math.PI,

  // Frequency (base: Hz)
  Hz: 1,
  kHz: 1000,
  MHz: 1e6,
  GHz: 1e9,
  rpm: 1 / 60,

  // Electrical (base: V for voltage, A for current, ohm for resistance, etc.)
  // These are mixed-dimension; treat each sub-group by its natural base.
  V: 1,
  mV: 0.001,
  kV: 1000,
  A: 1,
  mA: 0.001,
  ohm: 1,
  kohm: 1000,
  F_cap: 1,
  uF: 1e-6,
  nF: 1e-9,
  pF: 1e-12,
  H_ind: 1,
  mH: 0.001,

  // Ratio (dimensionless)
  pct: 0.01,
  ppm: 1e-6,

  // Currency (base: USD — nominal, no real exchange rate)
  USD: 1,
  EUR: 1,
  GBP: 1,
  JPY: 1,
}

/**
 * Compute the multiplicative factor to convert a value from `fromUnit` to `toUnit`.
 * Returns `undefined` if the units are in different dimensions, either unit is unknown,
 * or the conversion is non-multiplicative (temperature).
 */
export function getConversionFactor(fromUnit: string, toUnit: string): number | undefined {
  if (fromUnit === toUnit) return 1
  if (!areSameDimension(fromUnit, toUnit)) return undefined
  const fromBase = TO_BASE[fromUnit]
  const toBase = TO_BASE[toUnit]
  if (fromBase === undefined || toBase === undefined) return undefined
  return fromBase / toBase
}

// ── Mismatch info ───────────────────────────────────────────────────────────

export interface UnitMismatch {
  /** Source unit id. */
  sourceUnit: string
  /** Target unit id. */
  targetUnit: string
  /** True if both units are in the same physical dimension. */
  sameDimension: boolean
  /** Conversion factor (multiply source value by this to get target value). Undefined if non-convertible. */
  factor: number | undefined
}

/**
 * Check if two units have a mismatch. Returns null if units match or either is unset.
 */
export function getUnitMismatch(
  sourceUnit: string | undefined,
  targetUnit: string | undefined,
): UnitMismatch | null {
  if (!sourceUnit || !targetUnit) return null
  if (sourceUnit === targetUnit) return null
  const sameDim = areSameDimension(sourceUnit, targetUnit)
  return {
    sourceUnit,
    targetUnit,
    sameDimension: sameDim,
    factor: sameDim ? getConversionFactor(sourceUnit, targetUnit) : undefined,
  }
}
