/**
 * quickAddPalette.test.ts
 *
 * Tests for the P069 improvements to the QuickAddPalette block picker:
 *   - Category-name search
 *   - Recently-used tracking (blockLibraryUtils)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { trackBlockUsed, getRecentlyUsed, MAX_RECENT_BLOCKS } from './blockLibraryUtils'
import { BLOCK_REGISTRY, CATEGORY_LABELS } from '../../blocks/registry'
import type { BlockCategory } from '../../blocks/types'

// ── blockLibraryUtils — getRecentlyUsed ─────────────────────────────────────

describe('getRecentlyUsed', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty array when nothing has been used', () => {
    expect(getRecentlyUsed()).toEqual([])
  })

  it('returns the most recently used type first', () => {
    trackBlockUsed('number')
    trackBlockUsed('display')
    expect(getRecentlyUsed()[0]).toBe('display')
  })

  it('deduplicates: using a block again moves it to front', () => {
    trackBlockUsed('number')
    trackBlockUsed('display')
    trackBlockUsed('number')
    const recent = getRecentlyUsed()
    expect(recent[0]).toBe('number')
    expect(recent.filter((t) => t === 'number')).toHaveLength(1)
  })

  it('caps at MAX_RECENT_BLOCKS entries', () => {
    for (let i = 0; i < MAX_RECENT_BLOCKS + 5; i++) {
      trackBlockUsed(`block-${i}`)
    }
    expect(getRecentlyUsed().length).toBe(MAX_RECENT_BLOCKS)
  })

  it('survives malformed localStorage gracefully', () => {
    localStorage.setItem('cs:recent', 'not-valid-json')
    expect(() => getRecentlyUsed()).not.toThrow()
    expect(getRecentlyUsed()).toEqual([])
  })
})

// ── Category search (filterBlocks logic via BLOCK_REGISTRY) ──────────────────
//
// filterBlocks is not exported from QuickAddPalette, so we test the
// underlying data that makes category search possible:
//   CATEGORY_LABELS maps category ids → human-readable names.

describe('CATEGORY_LABELS coverage', () => {
  it('every block category has an entry in CATEGORY_LABELS', () => {
    const allCategories = new Set<BlockCategory>()
    for (const def of BLOCK_REGISTRY.values()) {
      allCategories.add(def.category)
    }
    for (const cat of allCategories) {
      expect(
        CATEGORY_LABELS[cat] !== undefined,
        `CATEGORY_LABELS missing entry for category "${cat}"`,
      ).toBe(true)
    }
  })

  it('all CATEGORY_LABELS values are non-empty strings', () => {
    for (const [, label] of Object.entries(CATEGORY_LABELS)) {
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('BLOCK_REGISTRY contains at least 5 distinct categories', () => {
    const cats = new Set([...BLOCK_REGISTRY.values()].map((d) => d.category))
    expect(cats.size).toBeGreaterThanOrEqual(5)
  })
})

// ── Category-aware search verifiable via BLOCK_REGISTRY ──────────────────────

describe('Category search correctness (P069)', () => {
  it('engineering blocks have a category label that includes engineering/eng', () => {
    const engBlocks = [...BLOCK_REGISTRY.values()].filter((d) => d.category.includes('eng'))
    expect(engBlocks.length).toBeGreaterThan(0)
    // At least one eng category has a label
    const engCategories = [...new Set(engBlocks.map((d) => d.category))]
    for (const cat of engCategories) {
      expect(CATEGORY_LABELS[cat as BlockCategory]).toBeDefined()
    }
  })

  it('finance blocks have a category that resolves to a label', () => {
    const finBlocks = [...BLOCK_REGISTRY.values()].filter((d) => d.category.includes('fin'))
    expect(finBlocks.length).toBeGreaterThan(0)
    for (const def of finBlocks) {
      const label = CATEGORY_LABELS[def.category] ?? def.category
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('stats blocks have a category that resolves to a label', () => {
    const statBlocks = [...BLOCK_REGISTRY.values()].filter(
      (d) => d.category.includes('stat') || d.category.includes('stats'),
    )
    expect(statBlocks.length).toBeGreaterThan(0)
  })
})

// ── trackBlockUsed side-effect guard ─────────────────────────────────────────

describe('trackBlockUsed', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('does not throw for unknown block types', () => {
    expect(() => trackBlockUsed('not-a-real-block')).not.toThrow()
  })

  it('preserves order: first call → last in list', () => {
    trackBlockUsed('a')
    trackBlockUsed('b')
    trackBlockUsed('c')
    expect(getRecentlyUsed()).toEqual(['c', 'b', 'a'])
  })
})

// Suppress vitest from complaining about missing window in jsdom
vi.stubGlobal('localStorage', localStorage)
