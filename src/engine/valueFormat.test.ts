/**
 * valueFormat unit tests.
 *
 * Run with: npm run test:unit
 */

import { describe, it, expect } from 'vitest'
import { formatValueFull, formatValueJson } from './valueFormat'
import type { Value } from './value'
import { mkScalar, mkVector, mkTable, mkError } from './value'

// ── formatValueFull ──────────────────────────────────────────────────────────

describe('formatValueFull', () => {
  it('returns em dash for undefined', () => {
    expect(formatValueFull(undefined)).toBe('\u2014')
  })

  it('formats scalar at full precision', () => {
    const result = formatValueFull(mkScalar(1 / 3))
    // Should contain many digits
    expect(result.length).toBeGreaterThan(10)
    expect(result).toContain('3333333')
  })

  it('formats zero', () => {
    expect(formatValueFull(mkScalar(0))).toBe('0')
  })

  it('formats NaN', () => {
    expect(formatValueFull(mkScalar(NaN))).toBe('NaN')
  })

  it('formats +Infinity', () => {
    expect(formatValueFull(mkScalar(Infinity))).toBe('+Infinity')
  })

  it('formats -Infinity', () => {
    expect(formatValueFull(mkScalar(-Infinity))).toBe('-Infinity')
  })

  it('formats vector with all elements', () => {
    const result = formatValueFull(mkVector([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
    expect(result).toBe('[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]')
  })

  it('formats vector with NaN element as explicit "NaN" string in output', () => {
    const result = formatValueFull(mkVector([1, NaN, 3]))
    expect(result).toBe('[1, NaN, 3]')
  })

  it('formats table as TSV', () => {
    const result = formatValueFull(
      mkTable(
        ['a', 'b'],
        [
          [1, 2],
          [3, 4],
        ],
      ),
    )
    expect(result).toBe('a\tb\n1\t2\n3\t4')
  })

  it('formats error with prefix', () => {
    expect(formatValueFull(mkError('division by zero'))).toBe('Error: division by zero')
  })
})

// ── formatValueJson ──────────────────────────────────────────────────────────

describe('formatValueJson', () => {
  it('returns "null" for undefined', () => {
    expect(formatValueJson(undefined)).toBe('null')
  })

  it('formats scalar as JSON number', () => {
    const result = formatValueJson(mkScalar(42))
    expect(JSON.parse(result)).toBe(42)
  })

  it('formats NaN as quoted string', () => {
    expect(formatValueJson(mkScalar(NaN))).toBe('"NaN"')
  })

  it('formats Infinity as quoted string', () => {
    expect(formatValueJson(mkScalar(Infinity))).toBe('"Infinity"')
  })

  it('formats -Infinity as quoted string', () => {
    expect(formatValueJson(mkScalar(-Infinity))).toBe('"-Infinity"')
  })

  it('formats vector as JSON array', () => {
    const result = formatValueJson(mkVector([1, 2, 3]))
    expect(JSON.parse(result)).toEqual([1, 2, 3])
  })

  it('formats table as JSON object with columns and rows', () => {
    const result = formatValueJson(mkTable(['x', 'y'], [[1, 2]]))
    const parsed = JSON.parse(result) as { columns: string[]; rows: number[][] }
    expect(parsed.columns).toEqual(['x', 'y'])
    expect(parsed.rows).toEqual([[1, 2]])
  })

  it('formats error as JSON object', () => {
    const result = formatValueJson(mkError('oops'))
    const parsed = JSON.parse(result) as { error: string }
    expect(parsed.error).toBe('oops')
  })

  it('produces valid JSON for all value kinds', () => {
    const values: (Value | undefined)[] = [
      undefined,
      mkScalar(3.14),
      mkVector([1, 2]),
      mkTable(['a'], [[1]]),
      mkError('test'),
    ]
    for (const v of values) {
      expect(() => JSON.parse(formatValueJson(v))).not.toThrow()
    }
  })
})
