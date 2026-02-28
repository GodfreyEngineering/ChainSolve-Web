/**
 * marketplace-checkout.helper.test.ts — P112
 *
 * Unit tests for pure helper functions extracted from the
 * marketplace-checkout edge function.  Inlined here so tests do not
 * cross tsconfig boundaries (functions/ uses @cloudflare/workers-types,
 * src/ uses browser globals).
 *
 * Inline copies MUST stay in sync with
 * functions/api/stripe/marketplace-checkout.ts.
 */

import { describe, it, expect } from 'vitest'

// ── Inline copies from functions/api/stripe/marketplace-checkout.ts ──────────

const DEFAULT_PLATFORM_FEE_RATE = 0.15

function computeApplicationFee(priceCents: number, feeRate: number): number {
  return Math.round(priceCents * feeRate)
}

// ─────────────────────────────────────────────────────────────────────────────

describe('computeApplicationFee', () => {
  it('computes 15% of a round price', () => {
    expect(computeApplicationFee(1000, DEFAULT_PLATFORM_FEE_RATE)).toBe(150)
  })

  it('rounds to nearest penny', () => {
    // £9.99 → 999 pence × 0.15 = 149.85 → rounds to 150
    expect(computeApplicationFee(999, DEFAULT_PLATFORM_FEE_RATE)).toBe(150)
    // £4.99 → 499 × 0.15 = 74.85 → rounds to 75
    expect(computeApplicationFee(499, DEFAULT_PLATFORM_FEE_RATE)).toBe(75)
  })

  it('returns 0 for a free item', () => {
    expect(computeApplicationFee(0, DEFAULT_PLATFORM_FEE_RATE)).toBe(0)
  })

  it('respects a custom fee rate', () => {
    expect(computeApplicationFee(1000, 0.1)).toBe(100)
    expect(computeApplicationFee(1000, 0.2)).toBe(200)
  })

  it('does not exceed the item price', () => {
    // fee rate of 1.0 = 100% — unusual but should not break
    expect(computeApplicationFee(500, 1.0)).toBe(500)
  })
})
