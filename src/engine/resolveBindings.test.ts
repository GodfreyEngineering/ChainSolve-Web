/**
 * resolveBindings tests — W12.2
 *
 * Coverage:
 *   - resolveBinding: literal, const, var, unknown const, unknown var
 *   - resolveNodeBindings: merge with legacy manualValues, bindings take precedence
 *   - buildConstantsLookup: from catalog entries
 */

import { describe, it, expect } from 'vitest'
import {
  resolveBinding,
  resolveNodeBindings,
  buildConstantsLookup,
} from './resolveBindings'
import type { InputBinding } from '../blocks/types'
import type { VariablesMap } from '../lib/variables'

const constants: ReadonlyMap<string, number> = new Map([
  ['pi', 3.141592653589793],
  ['euler', 2.718281828459045],
  ['const.physics.g0', 9.80665],
])

const variables: VariablesMap = {
  var1: { id: 'var1', name: 'gravity', value: 9.81 },
  var2: { id: 'var2', name: 'mass', value: 42 },
}

describe('resolveBinding', () => {
  it('resolves literal kind', () => {
    const b: InputBinding = { kind: 'literal', value: 123.45 }
    expect(resolveBinding(b, constants, variables)).toBe(123.45)
  })

  it('resolves const kind', () => {
    const b: InputBinding = { kind: 'const', constOpId: 'pi' }
    expect(resolveBinding(b, constants, variables)).toBe(3.141592653589793)
  })

  it('resolves var kind', () => {
    const b: InputBinding = { kind: 'var', varId: 'var2' }
    expect(resolveBinding(b, constants, variables)).toBe(42)
  })

  it('returns NaN for unknown const', () => {
    const b: InputBinding = { kind: 'const', constOpId: 'nonexistent' }
    expect(resolveBinding(b, constants, variables)).toBeNaN()
  })

  it('returns NaN for unknown var', () => {
    const b: InputBinding = { kind: 'var', varId: 'nonexistent' }
    expect(resolveBinding(b, constants, variables)).toBeNaN()
  })
})

describe('resolveNodeBindings', () => {
  it('returns existing manualValues when no bindings', () => {
    const result = resolveNodeBindings(undefined, { a: 1, b: 2 }, constants, variables)
    expect(result).toEqual({ a: 1, b: 2 })
  })

  it('returns empty when no bindings and no manual', () => {
    const result = resolveNodeBindings(undefined, undefined, constants, variables)
    expect(result).toEqual({})
  })

  it('resolves bindings and merges with manualValues', () => {
    const bindings: Record<string, InputBinding> = {
      a: { kind: 'literal', value: 10 },
      c: { kind: 'const', constOpId: 'euler' },
    }
    const manual = { a: 999, b: 5 }
    const result = resolveNodeBindings(bindings, manual, constants, variables)
    expect(result).toEqual({
      a: 10, // binding takes precedence
      b: 5, // manual preserved
      c: 2.718281828459045, // new from binding
    })
  })

  it('resolves variable bindings', () => {
    const bindings: Record<string, InputBinding> = {
      x: { kind: 'var', varId: 'var1' },
    }
    const result = resolveNodeBindings(bindings, undefined, constants, variables)
    expect(result).toEqual({ x: 9.81 })
  })
})

describe('buildConstantsLookup', () => {
  it('builds map from constantValues record', () => {
    const constantValues = { pi: 3.14, euler: 2.72, 'const.physics.g0': 9.80665 }
    const lookup = buildConstantsLookup(constantValues)
    expect(lookup.get('pi')).toBe(3.14)
    expect(lookup.get('euler')).toBe(2.72)
    expect(lookup.get('const.physics.g0')).toBe(9.80665)
    expect(lookup.size).toBe(3)
  })

  it('returns empty map for empty record', () => {
    const lookup = buildConstantsLookup({})
    expect(lookup.size).toBe(0)
  })
})
