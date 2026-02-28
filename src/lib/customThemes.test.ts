/**
 * customThemes.test.ts — Tests for custom theme types, validation, and CRUD (D8-2).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  validateThemeName,
  validateThemeVariables,
  loadCustomThemes,
  saveCustomThemes,
  getActiveThemeId,
  setActiveThemeId,
  generateThemeId,
  THEME_VARIABLE_META,
  THEME_CATEGORY_LABELS,
  DARK_DEFAULTS,
  LIGHT_DEFAULTS,
  BUILT_IN_PRESETS,
  type CustomTheme,
} from './customThemes'

beforeEach(() => {
  localStorage.clear()
})

// ── validateThemeName ────────────────────────────────────────────────────────

describe('validateThemeName', () => {
  it('accepts a normal name', () => {
    expect(validateThemeName('Midnight Blue')).toEqual({ ok: true })
  })

  it('rejects empty name', () => {
    const r = validateThemeName('')
    expect(r.ok).toBe(false)
    expect(r.error).toBeDefined()
  })

  it('rejects whitespace-only name', () => {
    expect(validateThemeName('   ').ok).toBe(false)
  })

  it('rejects name longer than 64 chars', () => {
    expect(validateThemeName('a'.repeat(65)).ok).toBe(false)
  })

  it('accepts exactly 64 chars', () => {
    expect(validateThemeName('a'.repeat(64)).ok).toBe(true)
  })
})

// ── validateThemeVariables ───────────────────────────────────────────────────

describe('validateThemeVariables', () => {
  it('accepts valid CSS variable overrides', () => {
    expect(validateThemeVariables({ '--primary': '#ff0000' })).toEqual({ ok: true })
  })

  it('rejects empty object (no CSS vars)', () => {
    expect(validateThemeVariables({}).ok).toBe(false)
  })

  it('rejects object with no valid CSS vars', () => {
    // Keys that don't start with '--' are stripped by sanitize
    expect(validateThemeVariables({ color: 'red' }).ok).toBe(false)
  })

  it('rejects injection attempts', () => {
    expect(validateThemeVariables({ '--x': '<script>alert(1)</script>' }).ok).toBe(false)
  })
})

// ── localStorage CRUD ────────────────────────────────────────────────────────

describe('loadCustomThemes / saveCustomThemes', () => {
  it('returns empty array when nothing saved', () => {
    expect(loadCustomThemes()).toEqual([])
  })

  it('round-trips themes through localStorage', () => {
    const themes: CustomTheme[] = [
      {
        id: 'ct_1',
        name: 'Test',
        baseMode: 'dark',
        variables: { '--primary': '#ff0000' },
        createdAt: 1000,
        updatedAt: 1000,
      },
    ]
    saveCustomThemes(themes)
    const loaded = loadCustomThemes()
    expect(loaded).toEqual(themes)
  })

  it('returns empty array on corrupt JSON', () => {
    localStorage.setItem('cs:custom-themes', '{{broken')
    expect(loadCustomThemes()).toEqual([])
  })
})

describe('getActiveThemeId / setActiveThemeId', () => {
  it('returns null when no active theme', () => {
    expect(getActiveThemeId()).toBeNull()
  })

  it('persists active theme id', () => {
    setActiveThemeId('ct_123')
    expect(getActiveThemeId()).toBe('ct_123')
  })

  it('clears active theme id', () => {
    setActiveThemeId('ct_123')
    setActiveThemeId(null)
    expect(getActiveThemeId()).toBeNull()
  })
})

// ── generateThemeId ──────────────────────────────────────────────────────────

describe('generateThemeId', () => {
  it('starts with ct_ prefix', () => {
    expect(generateThemeId()).toMatch(/^ct_/)
  })

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateThemeId()))
    expect(ids.size).toBe(10)
  })
})

// ── Constants / metadata ─────────────────────────────────────────────────────

describe('THEME_VARIABLE_META', () => {
  it('has entries for all categories', () => {
    const cats = new Set(THEME_VARIABLE_META.map((m) => m.category))
    expect(cats).toEqual(new Set(Object.keys(THEME_CATEGORY_LABELS)))
  })

  it('all cssVar keys start with --', () => {
    for (const m of THEME_VARIABLE_META) {
      expect(m.cssVar).toMatch(/^--/)
    }
  })
})

describe('DARK_DEFAULTS / LIGHT_DEFAULTS', () => {
  it('dark defaults cover all meta variables', () => {
    for (const m of THEME_VARIABLE_META) {
      expect(DARK_DEFAULTS).toHaveProperty(m.cssVar)
    }
  })

  it('light defaults cover all meta variables', () => {
    for (const m of THEME_VARIABLE_META) {
      expect(LIGHT_DEFAULTS).toHaveProperty(m.cssVar)
    }
  })
})

describe('BUILT_IN_PRESETS', () => {
  it('has at least 3 presets', () => {
    expect(BUILT_IN_PRESETS.length).toBeGreaterThanOrEqual(3)
  })

  it('each preset has a name and baseMode', () => {
    for (const p of BUILT_IN_PRESETS) {
      expect(p.name.length).toBeGreaterThan(0)
      expect(['dark', 'light']).toContain(p.baseMode)
    }
  })

  it('each preset has at least one variable override', () => {
    for (const p of BUILT_IN_PRESETS) {
      expect(Object.keys(p.variables).length).toBeGreaterThan(0)
    }
  })
})
