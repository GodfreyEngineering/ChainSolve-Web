/**
 * Unit tests for the H1-1 unit catalog and symbol lookup.
 */

import { describe, expect, it } from 'vitest'
import { UNIT_DIMENSIONS, allUnitIds } from './unitCatalog'
import { getUnitSymbol } from './unitSymbols'

describe('unitCatalog', () => {
  it('has at least 15 dimensions', () => {
    expect(UNIT_DIMENSIONS.length).toBeGreaterThanOrEqual(15)
  })

  it('every dimension has a unique id and at least one unit', () => {
    const ids = new Set<string>()
    for (const dim of UNIT_DIMENSIONS) {
      expect(dim.id).toBeTruthy()
      expect(ids.has(dim.id)).toBe(false)
      ids.add(dim.id)
      expect(dim.units.length).toBeGreaterThan(0)
    }
  })

  it('every unit has a unique id across all dimensions', () => {
    const ids = allUnitIds()
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('every unit id is a non-empty ASCII-safe string', () => {
    for (const id of allUnitIds()) {
      expect(id.length).toBeGreaterThan(0)
      // Allow alphanumeric, slash, underscore, dot
      expect(id).toMatch(/^[a-zA-Z0-9_/]+$/)
    }
  })

  it('contains common engineering units', () => {
    const ids = new Set(allUnitIds())
    // Length
    expect(ids.has('m')).toBe(true)
    expect(ids.has('ft')).toBe(true)
    // Force
    expect(ids.has('N')).toBe(true)
    expect(ids.has('kN')).toBe(true)
    // Pressure
    expect(ids.has('Pa')).toBe(true)
    expect(ids.has('psi')).toBe(true)
    // Energy
    expect(ids.has('J')).toBe(true)
    // Power
    expect(ids.has('W')).toBe(true)
    expect(ids.has('hp')).toBe(true)
    // Electrical
    expect(ids.has('V')).toBe(true)
    expect(ids.has('A')).toBe(true)
    expect(ids.has('ohm')).toBe(true)
  })

  it('every dimension has a labelKey starting with units.dim.', () => {
    for (const dim of UNIT_DIMENSIONS) {
      expect(dim.labelKey).toMatch(/^units\.dim\.\w+$/)
    }
  })
})

describe('getUnitSymbol', () => {
  it('returns symbol for known ids', () => {
    expect(getUnitSymbol('kg')).toBe('kg')
    expect(getUnitSymbol('degC')).toBe('\u00B0C')
    expect(getUnitSymbol('m2')).toBe('m\u00B2')
  })

  it('returns id itself for unknown ids', () => {
    expect(getUnitSymbol('xyz')).toBe('xyz')
  })

  it('returns correct symbols for all catalog entries', () => {
    // Cross-check: every unit in UNIT_DIMENSIONS must resolve via getUnitSymbol
    for (const dim of UNIT_DIMENSIONS) {
      for (const u of dim.units) {
        expect(getUnitSymbol(u.id)).toBe(u.symbol)
      }
    }
  })
})
