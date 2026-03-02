/**
 * customFunctions.test.ts — Unit tests for custom function validation,
 * ID generation, and localStorage CRUD (H5-1).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  validateFunctionName,
  validateFunctionDescription,
  validateFunctionFormula,
  validateFunctionInputs,
  generateFunctionId,
  loadCustomFunctions,
  saveCustomFunctions,
  MAX_FUNCTION_NAME_LENGTH,
  MAX_FUNCTION_DESC_LENGTH,
  MAX_FUNCTION_FORMULA_LENGTH,
  MAX_FUNCTION_INPUTS,
  type CustomFunction,
} from './customFunctions'

// ── Validation ────────────────────────────────────────────────────────────────

describe('validateFunctionName', () => {
  it('rejects empty name', () => {
    expect(validateFunctionName('').ok).toBe(false)
    expect(validateFunctionName('   ').ok).toBe(false)
  })

  it('accepts valid name', () => {
    expect(validateFunctionName('Beam deflection').ok).toBe(true)
  })

  it('rejects name exceeding max length', () => {
    const long = 'A'.repeat(MAX_FUNCTION_NAME_LENGTH + 1)
    const result = validateFunctionName(long)
    expect(result.ok).toBe(false)
    expect(result.error).toContain(String(MAX_FUNCTION_NAME_LENGTH))
  })

  it('accepts name at max length', () => {
    expect(validateFunctionName('A'.repeat(MAX_FUNCTION_NAME_LENGTH)).ok).toBe(true)
  })
})

describe('validateFunctionDescription', () => {
  it('accepts empty description', () => {
    expect(validateFunctionDescription('').ok).toBe(true)
  })

  it('accepts valid description', () => {
    expect(validateFunctionDescription('Calculates beam deflection').ok).toBe(true)
  })

  it('rejects description exceeding max length', () => {
    const long = 'A'.repeat(MAX_FUNCTION_DESC_LENGTH + 1)
    const result = validateFunctionDescription(long)
    expect(result.ok).toBe(false)
    expect(result.error).toContain(String(MAX_FUNCTION_DESC_LENGTH))
  })
})

describe('validateFunctionFormula', () => {
  it('rejects empty formula', () => {
    expect(validateFunctionFormula('').ok).toBe(false)
    expect(validateFunctionFormula('   ').ok).toBe(false)
  })

  it('accepts valid formula', () => {
    expect(validateFunctionFormula('a * b^2 / (2 * c)').ok).toBe(true)
  })

  it('rejects unbalanced parentheses — open', () => {
    const result = validateFunctionFormula('(a + b')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('parentheses')
  })

  it('rejects unbalanced parentheses — close', () => {
    const result = validateFunctionFormula('a + b)')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('parentheses')
  })

  it('rejects formula exceeding max length', () => {
    const long = 'a+'.repeat(MAX_FUNCTION_FORMULA_LENGTH)
    expect(validateFunctionFormula(long).ok).toBe(false)
  })
})

describe('validateFunctionInputs', () => {
  it('rejects empty inputs', () => {
    expect(validateFunctionInputs([]).ok).toBe(false)
  })

  it('accepts valid inputs', () => {
    expect(validateFunctionInputs([{ id: 'a', label: 'A' }]).ok).toBe(true)
  })

  it('accepts multiple valid inputs', () => {
    const inputs = [
      { id: 'x', label: 'X value' },
      { id: 'y', label: 'Y value' },
    ]
    expect(validateFunctionInputs(inputs).ok).toBe(true)
  })

  it('rejects empty input ID', () => {
    const result = validateFunctionInputs([{ id: '', label: 'A' }])
    expect(result.ok).toBe(false)
    expect(result.error).toContain('ID')
  })

  it('rejects invalid input ID (starts with number)', () => {
    const result = validateFunctionInputs([{ id: '1x', label: 'X' }])
    expect(result.ok).toBe(false)
  })

  it('rejects duplicate input IDs', () => {
    const inputs = [
      { id: 'a', label: 'A' },
      { id: 'a', label: 'A2' },
    ]
    const result = validateFunctionInputs(inputs)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Duplicate')
  })

  it('rejects empty input label', () => {
    const result = validateFunctionInputs([{ id: 'a', label: '  ' }])
    expect(result.ok).toBe(false)
    expect(result.error).toContain('label')
  })

  it('rejects too many inputs', () => {
    const inputs = Array.from({ length: MAX_FUNCTION_INPUTS + 1 }, (_, i) => ({
      id: `x${i}`,
      label: `X${i}`,
    }))
    expect(validateFunctionInputs(inputs).ok).toBe(false)
  })

  it('accepts underscore-starting input ID', () => {
    expect(validateFunctionInputs([{ id: '_val', label: 'Val' }]).ok).toBe(true)
  })
})

// ── ID generation ─────────────────────────────────────────────────────────────

describe('generateFunctionId', () => {
  it('returns a string starting with cfb_', () => {
    const id = generateFunctionId()
    expect(id).toMatch(/^cfb_\d+_[a-z0-9]+$/)
  })

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateFunctionId()))
    expect(ids.size).toBe(20)
  })
})

// ── localStorage CRUD ─────────────────────────────────────────────────────────

describe('loadCustomFunctions / saveCustomFunctions', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty array when nothing stored', () => {
    expect(loadCustomFunctions()).toEqual([])
  })

  it('round-trips a saved function', () => {
    const fn: CustomFunction = {
      id: 'cfb_test',
      name: 'Test',
      tag: 'math',
      inputs: [{ id: 'a', label: 'A' }],
      formula: 'a * 2',
    }
    saveCustomFunctions([fn])
    const loaded = loadCustomFunctions()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('cfb_test')
    expect(loaded[0].formula).toBe('a * 2')
  })

  it('filters out invalid entries', () => {
    localStorage.setItem(
      'cs:custom-functions',
      JSON.stringify([{ bad: true }, { id: 'ok', name: 'Ok', formula: 'x', inputs: [] }]),
    )
    const loaded = loadCustomFunctions()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('ok')
  })

  it('returns empty array for corrupted JSON', () => {
    localStorage.setItem('cs:custom-functions', '{{bad json')
    expect(loadCustomFunctions()).toEqual([])
  })

  it('returns empty array for non-array JSON', () => {
    localStorage.setItem('cs:custom-functions', '"hello"')
    expect(loadCustomFunctions()).toEqual([])
  })

  it('handles localStorage.setItem failure gracefully', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    // Should not throw
    saveCustomFunctions([
      { id: 'x', name: 'X', tag: 'math', inputs: [{ id: 'a', label: 'A' }], formula: 'a' },
    ])
    spy.mockRestore()
  })
})
