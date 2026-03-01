/**
 * useDebounce.test.ts — E11-3: Tests for the debounce hook logic.
 *
 * Since @testing-library/react renderHook is not available,
 * we test the debounce concept directly via timers.
 */

import { describe, it, expect, vi } from 'vitest'

/**
 * Standalone debounce function that mirrors the hook's behaviour.
 * This allows unit-testing the debounce logic without React context.
 */
function debounce<T>(delayMs: number): {
  push: (v: T) => void
  flush: () => void
  current: () => T | undefined
} {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: T | undefined
  let settled: T | undefined

  return {
    push(v: T) {
      pending = v
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        settled = pending
        timer = null
      }, delayMs)
    },
    flush() {
      if (timer) {
        clearTimeout(timer)
        settled = pending
        timer = null
      }
    },
    current: () => settled,
  }
}

describe('debounce logic (mirrors useDebounce)', () => {
  it('does not settle before delay', () => {
    vi.useFakeTimers()
    const d = debounce<string>(300)
    d.push('hello')
    vi.advanceTimersByTime(200)
    expect(d.current()).toBeUndefined()
    vi.useRealTimers()
  })

  it('settles after delay', () => {
    vi.useFakeTimers()
    const d = debounce<string>(300)
    d.push('hello')
    vi.advanceTimersByTime(350)
    expect(d.current()).toBe('hello')
    vi.useRealTimers()
  })

  it('resets timer on rapid changes', () => {
    vi.useFakeTimers()
    const d = debounce<string>(300)
    d.push('a')
    vi.advanceTimersByTime(200)
    d.push('b')
    vi.advanceTimersByTime(200)
    // 200ms since 'b' — not settled yet
    expect(d.current()).toBeUndefined()
    vi.advanceTimersByTime(150)
    // 350ms since 'b' — settled
    expect(d.current()).toBe('b')
    vi.useRealTimers()
  })

  it('flush settles immediately', () => {
    vi.useFakeTimers()
    const d = debounce<string>(300)
    d.push('flush-test')
    d.flush()
    expect(d.current()).toBe('flush-test')
    vi.useRealTimers()
  })
})
