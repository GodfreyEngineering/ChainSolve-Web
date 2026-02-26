/**
 * migrateBindings tests — W12.2
 *
 * Coverage:
 *   - migrateManualValues: converts to literal bindings, handles empty/undefined
 *   - ensureBinding: returns existing binding, falls back to manualValues, defaults to 0
 */

import { describe, it, expect } from 'vitest'
import { migrateManualValues, ensureBinding } from './migrateBindings'

describe('migrateManualValues', () => {
  it('returns undefined for undefined input', () => {
    expect(migrateManualValues(undefined)).toBeUndefined()
  })

  it('returns undefined for empty object', () => {
    expect(migrateManualValues({})).toBeUndefined()
  })

  it('converts all values to literal bindings', () => {
    const result = migrateManualValues({ a: 1.5, b: -3, c: 0 })
    expect(result).toEqual({
      a: { kind: 'literal', value: 1.5 },
      b: { kind: 'literal', value: -3 },
      c: { kind: 'literal', value: 0 },
    })
  })
})

describe('ensureBinding', () => {
  it('returns existing binding when present', () => {
    const bindings = {
      x: { kind: 'const' as const, constOpId: 'pi' },
    }
    const result = ensureBinding(bindings, { x: 999 }, 'x')
    expect(result).toEqual({ kind: 'const', constOpId: 'pi' })
  })

  it('falls back to manualValues as literal', () => {
    const result = ensureBinding(undefined, { x: 42 }, 'x')
    expect(result).toEqual({ kind: 'literal', value: 42 })
  })

  it('defaults to literal 0 when no value exists', () => {
    const result = ensureBinding(undefined, undefined, 'x')
    expect(result).toEqual({ kind: 'literal', value: 0 })
  })

  it('defaults to literal 0 for missing port', () => {
    const result = ensureBinding({ a: { kind: 'literal', value: 5 } }, { b: 10 }, 'x')
    expect(result).toEqual({ kind: 'literal', value: 0 })
  })
})
