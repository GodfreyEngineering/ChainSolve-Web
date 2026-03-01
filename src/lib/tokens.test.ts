import { describe, it, expect } from 'vitest'
import { Z, FONT_WEIGHT } from './tokens'

describe('tokens', () => {
  it('Z-index layers are ordered correctly', () => {
    expect(Z.dropdown).toBeLessThan(Z.modal)
    expect(Z.modal).toBeLessThan(Z.toast)
    expect(Z.toast).toBeLessThan(Z.dock)
  })

  it('font weights are standard CSS values', () => {
    expect(FONT_WEIGHT.regular).toBe(400)
    expect(FONT_WEIGHT.medium).toBe(500)
    expect(FONT_WEIGHT.semibold).toBe(600)
    expect(FONT_WEIGHT.bold).toBe(700)
  })
})
