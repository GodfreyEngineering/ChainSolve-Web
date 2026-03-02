/**
 * rememberMe.test.ts — Unit tests for remember-me toggle (E2-5).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getRememberMe, setRememberMe } from './rememberMe'

beforeEach(() => {
  localStorage.clear()
})

describe('getRememberMe', () => {
  it('defaults to true when nothing stored', () => {
    expect(getRememberMe()).toBe(true)
  })

  it('returns true when stored as "true"', () => {
    localStorage.setItem('cs:remember_me', 'true')
    expect(getRememberMe()).toBe(true)
  })

  it('returns false when stored as "false"', () => {
    localStorage.setItem('cs:remember_me', 'false')
    expect(getRememberMe()).toBe(false)
  })
})

describe('setRememberMe', () => {
  it('persists true', () => {
    setRememberMe(true)
    expect(localStorage.getItem('cs:remember_me')).toBe('true')
  })

  it('persists false', () => {
    setRememberMe(false)
    expect(localStorage.getItem('cs:remember_me')).toBe('false')
  })
})
