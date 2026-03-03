import { describe, it, expect } from 'vitest'
import { isUniversityEmail, isValidEmailFormat, UNIVERSITY_TLDS } from './studentVerification'

// ── isValidEmailFormat ──────────────────────────────────────────────

describe('isValidEmailFormat', () => {
  it('accepts valid emails', () => {
    expect(isValidEmailFormat('alice@example.com')).toBe(true)
    expect(isValidEmailFormat('bob.smith@uni.ac.uk')).toBe(true)
  })

  it('rejects invalid formats', () => {
    expect(isValidEmailFormat('')).toBe(false)
    expect(isValidEmailFormat('no-at-sign')).toBe(false)
    expect(isValidEmailFormat('@missing-local.com')).toBe(false)
    expect(isValidEmailFormat('missing-domain@')).toBe(false)
    expect(isValidEmailFormat('has spaces@foo.com')).toBe(false)
  })
})

// ── isUniversityEmail ───────────────────────────────────────────────

describe('isUniversityEmail', () => {
  it('accepts US .edu emails', () => {
    expect(isUniversityEmail('student@mit.edu')).toBe(true)
    expect(isUniversityEmail('alice@stanford.edu')).toBe(true)
  })

  it('accepts UK .ac.uk emails', () => {
    expect(isUniversityEmail('bob@imperial.ac.uk')).toBe(true)
    expect(isUniversityEmail('carol@ox.ac.uk')).toBe(true)
  })

  it('accepts Australian .edu.au emails', () => {
    expect(isUniversityEmail('dave@unimelb.edu.au')).toBe(true)
  })

  it('accepts other academic TLDs', () => {
    expect(isUniversityEmail('user@todai.ac.jp')).toBe(true) // Japan
    expect(isUniversityEmail('user@tau.ac.il')).toBe(true) // Israel
    expect(isUniversityEmail('user@usp.edu.br')).toBe(true) // Brazil
    expect(isUniversityEmail('user@nus.edu.sg')).toBe(true) // Singapore
  })

  it('accepts German university patterns', () => {
    expect(isUniversityEmail('user@uni-heidelberg.de')).toBe(true)
    expect(isUniversityEmail('user@tu-muenchen.ac.de')).toBe(true)
  })

  it('accepts French university patterns', () => {
    expect(isUniversityEmail('user@univ-paris.fr')).toBe(true)
  })

  it('accepts Swiss university domains', () => {
    expect(isUniversityEmail('user@student.ethz.ch')).toBe(true)
    expect(isUniversityEmail('user@student.epfl.ch')).toBe(true)
  })

  it('rejects consumer email providers', () => {
    expect(isUniversityEmail('user@gmail.com')).toBe(false)
    expect(isUniversityEmail('user@outlook.com')).toBe(false)
    expect(isUniversityEmail('user@yahoo.co.uk')).toBe(false)
    expect(isUniversityEmail('user@hotmail.com')).toBe(false)
    expect(isUniversityEmail('user@icloud.com')).toBe(false)
  })

  it('rejects corporate emails', () => {
    expect(isUniversityEmail('user@company.com')).toBe(false)
    expect(isUniversityEmail('user@startup.io')).toBe(false)
    expect(isUniversityEmail('user@business.co.uk')).toBe(false)
  })

  it('rejects empty / malformed input', () => {
    expect(isUniversityEmail('')).toBe(false)
    expect(isUniversityEmail('notanemail')).toBe(false)
    expect(isUniversityEmail('@edu')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isUniversityEmail('User@MIT.EDU')).toBe(true)
    expect(isUniversityEmail('Alice@Imperial.AC.UK')).toBe(true)
  })

  it('TLD list has expected minimum entries', () => {
    expect(UNIVERSITY_TLDS.length).toBeGreaterThan(30)
  })
})
