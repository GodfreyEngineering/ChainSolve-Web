/**
 * marketplaceThemeService.test.ts — P117 theme service tests.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  sanitizeThemeVariables,
  getInstalledMarketplaceTheme,
  installMarketplaceTheme,
  uninstallMarketplaceTheme,
  applyPersistedMarketplaceTheme,
} from './marketplaceThemeService'

beforeEach(() => {
  localStorage.clear()
  // Reset any inline styles applied to <html>
  document.documentElement.removeAttribute('style')
})

// ── sanitizeThemeVariables ────────────────────────────────────────────────────

describe('sanitizeThemeVariables', () => {
  it('accepts valid CSS custom properties', () => {
    const result = sanitizeThemeVariables({ '--primary': '#ff6b6b', '--bg': '#0a0a0a' })
    expect(result).toEqual({ '--primary': '#ff6b6b', '--bg': '#0a0a0a' })
  })

  it('rejects keys that do not start with --', () => {
    const result = sanitizeThemeVariables({ color: 'red', '--valid': 'blue' })
    expect(result).toEqual({ '--valid': 'blue' })
  })

  it('rejects non-string values', () => {
    const result = sanitizeThemeVariables({ '--primary': 123 as unknown as string })
    expect(result).toEqual({})
  })

  it('rejects values containing <', () => {
    const result = sanitizeThemeVariables({ '--primary': '<script>alert(1)</script>' })
    expect(result).toEqual({})
  })

  it('rejects values containing javascript:', () => {
    const result = sanitizeThemeVariables({ '--primary': 'javascript:alert(1)' })
    expect(result).toEqual({})
  })
})

// ── installMarketplaceTheme ───────────────────────────────────────────────────

describe('installMarketplaceTheme', () => {
  it('persists theme to localStorage', () => {
    installMarketplaceTheme('item-1', 'Ocean', { '--primary': '#0077b6' })
    const stored = getInstalledMarketplaceTheme()
    expect(stored).toMatchObject({ itemId: 'item-1', name: 'Ocean' })
    expect(stored?.variables['--primary']).toBe('#0077b6')
  })

  it('applies CSS variable to document root', () => {
    installMarketplaceTheme('item-1', 'Ocean', { '--primary': '#0077b6' })
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#0077b6')
  })

  it('replaces previous theme variables when installing a new one', () => {
    installMarketplaceTheme('item-1', 'A', { '--primary': '#aaa' })
    installMarketplaceTheme('item-2', 'B', { '--primary': '#bbb' })
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#bbb')
    expect(getInstalledMarketplaceTheme()?.itemId).toBe('item-2')
  })
})

// ── uninstallMarketplaceTheme ─────────────────────────────────────────────────

describe('uninstallMarketplaceTheme', () => {
  it('removes theme from localStorage', () => {
    installMarketplaceTheme('item-1', 'Ocean', { '--primary': '#0077b6' })
    uninstallMarketplaceTheme()
    expect(getInstalledMarketplaceTheme()).toBeNull()
  })

  it('removes CSS variable from document root', () => {
    installMarketplaceTheme('item-1', 'Ocean', { '--primary': '#0077b6' })
    uninstallMarketplaceTheme()
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('')
  })

  it('is a no-op when no theme installed', () => {
    expect(() => uninstallMarketplaceTheme()).not.toThrow()
  })
})

// ── applyPersistedMarketplaceTheme ────────────────────────────────────────────

describe('applyPersistedMarketplaceTheme', () => {
  it('re-applies stored variables on call', () => {
    localStorage.setItem(
      'chainsolve.marketplace_theme',
      JSON.stringify({ itemId: 'i', name: 'N', variables: { '--bg': '#111' } }),
    )
    applyPersistedMarketplaceTheme()
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#111')
  })

  it('is a no-op when no theme stored', () => {
    expect(() => applyPersistedMarketplaceTheme()).not.toThrow()
  })
})
