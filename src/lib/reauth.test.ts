/**
 * reauth.test.ts
 *
 * Tests for the P055 re-authentication window module.
 * Covers: isReauthed, markReauthed, clearReauth, REAUTH_WINDOW_MS.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { isReauthed, markReauthed, clearReauth, REAUTH_WINDOW_MS } from './reauth'

// The module has a module-level expiry variable; we reset it between tests
// by calling clearReauth().
describe('reauth state machine', () => {
  beforeEach(() => {
    clearReauth()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts as not re-authenticated', () => {
    expect(isReauthed()).toBe(false)
  })

  it('markReauthed makes isReauthed return true', () => {
    markReauthed()
    expect(isReauthed()).toBe(true)
  })

  it('clearReauth makes isReauthed return false again', () => {
    markReauthed()
    clearReauth()
    expect(isReauthed()).toBe(false)
  })

  it('REAUTH_WINDOW_MS is 10 minutes', () => {
    expect(REAUTH_WINDOW_MS).toBe(10 * 60 * 1000)
  })

  it('isReauthed returns false after the window expires', () => {
    vi.useFakeTimers()
    markReauthed()
    expect(isReauthed()).toBe(true)
    // Advance past the 10-minute window
    vi.advanceTimersByTime(REAUTH_WINDOW_MS + 1)
    expect(isReauthed()).toBe(false)
  })

  it('isReauthed returns true just before window expiry', () => {
    vi.useFakeTimers()
    markReauthed()
    vi.advanceTimersByTime(REAUTH_WINDOW_MS - 1000)
    expect(isReauthed()).toBe(true)
  })

  it('calling markReauthed again resets the window', () => {
    vi.useFakeTimers()
    markReauthed()
    // Advance 9 minutes
    vi.advanceTimersByTime(9 * 60 * 1000)
    // Renew
    markReauthed()
    // Advance another 9 minutes (total 18, but window was refreshed at 9)
    vi.advanceTimersByTime(9 * 60 * 1000)
    expect(isReauthed()).toBe(true)
  })
})
