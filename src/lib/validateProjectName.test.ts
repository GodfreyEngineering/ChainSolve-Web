/**
 * validateProjectName unit tests.
 *
 * Run with: npm run test:unit
 */

import { describe, it, expect } from 'vitest'
import { validateProjectName, PROJECT_NAME_MAX_LENGTH } from './validateProjectName'

describe('validateProjectName', () => {
  // ── Valid cases ────────────────────────────────────────────────────────────

  it('accepts a simple name', () => {
    expect(validateProjectName('My Project')).toEqual({ ok: true })
  })

  it('accepts a name with numbers and punctuation', () => {
    expect(validateProjectName('Structural Analysis v2.1 (Draft)')).toEqual({ ok: true })
  })

  it('accepts a single character', () => {
    expect(validateProjectName('X')).toEqual({ ok: true })
  })

  it('accepts exactly PROJECT_NAME_MAX_LENGTH characters', () => {
    const maxName = 'a'.repeat(PROJECT_NAME_MAX_LENGTH)
    expect(validateProjectName(maxName)).toEqual({ ok: true })
  })

  it('accepts names with Unicode letters', () => {
    expect(validateProjectName('Ångström Analysis')).toEqual({ ok: true })
  })

  it('accepts a name with leading/trailing spaces (trimmed)', () => {
    // Whitespace-only fails; mixed content with surrounding spaces passes
    expect(validateProjectName('  My Project  ')).toEqual({ ok: true })
  })

  // ── Empty / whitespace cases ───────────────────────────────────────────────

  it('rejects empty string', () => {
    const result = validateProjectName('')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/empty/)
  })

  it('rejects whitespace-only string', () => {
    const result = validateProjectName('   ')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/empty/)
  })

  it('rejects tab-only string', () => {
    const result = validateProjectName('\t\n')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/empty/)
  })

  // ── Length cases ───────────────────────────────────────────────────────────

  it('rejects names exceeding PROJECT_NAME_MAX_LENGTH', () => {
    const longName = 'a'.repeat(PROJECT_NAME_MAX_LENGTH + 1)
    const result = validateProjectName(longName)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/exceed/)
  })

  // ── Control character cases ────────────────────────────────────────────────

  it('rejects names with null bytes', () => {
    const result = validateProjectName('Project\x00Name')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/control/)
  })

  it('rejects names with carriage returns', () => {
    const result = validateProjectName('Project\rName')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/control/)
  })

  it('rejects names with newlines', () => {
    const result = validateProjectName('Line1\nLine2')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/control/)
  })

  it('rejects names with DEL character', () => {
    const result = validateProjectName('Project\x7FName')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/control/)
  })

  // ── Type cases ─────────────────────────────────────────────────────────────

  it('rejects non-string inputs', () => {
    expect(validateProjectName(null).ok).toBe(false)
    expect(validateProjectName(42).ok).toBe(false)
    expect(validateProjectName(undefined).ok).toBe(false)
    expect(validateProjectName({}).ok).toBe(false)
  })
})
