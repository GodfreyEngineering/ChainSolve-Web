/**
 * termsVersion.test.ts — Unit tests for ToS versioning (E2-3).
 */

import { describe, it, expect } from 'vitest'
import { CURRENT_TERMS_VERSION } from './termsVersion'

describe('CURRENT_TERMS_VERSION', () => {
  it('is a non-empty semver-like string', () => {
    expect(CURRENT_TERMS_VERSION).toBeTruthy()
    expect(typeof CURRENT_TERMS_VERSION).toBe('string')
    // Must be in format N.N (e.g. 1.0, 2.1)
    expect(CURRENT_TERMS_VERSION).toMatch(/^\d+\.\d+$/)
  })
})
