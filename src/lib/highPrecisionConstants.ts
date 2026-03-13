/**
 * highPrecisionConstants.ts — SCI-02 / 4.01: high-precision known constants.
 *
 * Stores key mathematical and physics constants with high-precision digit
 * expansions. Mathematical constants (pi, e, phi, sqrt2, ln2, ln10) use
 * lazy-loaded 10,000-digit JSON files in `precisionDigits/`.
 *
 * The f64 representation of each constant is the canonical key used for
 * matching. No value beyond the f64 precision can be computed by the engine;
 * high-precision digits are display-only.
 */

export interface HighPrecisionConstant {
  /** The f64 value (engine output). */
  readonly f64: number
  /** Full decimal expansion (100+ digits, up to 10,000). */
  digits: string
  /** Human-readable name for tooltip. */
  readonly name: string
  /** Symbol (e.g. "π"). */
  readonly symbol: string
  /** Category for grouping in UI. */
  readonly category?: 'math' | 'physics'
}

// ── Short fallback digits (100 dp) — used before lazy JSON loads ──────────

const PI_SHORT =
  '3.14159265358979323846264338327950288419716939937510' +
  '58209749445923078164062862089986280348253421170679'
const E_SHORT =
  '2.71828182845904523536028747135266249775724709369995' +
  '95749669676277240766303535475945713821785251664274'
const PHI_SHORT =
  '1.61803398874989484820458683436563811772030917980576' +
  '28621354484226963051748283946963337685498793471740'
const SQRT2_SHORT =
  '1.41421356237309504880168872420969807856967187537694' +
  '23286143488102517069376884906099579680772223798124'
const LN2_SHORT =
  '0.69314718055994530941723212145817656807550013436025' +
  '52541206800094933936219696947156058633269964186875'
const LN10_SHORT =
  '2.30258509299404568401799145468436420760110148862877' +
  '29760333279009675726096773524802359972050895982983'

// ── Mathematical constants ────────────────────────────────────────────────

export const HIGH_PRECISION_CONSTANTS: HighPrecisionConstant[] = [
  { f64: Math.PI, name: 'Pi', symbol: '\u03C0', digits: PI_SHORT, category: 'math' },
  { f64: Math.E, name: "Euler's number", symbol: 'e', digits: E_SHORT, category: 'math' },
  {
    f64: (1 + Math.sqrt(5)) / 2,
    name: 'Golden ratio',
    symbol: '\u03C6',
    digits: PHI_SHORT,
    category: 'math',
  },
  {
    f64: Math.sqrt(2),
    name: 'Square root of 2',
    symbol: '\u221A2',
    digits: SQRT2_SHORT,
    category: 'math',
  },
  { f64: Math.LN2, name: 'Natural log of 2', symbol: 'ln 2', digits: LN2_SHORT, category: 'math' },
  {
    f64: Math.LN10,
    name: 'Natural log of 10',
    symbol: 'ln 10',
    digits: LN10_SHORT,
    category: 'math',
  },
]

// ── Physics constants (CODATA 2022) ───────────────────────────────────────

export const PHYSICS_CONSTANTS: readonly HighPrecisionConstant[] = [
  {
    f64: 299792458,
    name: 'Speed of light in vacuum',
    symbol: 'c',
    digits: '299792458',
    category: 'physics',
  },
  {
    f64: 6.67430e-11,
    name: 'Gravitational constant',
    symbol: 'G',
    digits: '0.0000000000667430',
    category: 'physics',
  },
  {
    f64: 6.62607015e-34,
    name: 'Planck constant',
    symbol: 'h',
    digits: '6.62607015e-34',
    category: 'physics',
  },
  {
    f64: 1.380649e-23,
    name: 'Boltzmann constant',
    symbol: 'k\u0042',
    digits: '1.380649e-23',
    category: 'physics',
  },
  {
    f64: 6.02214076e23,
    name: 'Avogadro constant',
    symbol: 'N\u2090',
    digits: '6.02214076e23',
    category: 'physics',
  },
  {
    f64: 1.602176634e-19,
    name: 'Elementary charge',
    symbol: 'e\u2091',
    digits: '1.602176634e-19',
    category: 'physics',
  },
  {
    f64: 9.1093837139e-31,
    name: 'Electron mass',
    symbol: 'm\u2091',
    digits: '9.1093837139e-31',
    category: 'physics',
  },
  {
    f64: 1.67262192595e-27,
    name: 'Proton mass',
    symbol: 'm\u209A',
    digits: '1.67262192595e-27',
    category: 'physics',
  },
  {
    f64: 8.8541878128e-12,
    name: 'Vacuum electric permittivity',
    symbol: '\u03B5\u2080',
    digits: '8.8541878128e-12',
    category: 'physics',
  },
  {
    f64: 9.80665,
    name: 'Standard gravity',
    symbol: 'g\u2099',
    digits: '9.80665',
    category: 'physics',
  },
  {
    f64: 5.670374419e-8,
    name: 'Stefan-Boltzmann constant',
    symbol: '\u03C3',
    digits: '5.670374419e-8',
    category: 'physics',
  },
  {
    f64: 8.314462618,
    name: 'Molar gas constant',
    symbol: 'R',
    digits: '8.314462618',
    category: 'physics',
  },
]

// ── Lazy-load 10,000-digit expansions ─────────────────────────────────────

let _fullDigitsLoaded = false

const DIGIT_FILES: Array<{ index: number; file: string }> = [
  { index: 0, file: 'pi' },
  { index: 1, file: 'e' },
  { index: 2, file: 'phi' },
  { index: 3, file: 'sqrt2' },
  { index: 4, file: 'ln2' },
  { index: 5, file: 'ln10' },
]

/**
 * Lazy-load full 10,000-digit expansions from JSON files.
 * Replaces the 100-digit fallback strings. Call once on demand.
 */
export async function loadFullPrecisionDigits(): Promise<void> {
  if (_fullDigitsLoaded) return
  _fullDigitsLoaded = true

  const loads = DIGIT_FILES.map(async ({ index, file }) => {
    try {
      const mod = await import(`./precisionDigits/${file}.json`)
      const digits = typeof mod.default === 'string' ? mod.default : String(mod.default)
      HIGH_PRECISION_CONSTANTS[index].digits = digits
    } catch {
      // Keep fallback 100-digit string
    }
  })

  await Promise.all(loads)
}

// ── Matching & formatting ─────────────────────────────────────────────────

/** Relative tolerance for recognising a constant. */
const MATCH_REL_TOL = 1e-12

/**
 * If `value` matches a known high-precision constant within relative tolerance,
 * return the constant record; otherwise return null.
 */
export function matchHighPrecisionConstant(value: number): HighPrecisionConstant | null {
  if (!isFinite(value) || value === 0) return null
  for (const c of HIGH_PRECISION_CONSTANTS) {
    if (Math.abs(value - c.f64) / Math.abs(c.f64) < MATCH_REL_TOL) {
      return c
    }
  }
  return null
}

/**
 * Format a matched constant to the requested number of decimal places.
 * Truncates the stored digit string (does NOT round, matching display intent).
 */
export function formatHighPrecision(c: HighPrecisionConstant, decimalPlaces: number): string {
  // digits string is "X.YYYY..." — split on decimal point
  const dotIdx = c.digits.indexOf('.')
  if (dotIdx === -1) return c.digits
  if (decimalPlaces === 0) return c.digits.slice(0, dotIdx)
  // Truncate to requested decimal places (no rounding)
  const truncated = c.digits.slice(0, dotIdx + 1 + decimalPlaces)
  return truncated
}
