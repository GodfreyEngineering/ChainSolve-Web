/**
 * rtl.test.ts — P148: Unit tests for RTL language utilities.
 */

import { describe, it, expect } from 'vitest'
import { RTL_LANGS, isRTL, getDirection } from './rtl'

// ── isRTL ─────────────────────────────────────────────────────────────────────

describe('isRTL', () => {
  it('returns true for Arabic (ar)', () => expect(isRTL('ar')).toBe(true))
  it('returns true for Hebrew (he)', () => expect(isRTL('he')).toBe(true))
  it('returns true for Persian (fa)', () => expect(isRTL('fa')).toBe(true))
  it('returns true for Urdu (ur)', () => expect(isRTL('ur')).toBe(true))
  it('returns true for Pashto (ps)', () => expect(isRTL('ps')).toBe(true))
  it('returns true for Sindhi (sd)', () => expect(isRTL('sd')).toBe(true))

  it('returns false for English (en)', () => expect(isRTL('en')).toBe(false))
  it('returns false for French (fr)', () => expect(isRTL('fr')).toBe(false))
  it('returns false for Spanish (es)', () => expect(isRTL('es')).toBe(false))
  it('returns false for German (de)', () => expect(isRTL('de')).toBe(false))
  it('returns false for Italian (it)', () => expect(isRTL('it')).toBe(false))
  it('returns false for Chinese (zh)', () => expect(isRTL('zh')).toBe(false))
  it('returns false for Japanese (ja)', () => expect(isRTL('ja')).toBe(false))

  it('handles full BCP 47 tags like "he-IL"', () => expect(isRTL('he-IL')).toBe(true))
  it('handles full BCP 47 tags like "ar-SA"', () => expect(isRTL('ar-SA')).toBe(true))
  it('handles full BCP 47 tags like "en-US"', () => expect(isRTL('en-US')).toBe(false))

  it('is case-insensitive for "AR"', () => expect(isRTL('AR')).toBe(true))
  it('is case-insensitive for "HE"', () => expect(isRTL('HE')).toBe(true))
  it('is case-insensitive for "EN"', () => expect(isRTL('EN')).toBe(false))

  it('returns false for empty string', () => expect(isRTL('')).toBe(false))
  it('returns false for a single-char code', () => expect(isRTL('a')).toBe(false))
})

// ── getDirection ──────────────────────────────────────────────────────────────

describe('getDirection', () => {
  it('returns "rtl" for Arabic', () => expect(getDirection('ar')).toBe('rtl'))
  it('returns "rtl" for Hebrew', () => expect(getDirection('he')).toBe('rtl'))
  it('returns "ltr" for English', () => expect(getDirection('en')).toBe('ltr'))
  it('returns "ltr" for French', () => expect(getDirection('fr')).toBe('ltr'))
  it('returns "rtl" for "he-IL" full tag', () => expect(getDirection('he-IL')).toBe('rtl'))
  it('returns "ltr" for "en-US" full tag', () => expect(getDirection('en-US')).toBe('ltr'))
})

// ── RTL_LANGS set ─────────────────────────────────────────────────────────────

describe('RTL_LANGS', () => {
  it('contains at minimum Arabic and Hebrew', () => {
    expect(RTL_LANGS.has('ar')).toBe(true)
    expect(RTL_LANGS.has('he')).toBe(true)
  })

  it('does not contain LTR languages', () => {
    expect(RTL_LANGS.has('en')).toBe(false)
    expect(RTL_LANGS.has('fr')).toBe(false)
    expect(RTL_LANGS.has('de')).toBe(false)
  })
})
