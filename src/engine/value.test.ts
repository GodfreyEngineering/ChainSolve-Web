/**
 * value.test.ts — Unit tests for formatValue (the compact UI display formatter).
 *
 * P033: NaN eradication audit.  These tests pin the contract that the UI
 * display layer ALWAYS produces a well-defined, human-readable string —
 * never a raw JavaScript NaN or Infinity literal that could confuse users.
 *
 * Run with: npm run test:unit
 */

import { describe, it, expect } from 'vitest'
import { formatValue, mkScalar, mkVector, mkTable, mkError } from './value'

describe('formatValue — undefined', () => {
  it('returns em dash for undefined', () => {
    expect(formatValue(undefined)).toBe('\u2014')
  })
})

describe('formatValue — scalar special values (P033 NaN contract)', () => {
  it('formats NaN as explicit "NaN" string, never leaks raw JS NaN', () => {
    const result = formatValue(mkScalar(NaN))
    expect(result).toBe('NaN')
    // Specifically: must be a non-empty string (never JS NaN type)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('formats +Infinity as +∞ symbol', () => {
    expect(formatValue(mkScalar(Infinity))).toBe('+\u221E')
  })

  it('formats -Infinity as −∞ symbol', () => {
    expect(formatValue(mkScalar(-Infinity))).toBe('\u2212\u221E')
  })
})

describe('formatValue — scalar finite values', () => {
  it('formats zero', () => {
    expect(formatValue(mkScalar(0))).toBe('0')
  })

  it('formats negative zero as 0', () => {
    expect(formatValue(mkScalar(-0))).toBe('0')
  })

  it('formats small numbers', () => {
    expect(formatValue(mkScalar(42))).toBe('42')
  })

  it('formats decimal numbers at 6 significant figures', () => {
    const result = formatValue(mkScalar(1 / 3))
    expect(result).toBe('0.333333')
  })

  it('uses exponential notation for very large numbers', () => {
    expect(formatValue(mkScalar(1e7))).toMatch(/e\+/)
  })

  it('uses exponential notation for very small numbers', () => {
    expect(formatValue(mkScalar(1e-4))).toMatch(/e-/)
  })
})

describe('formatValue — vector', () => {
  it('returns [empty] for zero-length vector', () => {
    expect(formatValue(mkVector([]))).toBe('[empty]')
  })

  it('shows all elements when 4 or fewer', () => {
    expect(formatValue(mkVector([1, 2, 3]))).toBe('[1, 2, 3]')
    expect(formatValue(mkVector([1, 2, 3, 4]))).toBe('[1, 2, 3, 4]')
  })

  it('summarises as count when more than 4 elements', () => {
    expect(formatValue(mkVector([1, 2, 3, 4, 5]))).toBe('[5 items]')
  })

  it('formats NaN element inside short vector as "NaN" string', () => {
    // The join conversion is explicit — never silent
    expect(formatValue(mkVector([1, NaN, 3]))).toBe('[1, NaN, 3]')
  })
})

describe('formatValue — table', () => {
  it('formats table as RxC summary', () => {
    expect(
      formatValue(
        mkTable(
          ['x', 'y'],
          [
            [1, 2],
            [3, 4],
          ],
        ),
      ),
    ).toBe('2\u00D72 table')
  })
})

describe('formatValue — error', () => {
  it('returns the error message directly', () => {
    expect(formatValue(mkError('division by zero'))).toBe('division by zero')
  })

  it('returns empty string for empty error message', () => {
    expect(formatValue(mkError(''))).toBe('')
  })
})

// ── P079 — Locale-aware number formatting ────────────────────────────────────
describe('formatValue — locale parameter (P079)', () => {
  it('without locale, formats using dot decimal separator', () => {
    // Default (locale-neutral) output for exports / tests
    expect(formatValue(mkScalar(3.14))).toBe('3.14')
  })

  it('with locale "en", uses dot decimal separator', () => {
    expect(formatValue(mkScalar(3.14), 'en')).toMatch(/3\.14/)
  })

  it('with locale "de", uses comma decimal separator', () => {
    const result = formatValue(mkScalar(3.14), 'de')
    // German: "3,14"
    expect(result).toContain(',')
    expect(result).not.toContain('.')
  })

  it('with locale "fr", uses comma decimal separator', () => {
    const result = formatValue(mkScalar(1.5), 'fr')
    expect(result).toContain(',')
  })

  it('NaN is always "NaN" regardless of locale', () => {
    expect(formatValue(mkScalar(NaN), 'de')).toBe('NaN')
  })

  it('Infinity is always +∞ regardless of locale', () => {
    expect(formatValue(mkScalar(Infinity), 'de')).toBe('+\u221E')
  })

  it('scientific notation is locale-neutral (universally understood)', () => {
    // Very large number: always uses n.toExponential(4)
    const result = formatValue(mkScalar(1e7), 'de')
    expect(result).toMatch(/e\+/)
  })

  it('unknown locale tag falls back to default formatting', () => {
    // Should not throw; falls through to toPrecision
    expect(() => formatValue(mkScalar(3.14), 'xx-invalid-locale')).not.toThrow()
  })

  it('zero is always "0" regardless of locale', () => {
    expect(formatValue(mkScalar(0), 'de')).toBe('0')
  })
})

// ── D8-1 — FormatOptions (numeric formatting preferences) ────────────────

describe('formatValue — FormatOptions (D8-1)', () => {
  it('decimalPlaces=2 formats scalar with 2 decimals', () => {
    expect(formatValue(mkScalar(3.14159), undefined, { decimalPlaces: 2 })).toBe('3.14')
  })

  it('decimalPlaces=0 formats scalar as integer', () => {
    expect(formatValue(mkScalar(42.7), undefined, { decimalPlaces: 0 })).toBe('43')
  })

  it('decimalPlaces=-1 (auto) uses smart precision', () => {
    expect(formatValue(mkScalar(3.14), undefined, { decimalPlaces: -1 })).toBe('3.14')
  })

  it('thousandsSeparator adds commas', () => {
    expect(
      formatValue(mkScalar(1234567), undefined, {
        thousandsSeparator: true,
        scientificNotationThreshold: 1e9,
      }),
    ).toContain(',')
  })

  it('thousandsSeparator with fixed decimals', () => {
    expect(
      formatValue(mkScalar(1234567.89), undefined, {
        decimalPlaces: 2,
        thousandsSeparator: true,
        scientificNotationThreshold: 1e9,
      }),
    ).toBe('1,234,567.89')
  })

  it('custom scientificNotationThreshold at 1000', () => {
    expect(formatValue(mkScalar(5000), undefined, { scientificNotationThreshold: 1000 })).toMatch(
      /e\+/,
    )
  })

  it('high scientificNotationThreshold prevents sci notation', () => {
    expect(
      formatValue(mkScalar(5000000), undefined, {
        scientificNotationThreshold: 1e9,
        decimalPlaces: 0,
      }),
    ).toBe('5000000')
  })

  it('NaN is always NaN regardless of FormatOptions', () => {
    expect(formatValue(mkScalar(NaN), undefined, { decimalPlaces: 2 })).toBe('NaN')
  })

  it('Infinity is always +∞ regardless of FormatOptions', () => {
    expect(formatValue(mkScalar(Infinity), undefined, { decimalPlaces: 2 })).toBe('+\u221E')
  })

  it('zero is always "0" regardless of FormatOptions', () => {
    expect(formatValue(mkScalar(0), undefined, { decimalPlaces: 3 })).toBe('0')
  })
})
