/**
 * blockLibraryUtils.test.ts
 *
 * Tests for P068: Favourites + recently-used helpers exported from
 * blockLibraryUtils (getFavourites, toggleFavourite).
 * E5-5: Tests for ranked block search scoring (scoreMatch).
 * The recently-used half (getRecentlyUsed / trackBlockUsed) is
 * tested in quickAddPalette.test.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { getFavourites, toggleFavourite, scoreMatch } from './blockLibraryUtils'
import type { BlockDef } from '../../blocks/types'

describe('getFavourites', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty Set when nothing is stored', () => {
    expect(getFavourites().size).toBe(0)
  })

  it('returns a Set containing stored favourites', () => {
    localStorage.setItem('cs:favs', JSON.stringify(['number', 'display']))
    const favs = getFavourites()
    expect(favs.has('number')).toBe(true)
    expect(favs.has('display')).toBe(true)
    expect(favs.size).toBe(2)
  })

  it('survives malformed localStorage gracefully', () => {
    localStorage.setItem('cs:favs', 'not-valid-json')
    expect(() => getFavourites()).not.toThrow()
    expect(getFavourites().size).toBe(0)
  })
})

describe('toggleFavourite', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('adds a block to favourites when it is not already there', () => {
    const result = toggleFavourite('number')
    expect(result.has('number')).toBe(true)
  })

  it('removes a block from favourites when it is already there', () => {
    toggleFavourite('number')
    const result = toggleFavourite('number')
    expect(result.has('number')).toBe(false)
  })

  it('persists the new state to localStorage', () => {
    toggleFavourite('display')
    // Fresh call should see the persisted value
    expect(getFavourites().has('display')).toBe(true)
  })

  it('returns the updated set without stale entries', () => {
    toggleFavourite('number')
    toggleFavourite('display')
    toggleFavourite('number') // remove number
    const favs = getFavourites()
    expect(favs.has('number')).toBe(false)
    expect(favs.has('display')).toBe(true)
  })

  it('allows multiple distinct blocks to be favourited', () => {
    toggleFavourite('a')
    toggleFavourite('b')
    toggleFavourite('c')
    const favs = getFavourites()
    expect(favs.size).toBe(3)
  })
})

// ── E5-5: scoreMatch tests ──────────────────────────────────────────────────

/** Minimal block helper for testing. */
function block(overrides: Partial<BlockDef> & { type: string; label: string }): BlockDef {
  return {
    category: 'math',
    nodeKind: 'csOperation',
    inputs: [],
    defaultData: { blockType: overrides.type, label: overrides.label },
    ...overrides,
  }
}

describe('scoreMatch', () => {
  it('returns null for no match', () => {
    const b = block({ type: 'add', label: 'Add' })
    expect(scoreMatch(b, 'zzz')).toBeNull()
  })

  it('exact label match scores 1', () => {
    const b = block({ type: 'add', label: 'Add' })
    expect(scoreMatch(b, 'add')).toBe(1)
  })

  it('exact type match scores 2', () => {
    const b = block({ type: 'eng.mechanics.force_ma', label: 'F = ma' })
    expect(scoreMatch(b, 'eng.mechanics.force_ma')).toBe(2)
  })

  it('label prefix scores 5', () => {
    const b = block({ type: 'subtract', label: 'Subtract' })
    expect(scoreMatch(b, 'sub')).toBe(5)
  })

  it('label substring scores 10', () => {
    const b = block({ type: 'subtract', label: 'Subtract' })
    expect(scoreMatch(b, 'tract')).toBe(10)
  })

  it('synonym match scores 15', () => {
    const b = block({
      type: 'eng.mechanics.force_ma',
      label: 'F = ma',
      synonyms: ['force', 'newton', 'acceleration'],
    })
    expect(scoreMatch(b, 'newton')).toBe(15)
  })

  it('tag match scores 20', () => {
    const b = block({
      type: 'eng.mechanics.force_ma',
      label: 'F = ma',
      tags: ['mechanics', 'dynamics'],
    })
    expect(scoreMatch(b, 'dynamics')).toBe(20)
  })

  it('type substring match scores 12', () => {
    const b = block({ type: 'eng.mechanics.force_ma', label: 'F = ma' })
    // "mechanics" appears in type → score 12
    expect(scoreMatch(b, 'mechanics')).toBe(12)
  })

  it('input port label match scores 25', () => {
    const b = block({
      type: 'eng.fluids.reynolds',
      label: 'Reynolds',
      inputs: [
        { id: 'rho', label: 'ρ (kg/m³)' },
        { id: 'v', label: 'v (m/s)' },
      ],
    })
    expect(scoreMatch(b, 'kg/m')).toBe(25)
  })

  it('best tier wins when multiple match', () => {
    const b = block({
      type: 'add',
      label: 'Add',
      synonyms: ['plus', 'sum'],
      tags: ['arithmetic'],
    })
    // "add" matches exact label (1), type contains (12), type keyword (25)
    expect(scoreMatch(b, 'add')).toBe(1)
  })

  it('synonym beats tag when both match', () => {
    const b = block({
      type: 'foo',
      label: 'Foo',
      synonyms: ['bar thing'],
      tags: ['bar domain'],
    })
    // "bar" matches synonym (15) and tag (20); best is 15
    expect(scoreMatch(b, 'bar')).toBe(15)
  })

  it('case insensitive matching', () => {
    const b = block({ type: 'add', label: 'Add' })
    expect(scoreMatch(b, 'ADD')).toBe(1)
  })
})

describe('scoreMatch: search quality regressions', () => {
  it('"average" finds mean via synonym', () => {
    const b = block({
      type: 'stats.desc.mean',
      label: 'Mean',
      synonyms: ['average', 'arithmetic mean', 'avg'],
      tags: ['statistics', 'descriptive'],
    })
    expect(scoreMatch(b, 'average')).toBe(15)
  })

  it('"voltage" finds Ohm\'s law via synonym', () => {
    const b = block({
      type: 'eng.electrical.ohms_law_v',
      label: 'V = IR',
      synonyms: ['ohm', 'voltage', 'V=IR'],
      tags: ['electrical', 'circuits'],
    })
    expect(scoreMatch(b, 'voltage')).toBe(15)
  })

  it('"regression" finds linreg_slope via label substring', () => {
    const b = block({
      type: 'stats.rel.linreg_slope',
      label: 'Linear Regression Slope',
      synonyms: ['slope', 'regression', 'trend', 'line fit'],
      tags: ['statistics', 'regression'],
    })
    // "regression" matches label substring (10)
    expect(scoreMatch(b, 'regression')).toBe(10)
  })

  it('"circuit" finds via tag', () => {
    const b = block({
      type: 'eng.electrical.ohms_law_v',
      label: 'V = IR',
      synonyms: ['ohm', 'voltage'],
      tags: ['electrical', 'circuits'],
    })
    expect(scoreMatch(b, 'circuit')).toBe(20)
  })
})
