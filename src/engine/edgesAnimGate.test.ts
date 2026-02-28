import { describe, it, expect } from 'vitest'
import {
  computeEffectiveEdgesAnimated,
  ANIM_EDGES_DISABLE_AT,
  ANIM_EDGES_REENABLE_AT,
} from './edgesAnimGate.ts'

describe('computeEffectiveEdgesAnimated', () => {
  it('returns false when user has disabled animation', () => {
    expect(computeEffectiveEdgesAnimated(false, 0, false)).toBe(false)
    expect(computeEffectiveEdgesAnimated(false, 100, false)).toBe(false)
    expect(computeEffectiveEdgesAnimated(false, 500, false)).toBe(false)
  })

  it('returns true for small graphs with animation enabled', () => {
    expect(computeEffectiveEdgesAnimated(true, 0, false)).toBe(true)
    expect(computeEffectiveEdgesAnimated(true, 100, false)).toBe(true)
    expect(computeEffectiveEdgesAnimated(true, ANIM_EDGES_DISABLE_AT, false)).toBe(true)
  })

  it('returns false when edge count exceeds ANIM_EDGES_DISABLE_AT', () => {
    expect(computeEffectiveEdgesAnimated(true, ANIM_EDGES_DISABLE_AT + 1, false)).toBe(false)
    expect(computeEffectiveEdgesAnimated(true, 1000, false)).toBe(false)
  })

  it('hysteresis: stays disabled while count > ANIM_EDGES_REENABLE_AT after auto-disable', () => {
    // Was auto-disabled; count dropped just below DISABLE_AT but still above REENABLE_AT.
    const countInBand = ANIM_EDGES_REENABLE_AT + 1
    expect(computeEffectiveEdgesAnimated(true, countInBand, true)).toBe(false)
  })

  it('hysteresis: re-enables when count drops at or below ANIM_EDGES_REENABLE_AT', () => {
    expect(computeEffectiveEdgesAnimated(true, ANIM_EDGES_REENABLE_AT, true)).toBe(true)
    expect(computeEffectiveEdgesAnimated(true, ANIM_EDGES_REENABLE_AT - 1, true)).toBe(true)
    expect(computeEffectiveEdgesAnimated(true, 0, true)).toBe(true)
  })

  it('without wasAutoDisabled flag, re-enables as soon as count drops to DISABLE_AT', () => {
    // No hysteresis state: should behave as a simple threshold.
    expect(computeEffectiveEdgesAnimated(true, ANIM_EDGES_DISABLE_AT, false)).toBe(true)
    expect(computeEffectiveEdgesAnimated(true, ANIM_EDGES_DISABLE_AT + 1, false)).toBe(false)
  })

  it('thresholds are in the expected range', () => {
    expect(ANIM_EDGES_DISABLE_AT).toBeGreaterThan(100)
    expect(ANIM_EDGES_REENABLE_AT).toBeLessThan(ANIM_EDGES_DISABLE_AT)
    expect(ANIM_EDGES_REENABLE_AT).toBeGreaterThan(0)
  })
})
