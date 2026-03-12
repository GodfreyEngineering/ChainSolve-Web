/**
 * highPrecisionConstants.ts — SCI-02: high-precision known constants.
 *
 * Stores key mathematical constants to 100+ decimal places for display
 * substitution when the computed f64 value matches a known constant.
 *
 * The f64 representation of each constant is the canonical key used for
 * matching. No value beyond the f64 precision can be computed by the engine;
 * high-precision digits are display-only.
 */

export interface HighPrecisionConstant {
  /** The f64 value (engine output). */
  readonly f64: number
  /** Full decimal expansion (100+ digits). */
  readonly digits: string
  /** Human-readable name for tooltip. */
  readonly name: string
  /** Symbol (e.g. "π"). */
  readonly symbol: string
}

export const HIGH_PRECISION_CONSTANTS: readonly HighPrecisionConstant[] = [
  {
    f64: Math.PI,
    name: 'Pi',
    symbol: '\u03C0',
    digits:
      '3.14159265358979323846264338327950288419716939937510' +
      '58209749445923078164062862089986280348253421170679',
  },
  {
    f64: Math.E,
    name: "Euler's number",
    symbol: 'e',
    digits:
      '2.71828182845904523536028747135266249775724709369995' +
      '95749669676277240766303535475945713821785251664274',
  },
  {
    f64: (1 + Math.sqrt(5)) / 2,
    name: 'Golden ratio',
    symbol: '\u03C6',
    digits:
      '1.61803398874989484820458683436563811772030917980576' +
      '28621354484226963051748283946963337685498793471740',
  },
  {
    f64: Math.sqrt(2),
    name: 'Square root of 2',
    symbol: '\u221A2',
    digits:
      '1.41421356237309504880168872420969807856967187537694' +
      '23286143488102517069376884906099579680772223798124',
  },
  {
    f64: Math.LN2,
    name: 'Natural log of 2',
    symbol: 'ln 2',
    digits:
      '0.69314718055994530941723212145817656807550013436025' +
      '52541206800094933936219696947156058633269964186875',
  },
  {
    f64: Math.LN10,
    name: 'Natural log of 10',
    symbol: 'ln 10',
    digits:
      '2.30258509299404568401799145468436420760110148862877' +
      '29760333279009675726096773524802359972050895982983',
  },
]

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
