/**
 * Unit tests for H1-2 unit compatibility utilities.
 */

import { describe, expect, it } from 'vitest'
import { getDimension, areSameDimension, getConversionFactor, getUnitMismatch } from './unitCompat'

describe('getDimension', () => {
  it('returns dimension for known units', () => {
    expect(getDimension('m')).toBe('length')
    expect(getDimension('kg')).toBe('mass')
    expect(getDimension('Pa')).toBe('pressure')
    expect(getDimension('Hz')).toBe('frequency')
  })

  it('returns undefined for unknown units', () => {
    expect(getDimension('xyz')).toBeUndefined()
    expect(getDimension('')).toBeUndefined()
  })
})

describe('areSameDimension', () => {
  it('returns true for same-dimension units', () => {
    expect(areSameDimension('m', 'ft')).toBe(true)
    expect(areSameDimension('Pa', 'psi')).toBe(true)
    expect(areSameDimension('J', 'BTU')).toBe(true)
  })

  it('returns false for different-dimension units', () => {
    expect(areSameDimension('m', 'kg')).toBe(false)
    expect(areSameDimension('Pa', 'N')).toBe(false)
  })

  it('returns false for unknown units', () => {
    expect(areSameDimension('m', 'xyz')).toBe(false)
    expect(areSameDimension('xyz', 'abc')).toBe(false)
  })
})

describe('getConversionFactor', () => {
  it('returns 1 for same unit', () => {
    expect(getConversionFactor('m', 'm')).toBe(1)
    expect(getConversionFactor('Pa', 'Pa')).toBe(1)
  })

  it('returns correct factor for length conversions', () => {
    expect(getConversionFactor('mm', 'm')).toBeCloseTo(0.001, 8)
    expect(getConversionFactor('m', 'mm')).toBeCloseTo(1000, 8)
    expect(getConversionFactor('km', 'm')).toBeCloseTo(1000, 8)
    expect(getConversionFactor('in', 'cm')).toBeCloseTo(2.54, 4)
    expect(getConversionFactor('ft', 'm')).toBeCloseTo(0.3048, 6)
  })

  it('returns correct factor for pressure conversions', () => {
    expect(getConversionFactor('bar', 'Pa')).toBeCloseTo(100000, 1)
    expect(getConversionFactor('Pa', 'bar')).toBeCloseTo(1e-5, 10)
    expect(getConversionFactor('atm', 'Pa')).toBeCloseTo(101325, 1)
  })

  it('returns correct factor for angle conversions', () => {
    expect(getConversionFactor('deg', 'rad')).toBeCloseTo(Math.PI / 180, 10)
    expect(getConversionFactor('rad', 'deg')).toBeCloseTo(180 / Math.PI, 6)
    expect(getConversionFactor('rev', 'deg')).toBeCloseTo(360, 6)
  })

  it('returns undefined for different dimensions', () => {
    expect(getConversionFactor('m', 'kg')).toBeUndefined()
    expect(getConversionFactor('Pa', 'N')).toBeUndefined()
  })

  it('returns undefined for temperature (affine conversion)', () => {
    expect(getConversionFactor('K', 'degC')).toBeUndefined()
    expect(getConversionFactor('degC', 'degF')).toBeUndefined()
  })

  it('returns undefined for unknown units', () => {
    expect(getConversionFactor('m', 'xyz')).toBeUndefined()
  })
})

describe('getUnitMismatch', () => {
  it('returns null when either unit is unset', () => {
    expect(getUnitMismatch(undefined, 'm')).toBeNull()
    expect(getUnitMismatch('m', undefined)).toBeNull()
    expect(getUnitMismatch(undefined, undefined)).toBeNull()
  })

  it('returns null when units match', () => {
    expect(getUnitMismatch('m', 'm')).toBeNull()
    expect(getUnitMismatch('Pa', 'Pa')).toBeNull()
  })

  it('returns mismatch info for same-dimension different units', () => {
    const mm = getUnitMismatch('mm', 'm')
    expect(mm).not.toBeNull()
    expect(mm!.sameDimension).toBe(true)
    expect(mm!.factor).toBeCloseTo(0.001, 8)
    expect(mm!.sourceUnit).toBe('mm')
    expect(mm!.targetUnit).toBe('m')
  })

  it('returns mismatch info for different-dimension units', () => {
    const mm = getUnitMismatch('m', 'kg')
    expect(mm).not.toBeNull()
    expect(mm!.sameDimension).toBe(false)
    expect(mm!.factor).toBeUndefined()
  })
})
