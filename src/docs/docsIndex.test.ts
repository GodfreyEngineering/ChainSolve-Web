import { describe, it, expect } from 'vitest'
import { DOCS_INDEX, searchDocs, type DocsEntry } from './docsIndex'

// ── Index structural invariants ───────────────────────────────────────────────

describe('DOCS_INDEX structure', () => {
  it('is a non-empty array', () => {
    expect(DOCS_INDEX.length).toBeGreaterThan(0)
  })

  it('every entry has a non-empty id', () => {
    for (const entry of DOCS_INDEX) {
      expect(typeof entry.id).toBe('string')
      expect(entry.id.length).toBeGreaterThan(0)
    }
  })

  it('every entry has a non-empty title', () => {
    for (const entry of DOCS_INDEX) {
      expect(typeof entry.title).toBe('string')
      expect(entry.title.length).toBeGreaterThan(0)
    }
  })

  it('every entry has a non-empty description', () => {
    for (const entry of DOCS_INDEX) {
      expect(typeof entry.description).toBe('string')
      expect(entry.description.length).toBeGreaterThan(0)
    }
  })

  it('every entry has a non-empty section', () => {
    for (const entry of DOCS_INDEX) {
      expect(typeof entry.section).toBe('string')
      expect(entry.section.length).toBeGreaterThan(0)
    }
  })

  it('every entry has a keywords array with at least one keyword', () => {
    for (const entry of DOCS_INDEX) {
      expect(Array.isArray(entry.keywords)).toBe(true)
      expect(entry.keywords.length).toBeGreaterThan(0)
      for (const k of entry.keywords) {
        expect(typeof k).toBe('string')
        expect(k.length).toBeGreaterThan(0)
      }
    }
  })

  it('all entry ids are unique', () => {
    const ids = DOCS_INDEX.map((e) => e.id)
    const set = new Set(ids)
    expect(set.size).toBe(ids.length)
  })

  it('contains entries from at least 5 distinct sections', () => {
    const sections = new Set(DOCS_INDEX.map((e) => e.section))
    expect(sections.size).toBeGreaterThanOrEqual(5)
  })

  it('contains entries from expected sections', () => {
    const sections = new Set(DOCS_INDEX.map((e) => e.section))
    expect(sections.has('Quick guides')).toBe(true)
    expect(sections.has('Getting started')).toBe(true)
    expect(sections.has('Blocks')).toBe(true)
    expect(sections.has('Canvas')).toBe(true)
    expect(sections.has('Export')).toBe(true)
  })

  it('quick guides section has exactly 4 entries', () => {
    const guides = DOCS_INDEX.filter((e) => e.section === 'Quick guides')
    expect(guides.length).toBe(4)
    const ids = guides.map((e) => e.id)
    expect(ids).toContain('qg-ten-nodes')
    expect(ids).toContain('qg-variables')
    expect(ids).toContain('qg-exports')
    expect(ids).toContain('qg-explore')
  })
})

// ── searchDocs ────────────────────────────────────────────────────────────────

describe('searchDocs', () => {
  it('returns empty array for empty query', () => {
    expect(searchDocs('')).toEqual([])
  })

  it('returns empty array for whitespace-only query', () => {
    expect(searchDocs('   ')).toEqual([])
  })

  it('matches by title (case-insensitive)', () => {
    const results = searchDocs('UNDO')
    expect(results.length).toBeGreaterThan(0)
    const ids = results.map((r: DocsEntry) => r.id)
    expect(ids).toContain('canvas-undo')
  })

  it('matches by keyword', () => {
    const results = searchDocs('slider')
    expect(results.length).toBeGreaterThan(0)
    const ids = results.map((r: DocsEntry) => r.id)
    expect(ids).toContain('var-slider')
  })

  it('matches by description', () => {
    const results = searchDocs('chainsolvejson')
    expect(results.length).toBeGreaterThan(0)
    const ids = results.map((r: DocsEntry) => r.id)
    expect(ids).toContain('export-json')
  })

  it('matches by section name', () => {
    const results = searchDocs('billing')
    expect(results.length).toBeGreaterThan(0)
    // 'billing' matches the section "Billing & plans" and keywords
    for (const r of results) {
      const matchesSection = r.section.toLowerCase().includes('billing')
      const matchesKeyword = r.keywords.some((k) => k.toLowerCase().includes('billing'))
      const matchesTitle = r.title.toLowerCase().includes('billing')
      const matchesDesc = r.description.toLowerCase().includes('billing')
      expect(matchesSection || matchesKeyword || matchesTitle || matchesDesc).toBe(true)
    }
  })

  it('returns multiple results for a broad query', () => {
    const results = searchDocs('export')
    expect(results.length).toBeGreaterThanOrEqual(3)
  })

  it('returns no results for a nonsense query', () => {
    expect(searchDocs('zzz_not_a_real_topic_xyzzy')).toEqual([])
  })

  it('is case-insensitive', () => {
    const lower = searchDocs('csv')
    const upper = searchDocs('CSV')
    expect(lower.length).toBe(upper.length)
    expect(lower.map((r: DocsEntry) => r.id)).toEqual(upper.map((r: DocsEntry) => r.id))
  })

  it('matches "shortcut" entries', () => {
    const results = searchDocs('shortcut')
    expect(results.length).toBeGreaterThan(0)
  })

  it('matches "plot" for plot blocks entry', () => {
    const results = searchDocs('plot')
    const ids = results.map((r: DocsEntry) => r.id)
    expect(ids).toContain('block-plot')
  })

  it('matches "template" for templates entry', () => {
    const results = searchDocs('template')
    const ids = results.map((r: DocsEntry) => r.id)
    expect(ids).toContain('gs-templates')
  })

  it('matches "10 nodes" quick guide', () => {
    const results = searchDocs('10 nodes')
    const ids = results.map((r: DocsEntry) => r.id)
    expect(ids).toContain('qg-ten-nodes')
  })

  it('matches "explore" quick guide and marketplace entry', () => {
    const results = searchDocs('explore')
    const ids = results.map((r: DocsEntry) => r.id)
    expect(ids).toContain('qg-explore')
  })

  it('matches quick guides by section name', () => {
    const results = searchDocs('quick guide')
    expect(results.length).toBe(4)
    for (const r of results) {
      expect(r.section).toBe('Quick guides')
    }
  })
})
