import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AutosaveScheduler, AUTOSAVE_DELAY_MS, MAX_LOSS_MS } from './autosaveScheduler'

describe('autosave contract constants', () => {
  it('AUTOSAVE_DELAY_MS is positive', () => {
    expect(AUTOSAVE_DELAY_MS).toBeGreaterThan(0)
  })

  it('AUTOSAVE_DELAY_MS <= MAX_LOSS_MS (≤5s crash-loss contract)', () => {
    expect(AUTOSAVE_DELAY_MS).toBeLessThanOrEqual(MAX_LOSS_MS)
  })

  it('MAX_LOSS_MS is 5000ms', () => {
    expect(MAX_LOSS_MS).toBe(5_000)
  })
})

describe('AutosaveScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with no pending save', () => {
    const save = vi.fn()
    const s = new AutosaveScheduler(save, 2000)
    expect(s.hasPending()).toBe(false)
    expect(save).not.toHaveBeenCalled()
  })

  it('schedule() sets hasPending to true', () => {
    const save = vi.fn()
    const s = new AutosaveScheduler(save, 2000)
    s.schedule()
    expect(s.hasPending()).toBe(true)
    expect(save).not.toHaveBeenCalled()
  })

  it('fires save after the delay', () => {
    const save = vi.fn()
    const s = new AutosaveScheduler(save, 2000)
    s.schedule()
    vi.advanceTimersByTime(2000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(s.hasPending()).toBe(false)
  })

  it('does not fire before the delay', () => {
    const save = vi.fn()
    const s = new AutosaveScheduler(save, 2000)
    s.schedule()
    vi.advanceTimersByTime(1999)
    expect(save).not.toHaveBeenCalled()
    expect(s.hasPending()).toBe(true)
  })

  it('rapid successive schedule() calls coalesce into one save (debounce)', () => {
    const save = vi.fn()
    const s = new AutosaveScheduler(save, 2000)

    // Simulate 10 rapid changes 50ms apart
    for (let i = 0; i < 10; i++) {
      s.schedule()
      vi.advanceTimersByTime(50)
    }
    // No save yet — last schedule restarted the timer
    expect(save).not.toHaveBeenCalled()

    // Advance past the debounce window
    vi.advanceTimersByTime(2000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('two widely-spaced changes produce two saves', () => {
    const save = vi.fn()
    const s = new AutosaveScheduler(save, 2000)

    s.schedule()
    vi.advanceTimersByTime(2000) // first save fires
    expect(save).toHaveBeenCalledTimes(1)

    s.schedule()
    vi.advanceTimersByTime(2000) // second save fires
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('cancel() prevents the scheduled save from firing', () => {
    const save = vi.fn()
    const s = new AutosaveScheduler(save, 2000)
    s.schedule()
    expect(s.hasPending()).toBe(true)
    s.cancel()
    expect(s.hasPending()).toBe(false)
    vi.advanceTimersByTime(3000)
    expect(save).not.toHaveBeenCalled()
  })

  it('cancel() on an idle scheduler is a no-op', () => {
    const save = vi.fn()
    const s = new AutosaveScheduler(save, 2000)
    expect(() => s.cancel()).not.toThrow()
    expect(s.hasPending()).toBe(false)
  })

  it('schedule after cancel works normally', () => {
    const save = vi.fn()
    const s = new AutosaveScheduler(save, 2000)
    s.schedule()
    s.cancel()
    s.schedule()
    vi.advanceTimersByTime(2000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('uses AUTOSAVE_DELAY_MS as default delay', () => {
    const save = vi.fn()
    const s = new AutosaveScheduler(save) // no explicit delay
    s.schedule()
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1)
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(save).toHaveBeenCalledTimes(1)
  })
})
