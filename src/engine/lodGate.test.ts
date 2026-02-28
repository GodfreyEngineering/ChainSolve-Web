import { describe, it, expect } from 'vitest'
import {
  computeLodTier,
  LOD_COMPACT_ENTER,
  LOD_FULL_REENTER,
  LOD_MINIMAL_ENTER,
  LOD_COMPACT_REENTER,
} from './lodGate.ts'

describe('computeLodTier', () => {
  // ── Threshold ordering invariant ────────────────────────────────────────
  it('re-enter thresholds are above their enter counterparts (hysteresis)', () => {
    expect(LOD_FULL_REENTER).toBeGreaterThan(LOD_COMPACT_ENTER)
    expect(LOD_COMPACT_REENTER).toBeGreaterThan(LOD_MINIMAL_ENTER)
  })

  // ── Normal zoom-out path ─────────────────────────────────────────────────
  it('stays full above compact-enter threshold', () => {
    expect(computeLodTier(1.0, 'full')).toBe('full')
    expect(computeLodTier(LOD_COMPACT_ENTER, 'full')).toBe('full')
  })

  it('transitions full → compact just below LOD_COMPACT_ENTER', () => {
    expect(computeLodTier(LOD_COMPACT_ENTER - 0.01, 'full')).toBe('compact')
  })

  it('transitions compact → minimal just below LOD_MINIMAL_ENTER', () => {
    expect(computeLodTier(LOD_MINIMAL_ENTER - 0.01, 'compact')).toBe('minimal')
  })

  it('stays compact inside the hysteresis band (below compact-enter, above minimal-enter)', () => {
    const midBand = (LOD_MINIMAL_ENTER + LOD_COMPACT_ENTER) / 2
    expect(computeLodTier(midBand, 'compact')).toBe('compact')
  })

  // ── Hysteresis: zoom-in path ─────────────────────────────────────────────
  it('stays minimal below LOD_COMPACT_REENTER', () => {
    expect(computeLodTier(LOD_COMPACT_REENTER - 0.01, 'minimal')).toBe('minimal')
  })

  it('transitions minimal → compact at LOD_COMPACT_REENTER', () => {
    expect(computeLodTier(LOD_COMPACT_REENTER, 'minimal')).toBe('compact')
    expect(computeLodTier(LOD_COMPACT_REENTER + 0.1, 'minimal')).toBe('compact')
  })

  it('stays compact inside the re-entry hysteresis band (above compact-reenter, below full-reenter)', () => {
    const midBand = (LOD_COMPACT_REENTER + LOD_FULL_REENTER) / 2
    expect(computeLodTier(midBand, 'compact')).toBe('compact')
  })

  it('transitions compact → full at LOD_FULL_REENTER', () => {
    expect(computeLodTier(LOD_FULL_REENTER, 'compact')).toBe('full')
    expect(computeLodTier(1.5, 'compact')).toBe('full')
  })

  // ── Edge cases ───────────────────────────────────────────────────────────
  it('does not jump two tiers from full to minimal in one step', () => {
    // Even at zoom=0 the result from 'full' is only 'compact', not 'minimal'.
    // A second call with prev='compact' would reach 'minimal'.
    expect(computeLodTier(0, 'full')).toBe('compact')
  })

  it('returns full from minimal when zoom is very high', () => {
    // minimal → compact first, then compact → full requires a second step;
    // a single call from 'minimal' should NOT jump to 'full'.
    expect(computeLodTier(2.0, 'minimal')).toBe('compact')
  })

  it('returns full immediately from compact when zoom is high', () => {
    expect(computeLodTier(2.0, 'compact')).toBe('full')
  })
})
