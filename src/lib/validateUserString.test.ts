import { describe, it, expect } from 'vitest'
import { validateUserString, hasControlChars, findForbiddenWord } from './validateUserString'

describe('validateUserString (strict)', () => {
  it('accepts simple identifier', () => {
    expect(validateUserString('my-material')).toEqual({ ok: true })
  })

  it('accepts underscores and dashes', () => {
    expect(validateUserString('steel_304L')).toEqual({ ok: true })
  })

  it('accepts digits', () => {
    expect(validateUserString('theme01')).toEqual({ ok: true })
  })

  it('accepts exactly 3 chars (default min)', () => {
    expect(validateUserString('abc')).toEqual({ ok: true })
  })

  it('accepts exactly 50 chars (default max)', () => {
    expect(validateUserString('a'.repeat(50))).toEqual({ ok: true })
  })

  it('rejects empty string', () => {
    const r = validateUserString('')
    expect(r.ok).toBe(false)
  })

  it('rejects too short', () => {
    const r = validateUserString('ab')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('at least 3')
  })

  it('rejects too long', () => {
    const r = validateUserString('a'.repeat(51))
    expect(r.ok).toBe(false)
    expect(r.error).toContain('exceed 50')
  })

  it('rejects spaces', () => {
    const r = validateUserString('my material')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('letters, numbers, underscores, and dashes')
  })

  it('rejects special characters', () => {
    expect(validateUserString("O'Brien").ok).toBe(false)
    expect(validateUserString('Dr. Smith').ok).toBe(false)
    expect(validateUserString('user@name').ok).toBe(false)
  })

  it('rejects control characters', () => {
    expect(validateUserString('hello\x00world').ok).toBe(false)
  })

  it('rejects offensive words', () => {
    const r = validateUserString('fuck_you')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('forbidden')
  })

  it('rejects admin impersonation', () => {
    expect(validateUserString('admin').ok).toBe(false)
    expect(validateUserString('SuperAdmin').ok).toBe(false)
  })

  it('allows non-string input to fail gracefully', () => {
    const r = validateUserString(42 as unknown as string)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('must be a string')
  })

  it('respects custom minLength/maxLength', () => {
    const r = validateUserString('ab', { minLength: 1, maxLength: 5 })
    expect(r.ok).toBe(true)

    const r2 = validateUserString('abcdef', { minLength: 1, maxLength: 5 })
    expect(r2.ok).toBe(false)
  })

  it('uses custom field name in error messages', () => {
    const r = validateUserString('', { field: 'Material name' })
    expect(r.error).toContain('Material name')
  })
})

describe('hasControlChars', () => {
  it('detects null byte', () => {
    expect(hasControlChars('hello\x00')).toBe(true)
  })

  it('detects zero-width space', () => {
    expect(hasControlChars('hello\u200Bworld')).toBe(true)
  })

  it('passes clean string', () => {
    expect(hasControlChars('hello world')).toBe(false)
  })
})

describe('findForbiddenWord', () => {
  it('finds admin in AdminUser', () => {
    expect(findForbiddenWord('AdminUser')).toBe('admin')
  })

  it('finds forbidden across word boundaries', () => {
    expect(findForbiddenWord('Buy Now')).toBe('buy_now')
  })

  it('returns null for clean string', () => {
    expect(findForbiddenWord('Martin')).toBeNull()
  })

  it('returns null for Officer (not official)', () => {
    expect(findForbiddenWord('Officer')).toBeNull()
  })
})
