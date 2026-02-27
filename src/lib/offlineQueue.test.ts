/**
 * offlineQueue.test.ts — Unit tests for the OfflineQueue state machine.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OfflineQueue } from './offlineQueue'

// Use fast backoff delays for tests so we don't need to wait real seconds
const FAST_DELAYS = [10, 20, 40, 80, 160]

function makeQueue() {
  return new OfflineQueue(FAST_DELAYS)
}

describe('OfflineQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Initial state ─────────────────────────────────────────────────────────

  it('starts idle with no pending save', () => {
    const q = makeQueue()
    expect(q.getState()).toEqual({ hasPending: false, retryCount: 0, nextRetryAt: null })
  })

  // ── enqueue ───────────────────────────────────────────────────────────────

  it('enqueue: sets hasPending and schedules a retry', () => {
    const q = makeQueue()
    const fn = vi.fn().mockResolvedValue(undefined)
    q.enqueue(fn)
    const state = q.getState()
    expect(state.hasPending).toBe(true)
    expect(state.retryCount).toBe(0)
    expect(state.nextRetryAt).toBeGreaterThan(Date.now() - 1)
  })

  it('enqueue: replaces existing pending fn and resets retry count', async () => {
    const q = makeQueue()
    const fn1 = vi.fn().mockRejectedValue(new Error('fail'))
    q.enqueue(fn1)

    // Let the first retry fire (which will fail)
    await vi.advanceTimersByTimeAsync(FAST_DELAYS[0] + 1)
    expect(q.getState().retryCount).toBe(1)

    // Enqueue a new fn — should reset
    const fn2 = vi.fn().mockResolvedValue(undefined)
    q.enqueue(fn2)
    expect(q.getState().retryCount).toBe(0)
    expect(q.getState().hasPending).toBe(true)
  })

  // ── flush success ─────────────────────────────────────────────────────────

  it('flush: clears the queue on success', async () => {
    const q = makeQueue()
    const fn = vi.fn().mockResolvedValue(undefined)
    q.enqueue(fn)
    await q.flush()
    expect(q.getState()).toEqual({ hasPending: false, retryCount: 0, nextRetryAt: null })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('flush: is a no-op when idle', async () => {
    const q = makeQueue()
    await expect(q.flush()).resolves.toBeUndefined()
  })

  // ── flush failure ─────────────────────────────────────────────────────────

  it('flush: increments retryCount and schedules next retry on failure', async () => {
    const q = makeQueue()
    const fn = vi.fn().mockRejectedValue(new Error('network'))
    q.enqueue(fn)

    await q.flush()
    const state = q.getState()
    expect(state.hasPending).toBe(true)
    expect(state.retryCount).toBe(1)
    expect(state.nextRetryAt).toBeGreaterThan(Date.now() - 1)
  })

  it('auto-retry: fires after backoff delay on failure', async () => {
    const q = makeQueue()
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue(undefined)
    q.enqueue(fn)

    // First auto-retry fires after FAST_DELAYS[0]
    await vi.advanceTimersByTimeAsync(FAST_DELAYS[0] + 1)
    expect(fn).toHaveBeenCalledTimes(1) // first attempt failed
    expect(q.getState().retryCount).toBe(1)

    // Second auto-retry fires after FAST_DELAYS[1]
    await vi.advanceTimersByTimeAsync(FAST_DELAYS[1] + 1)
    expect(fn).toHaveBeenCalledTimes(2) // second attempt succeeded
    expect(q.getState().hasPending).toBe(false)
  })

  it('backoff: uses last delay once exhausted', async () => {
    const q = makeQueue()
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    q.enqueue(fn)

    // Exhaust all delay levels
    for (let i = 0; i < FAST_DELAYS.length + 2; i++) {
      const lastDelay = FAST_DELAYS[FAST_DELAYS.length - 1]
      await vi.advanceTimersByTimeAsync(lastDelay + 1)
    }
    // Should still be pending with retryCount > FAST_DELAYS.length
    expect(q.getState().hasPending).toBe(true)
    expect(q.getState().retryCount).toBeGreaterThanOrEqual(FAST_DELAYS.length)
  })

  // ── cancel ────────────────────────────────────────────────────────────────

  it('cancel: clears state and cancels timer', async () => {
    const q = makeQueue()
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    q.enqueue(fn)
    q.cancel()
    expect(q.getState()).toEqual({ hasPending: false, retryCount: 0, nextRetryAt: null })

    // Ensure no retry fires after cancel
    await vi.advanceTimersByTimeAsync(FAST_DELAYS[0] + 1)
    expect(fn).not.toHaveBeenCalled()
  })

  // ── subscribe ─────────────────────────────────────────────────────────────

  it('subscribe: notifies listener on enqueue and cancel', () => {
    const q = makeQueue()
    const listener = vi.fn()
    const unsub = q.subscribe(listener)

    q.enqueue(vi.fn().mockResolvedValue(undefined))
    expect(listener).toHaveBeenCalledTimes(2) // emit() + scheduleRetry emit()

    q.cancel()
    expect(listener).toHaveBeenCalledTimes(3)

    unsub()
    q.enqueue(vi.fn().mockResolvedValue(undefined))
    expect(listener).toHaveBeenCalledTimes(3) // unsubscribed — no more calls
  })

  it('subscribe: notifies listener on flush success', async () => {
    const q = makeQueue()
    const listener = vi.fn()
    q.subscribe(listener)
    listener.mockClear()

    q.enqueue(vi.fn().mockResolvedValue(undefined))
    listener.mockClear()
    await q.flush()
    // Should have been called once for the success state update
    expect(listener).toHaveBeenCalledWith({ hasPending: false, retryCount: 0, nextRetryAt: null })
  })

  // ── flush cancels existing timer ──────────────────────────────────────────

  it('flush: cancels existing auto-retry timer before attempting', async () => {
    const q = makeQueue()
    const fn = vi.fn().mockResolvedValue(undefined)
    q.enqueue(fn)

    // Flush immediately (before the timer fires)
    await q.flush()
    expect(fn).toHaveBeenCalledTimes(1)

    // Advance time — no additional calls should fire
    await vi.advanceTimersByTimeAsync(FAST_DELAYS[0] + 1)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
