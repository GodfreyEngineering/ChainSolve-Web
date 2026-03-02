/**
 * Unit tests for VectorEditor paste parsing (H2-1).
 */

import { describe, expect, it } from 'vitest'
import { parsePastedText } from './parsePastedText'

describe('parsePastedText', () => {
  it('parses newline-separated numbers', () => {
    const r = parsePastedText('1\n2\n3\n4.5')
    expect(r.values).toEqual([1, 2, 3, 4.5])
    expect(r.errors).toBe(0)
  })

  it('parses comma-separated numbers', () => {
    const r = parsePastedText('10, 20, 30')
    expect(r.values).toEqual([10, 20, 30])
    expect(r.errors).toBe(0)
  })

  it('parses tab-separated numbers (Excel paste)', () => {
    const r = parsePastedText('1.5\t2.5\t3.5')
    expect(r.values).toEqual([1.5, 2.5, 3.5])
    expect(r.errors).toBe(0)
  })

  it('parses semicolon-separated numbers', () => {
    const r = parsePastedText('100;200;300')
    expect(r.values).toEqual([100, 200, 300])
    expect(r.errors).toBe(0)
  })

  it('parses JSON array', () => {
    const r = parsePastedText('[1, 2, 3, 4]')
    expect(r.values).toEqual([1, 2, 3, 4])
    expect(r.errors).toBe(0)
  })

  it('handles mixed newlines and commas', () => {
    const r = parsePastedText('1,2\n3,4')
    expect(r.values).toEqual([1, 2, 3, 4])
    expect(r.errors).toBe(0)
  })

  it('skips non-numeric values and counts errors', () => {
    const r = parsePastedText('1, abc, 3, xyz')
    expect(r.values).toEqual([1, 3])
    expect(r.errors).toBe(2)
  })

  it('handles negative numbers', () => {
    const r = parsePastedText('-5, -10.5, 3')
    expect(r.values).toEqual([-5, -10.5, 3])
    expect(r.errors).toBe(0)
  })

  it('handles scientific notation', () => {
    const r = parsePastedText('1e3, 2.5e-2')
    expect(r.values).toEqual([1000, 0.025])
    expect(r.errors).toBe(0)
  })

  it('returns empty for empty input', () => {
    const r = parsePastedText('')
    expect(r.values).toEqual([])
    expect(r.errors).toBe(0)
  })

  it('returns empty for whitespace-only input', () => {
    const r = parsePastedText('   \n  \t  ')
    expect(r.values).toEqual([])
    expect(r.errors).toBe(0)
  })

  it('strips surrounding quotes', () => {
    const r = parsePastedText('"42", "99"')
    expect(r.values).toEqual([42, 99])
    expect(r.errors).toBe(0)
  })

  it('rejects Infinity and NaN in text mode', () => {
    const r = parsePastedText('Infinity, NaN, 5')
    expect(r.values).toEqual([5])
    expect(r.errors).toBe(2)
  })

  it('handles Excel column paste (newlines)', () => {
    const r = parsePastedText('100\n200\n300\n400\n500')
    expect(r.values).toEqual([100, 200, 300, 400, 500])
    expect(r.errors).toBe(0)
  })
})
