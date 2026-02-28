/**
 * wcagContrast.test.ts
 *
 * Verifies:
 *   1. The WCAG math primitives are correct.
 *   2. After the P074 token fixes, all design-token pairs used in the app
 *      meet WCAG 2.1 AA (4.5:1 for normal text).
 *
 * Token values must match src/index.css exactly. Update here when tokens change.
 */

import { describe, it, expect } from 'vitest'
import {
  luminance,
  blendAlpha,
  contrastRatio,
  hexContrast,
  alphaHexContrast,
  hexToRgb,
  meetsAA,
  meetsAALarge,
} from './wcagContrast'

// ── Primitive maths ────────────────────────────────────────────────────────────

describe('luminance', () => {
  it('pure black = 0', () => {
    expect(luminance(0, 0, 0)).toBe(0)
  })

  it('pure white = 1', () => {
    expect(luminance(1, 1, 1)).toBeCloseTo(1, 5)
  })

  it('mid-grey ~0.216', () => {
    // sRGB 0.5 → linear ≈ 0.2140
    const l = luminance(0.5, 0.5, 0.5)
    expect(l).toBeGreaterThan(0.21)
    expect(l).toBeLessThan(0.22)
  })
})

describe('contrastRatio', () => {
  it('black on white = 21', () => {
    expect(contrastRatio(0, 1)).toBeCloseTo(21, 0)
  })

  it('same colour = 1', () => {
    expect(contrastRatio(0.5, 0.5)).toBe(1)
  })

  it('is symmetric', () => {
    const a = 0.2
    const b = 0.6
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10)
  })
})

describe('blendAlpha', () => {
  it('alpha=1 returns fg unchanged', () => {
    const result = blendAlpha([1, 0, 0], 1, [0, 0, 1])
    expect(result).toEqual([1, 0, 0])
  })

  it('alpha=0 returns bg unchanged', () => {
    const result = blendAlpha([1, 0, 0], 0, [0, 0, 1])
    expect(result).toEqual([0, 0, 1])
  })

  it('alpha=0.5 blends evenly', () => {
    const result = blendAlpha([1, 0, 0], 0.5, [0, 0, 1])
    expect(result[0]).toBeCloseTo(0.5, 10)
    expect(result[1]).toBeCloseTo(0, 10)
    expect(result[2]).toBeCloseTo(0.5, 10)
  })
})

describe('hexToRgb', () => {
  it('parses #000000', () => {
    expect(hexToRgb('#000000')).toEqual([0, 0, 0])
  })

  it('parses #ffffff', () => {
    expect(hexToRgb('#ffffff')).toEqual([1, 1, 1])
  })

  it('parses without leading #', () => {
    expect(hexToRgb('ff0000')).toEqual([1, 0, 0])
  })

  it('throws on invalid hex', () => {
    expect(() => hexToRgb('#gg0000')).toThrow()
  })
})

describe('hexContrast', () => {
  it('black vs white = 21', () => {
    expect(hexContrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('same hex = 1', () => {
    expect(hexContrast('#1cabb0', '#1cabb0')).toBeCloseTo(1, 5)
  })
})

describe('meetsAA / meetsAALarge', () => {
  it('4.5 passes AA', () => expect(meetsAA(4.5)).toBe(true))
  it('4.49 fails AA', () => expect(meetsAA(4.49)).toBe(false))
  it('3.0 passes AA large', () => expect(meetsAALarge(3.0)).toBe(true))
  it('2.99 fails AA large', () => expect(meetsAALarge(2.99)).toBe(false))
})

// ── Design-token contract (must match src/index.css after P074 fix) ────────────
//
//  Dark theme tokens
//    --bg:        #1a1a1a
//    --card-bg:   #383838
//    --text:      #f4f4f3
//    --text-muted rgba(244,244,243, 0.65) on --bg
//    --text-muted rgba(244,244,243, 0.65) on --card-bg
//    --primary:   #1cabb0 on --bg
//    --primary:   #1cabb0 on --card-bg
//
//  Light theme tokens
//    --bg:        #f5f5f4
//    --card-bg:   #ffffff
//    --text:      #1a1a1a
//    --text-muted rgba(26,26,26, 0.65) on --bg
//    --text-muted rgba(26,26,26, 0.65) on --card-bg
//    --primary-text: #0f7578 on --bg
//    --primary-text: #0f7578 on --card-bg

describe('Design token AA compliance (P074)', () => {
  // ── Dark theme ──────────────────────────────────────────────────────────────
  const DARK_BG = '#1a1a1a'
  const DARK_CARD = '#383838'
  const DARK_TEXT = '#f4f4f3'

  it('dark: --text on --bg ≥ 4.5:1', () => {
    const ratio = hexContrast(DARK_TEXT, DARK_BG)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('dark: --text on --card-bg ≥ 4.5:1', () => {
    const ratio = hexContrast(DARK_TEXT, DARK_CARD)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('dark: --text-muted (0.65) on --bg ≥ 4.5:1', () => {
    const ratio = alphaHexContrast(DARK_TEXT, 0.65, DARK_BG)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('dark: --text-muted (0.65) on --card-bg ≥ 4.5:1', () => {
    const ratio = alphaHexContrast(DARK_TEXT, 0.65, DARK_CARD)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('dark: --primary (#1cabb0) on --bg ≥ 3.0:1 (large/UI text)', () => {
    // Primary is used for interactive elements and headings — AA large applies
    const ratio = hexContrast('#1cabb0', DARK_BG)
    expect(ratio).toBeGreaterThanOrEqual(3.0)
  })

  it('dark: --primary (#1cabb0) on --card-bg ≥ 3.0:1 (large/UI text)', () => {
    const ratio = hexContrast('#1cabb0', DARK_CARD)
    expect(ratio).toBeGreaterThanOrEqual(3.0)
  })

  // ── Light theme ─────────────────────────────────────────────────────────────
  const LIGHT_BG = '#f5f5f4'
  const LIGHT_CARD = '#ffffff'
  const LIGHT_TEXT = '#1a1a1a'
  const LIGHT_PRIMARY_TEXT = '#0f7578'

  it('light: --text on --bg ≥ 4.5:1', () => {
    const ratio = hexContrast(LIGHT_TEXT, LIGHT_BG)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('light: --text on --card-bg ≥ 4.5:1', () => {
    const ratio = hexContrast(LIGHT_TEXT, LIGHT_CARD)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('light: --text-muted (0.65) on --bg ≥ 4.5:1', () => {
    const ratio = alphaHexContrast(LIGHT_TEXT, 0.65, LIGHT_BG)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('light: --text-muted (0.65) on --card-bg ≥ 4.5:1', () => {
    const ratio = alphaHexContrast(LIGHT_TEXT, 0.65, LIGHT_CARD)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('light: --primary-text (#0f7578) on --bg ≥ 4.5:1', () => {
    const ratio = hexContrast(LIGHT_PRIMARY_TEXT, LIGHT_BG)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('light: --primary-text (#0f7578) on --card-bg ≥ 4.5:1', () => {
    const ratio = hexContrast(LIGHT_PRIMARY_TEXT, LIGHT_CARD)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })
})
