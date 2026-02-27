import { describe, it, expect } from 'vitest'
import {
  validateVariablesMap,
  safeParseVariablesMap,
  MAX_VARIABLE_NAME_LENGTH,
  MAX_VARIABLE_DESCRIPTION_LENGTH,
} from './validateVariables'

const makeVar = (overrides: Record<string, unknown> = {}) => ({
  id: 'var-1',
  name: 'speed',
  value: 42,
  ...overrides,
})

describe('validateVariablesMap — valid inputs', () => {
  it('accepts an empty map', () => {
    expect(validateVariablesMap({}).ok).toBe(true)
  })

  it('accepts a single valid variable', () => {
    const result = validateVariablesMap({ 'var-1': makeVar() })
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('accepts a variable with optional description', () => {
    const result = validateVariablesMap({
      'var-1': makeVar({ description: 'meters per second' }),
    })
    expect(result.ok).toBe(true)
  })

  it('accepts zero as value', () => {
    expect(validateVariablesMap({ 'var-1': makeVar({ value: 0 }) }).ok).toBe(true)
  })

  it('accepts negative value', () => {
    expect(validateVariablesMap({ 'var-1': makeVar({ value: -9.81 }) }).ok).toBe(true)
  })

  it('accepts multiple variables with unique names', () => {
    const result = validateVariablesMap({
      'var-1': { id: 'var-1', name: 'speed', value: 10 },
      'var-2': { id: 'var-2', name: 'gravity', value: 9.81 },
    })
    expect(result.ok).toBe(true)
  })
})

describe('validateVariablesMap — structural errors', () => {
  it('rejects null', () => {
    expect(validateVariablesMap(null).ok).toBe(false)
  })

  it('rejects an array', () => {
    expect(validateVariablesMap([]).ok).toBe(false)
  })

  it('rejects a string', () => {
    expect(validateVariablesMap('bad').ok).toBe(false)
  })

  it('rejects null entry value', () => {
    const result = validateVariablesMap({ 'var-1': null })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('must be an object'))).toBe(true)
  })

  it('rejects array entry value', () => {
    const result = validateVariablesMap({ 'var-1': [] })
    expect(result.ok).toBe(false)
  })
})

describe('validateVariablesMap — id validation', () => {
  it('rejects missing id', () => {
    const result = validateVariablesMap({ 'var-1': { name: 'x', value: 1 } })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('id must be'))).toBe(true)
  })

  it('rejects id not matching key', () => {
    const result = validateVariablesMap({ 'var-1': makeVar({ id: 'var-2' }) })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('does not match map key'))).toBe(true)
  })

  it('rejects empty id', () => {
    const result = validateVariablesMap({ 'var-1': makeVar({ id: '' }) })
    expect(result.ok).toBe(false)
  })
})

describe('validateVariablesMap — name validation', () => {
  it('rejects missing name', () => {
    const result = validateVariablesMap({ 'var-1': { id: 'var-1', value: 1 } })
    expect(result.ok).toBe(false)
  })

  it('rejects empty name', () => {
    const result = validateVariablesMap({ 'var-1': makeVar({ name: '' }) })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('name must be a non-empty string'))).toBe(true)
  })

  it('rejects name exceeding max length', () => {
    const longName = 'a'.repeat(MAX_VARIABLE_NAME_LENGTH + 1)
    const result = validateVariablesMap({ 'var-1': makeVar({ name: longName }) })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('exceeds'))).toBe(true)
  })

  it('accepts name at exact max length', () => {
    const name = 'a'.repeat(MAX_VARIABLE_NAME_LENGTH)
    expect(validateVariablesMap({ 'var-1': makeVar({ name }) }).ok).toBe(true)
  })

  it('rejects duplicate names (case-insensitive)', () => {
    const result = validateVariablesMap({
      'var-1': { id: 'var-1', name: 'Speed', value: 1 },
      'var-2': { id: 'var-2', name: 'speed', value: 2 },
    })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('conflicts with'))).toBe(true)
  })

  it('accepts same name on same key (idempotent)', () => {
    const result = validateVariablesMap({
      'var-1': { id: 'var-1', name: 'speed', value: 10 },
    })
    expect(result.ok).toBe(true)
  })
})

describe('validateVariablesMap — value validation', () => {
  it('rejects NaN', () => {
    const result = validateVariablesMap({ 'var-1': makeVar({ value: NaN }) })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('finite'))).toBe(true)
  })

  it('rejects Infinity', () => {
    const result = validateVariablesMap({ 'var-1': makeVar({ value: Infinity }) })
    expect(result.ok).toBe(false)
  })

  it('rejects -Infinity', () => {
    const result = validateVariablesMap({ 'var-1': makeVar({ value: -Infinity }) })
    expect(result.ok).toBe(false)
  })

  it('rejects non-number value', () => {
    const result = validateVariablesMap({ 'var-1': makeVar({ value: 'fast' }) })
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('must be a number'))).toBe(true)
  })
})

describe('validateVariablesMap — description validation', () => {
  it('rejects non-string description', () => {
    const result = validateVariablesMap({ 'var-1': makeVar({ description: 42 }) })
    expect(result.ok).toBe(false)
  })

  it('rejects description exceeding max length', () => {
    const desc = 'x'.repeat(MAX_VARIABLE_DESCRIPTION_LENGTH + 1)
    const result = validateVariablesMap({ 'var-1': makeVar({ description: desc }) })
    expect(result.ok).toBe(false)
  })

  it('accepts description at exact max length', () => {
    const desc = 'x'.repeat(MAX_VARIABLE_DESCRIPTION_LENGTH)
    expect(validateVariablesMap({ 'var-1': makeVar({ description: desc }) }).ok).toBe(true)
  })
})

describe('safeParseVariablesMap', () => {
  it('returns the map when valid', () => {
    const input = { 'var-1': makeVar() }
    expect(safeParseVariablesMap(input)).toBe(input)
  })

  it('returns empty map for null input', () => {
    expect(safeParseVariablesMap(null)).toEqual({})
  })

  it('returns empty map for invalid input', () => {
    expect(safeParseVariablesMap({ 'var-1': makeVar({ value: NaN }) })).toEqual({})
  })
})
