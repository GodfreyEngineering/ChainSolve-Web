import { describe, it, expect } from 'vitest'
import { validateDisplayName } from './validateDisplayName'

describe('validateDisplayName', () => {
  // ── Valid names ─────────────────────────────────────────────────────────────

  it('accepts a normal name', () => {
    expect(validateDisplayName('Alice')).toEqual({ ok: true })
  })

  it('accepts name with spaces', () => {
    expect(validateDisplayName('Alice Smith')).toEqual({ ok: true })
  })

  it('accepts name with hyphens', () => {
    expect(validateDisplayName('Jean-Pierre')).toEqual({ ok: true })
  })

  it('accepts name with apostrophe', () => {
    expect(validateDisplayName("O'Brien")).toEqual({ ok: true })
  })

  it('accepts name with period', () => {
    expect(validateDisplayName('Dr. Smith')).toEqual({ ok: true })
  })

  it('accepts name with underscores', () => {
    expect(validateDisplayName('cool_user_42')).toEqual({ ok: true })
  })

  it('accepts Unicode letters', () => {
    expect(validateDisplayName('Muller')).toEqual({ ok: true })
  })

  it('accepts CJK characters', () => {
    expect(validateDisplayName('Tanaka')).toEqual({ ok: true })
  })

  it('accepts Hebrew characters', () => {
    expect(validateDisplayName('Ben')).toEqual({ ok: true })
  })

  it('accepts exactly 2 characters (min length)', () => {
    expect(validateDisplayName('AB')).toEqual({ ok: true })
  })

  it('accepts exactly 100 characters (max length)', () => {
    expect(validateDisplayName('a'.repeat(100))).toEqual({ ok: true })
  })

  // ── Invalid: empty / length ─────────────────────────────────────────────────

  it('rejects empty string', () => {
    expect(validateDisplayName('')).toEqual({ ok: false, error: 'displayNameRequired' })
  })

  it('rejects whitespace-only string', () => {
    expect(validateDisplayName('   ')).toEqual({ ok: false, error: 'displayNameRequired' })
  })

  it('rejects single character', () => {
    expect(validateDisplayName('A')).toEqual({ ok: false, error: 'displayNameTooShort' })
  })

  it('rejects name over 100 characters', () => {
    expect(validateDisplayName('a'.repeat(101))).toEqual({ ok: false, error: 'displayNameTooLong' })
  })

  // ── Invalid: control chars ──────────────────────────────────────────────────

  it('rejects null byte', () => {
    expect(validateDisplayName('hello\x00')).toEqual({
      ok: false,
      error: 'displayNameControlChars',
    })
  })

  it('rejects zero-width space', () => {
    expect(validateDisplayName('hello\u200Bworld')).toEqual({
      ok: false,
      error: 'displayNameControlChars',
    })
  })

  // ── Invalid: special chars ──────────────────────────────────────────────────

  it('rejects angle brackets', () => {
    expect(validateDisplayName('<script>')).toEqual({ ok: false, error: 'displayNameInvalidChars' })
  })

  it('rejects at sign', () => {
    expect(validateDisplayName('user@name')).toEqual({
      ok: false,
      error: 'displayNameInvalidChars',
    })
  })

  it('rejects slash', () => {
    expect(validateDisplayName('path/name')).toEqual({
      ok: false,
      error: 'displayNameInvalidChars',
    })
  })

  // ── Invalid: forbidden words ────────────────────────────────────────────────

  it('rejects "admin" (case-insensitive)', () => {
    expect(validateDisplayName('Admin')).toEqual({ ok: false, error: 'displayNameForbidden' })
  })

  it('rejects "moderator"', () => {
    expect(validateDisplayName('Moderator')).toEqual({ ok: false, error: 'displayNameForbidden' })
  })

  it('rejects "official" in compound name', () => {
    expect(validateDisplayName('The Official Bot')).toEqual({
      ok: false,
      error: 'displayNameForbidden',
    })
  })

  it('rejects "[deleted]"', () => {
    expect(validateDisplayName('[deleted]')).toEqual({
      ok: false,
      error: 'displayNameInvalidChars',
    })
  })

  it('rejects "null"', () => {
    expect(validateDisplayName('null')).toEqual({ ok: false, error: 'displayNameForbidden' })
  })

  it('rejects "undefined"', () => {
    expect(validateDisplayName('undefined')).toEqual({ ok: false, error: 'displayNameForbidden' })
  })

  it('does not reject normal names containing "in" (substring of admin)', () => {
    // "admin" is a full pattern match, not just "in"
    expect(validateDisplayName('Martin')).toEqual({ ok: true })
  })

  it('trims whitespace before validation', () => {
    expect(validateDisplayName('  Alice  ')).toEqual({ ok: true })
  })
})
