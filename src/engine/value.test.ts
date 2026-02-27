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
