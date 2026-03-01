/**
 * turnstile.test.ts — Unit tests for Turnstile CAPTCHA configuration (E2-2).
 */

import { describe, it, expect } from 'vitest'
import { isTurnstileEnabled } from './turnstile'

describe('isTurnstileEnabled', () => {
  it('returns false when VITE_TURNSTILE_SITE_KEY is not set', () => {
    // In test environment, import.meta.env.VITE_TURNSTILE_SITE_KEY is undefined
    // which means TURNSTILE_SITE_KEY defaults to '' and isTurnstileEnabled returns false.
    expect(isTurnstileEnabled()).toBe(false)
  })
})
