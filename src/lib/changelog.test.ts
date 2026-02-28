import { describe, it, expect } from 'vitest'
import { CHANGELOG_ENTRIES, latestEntry, type ChangelogEntry } from './changelog'

describe('CHANGELOG_ENTRIES structure', () => {
  it('is a non-empty array', () => {
    expect(CHANGELOG_ENTRIES.length).toBeGreaterThan(0)
  })

  it('every entry has a non-empty version string', () => {
    for (const e of CHANGELOG_ENTRIES) {
      expect(typeof e.version).toBe('string')
      expect(e.version.length).toBeGreaterThan(0)
    }
  })

  it('every entry has a valid ISO date (YYYY-MM-DD)', () => {
    for (const e of CHANGELOG_ENTRIES) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const d = new Date(e.date)
      expect(isNaN(d.getTime())).toBe(false)
    }
  })

  it('every entry has a non-empty title and summary', () => {
    for (const e of CHANGELOG_ENTRIES) {
      expect(e.title.length).toBeGreaterThan(0)
      expect(e.summary.length).toBeGreaterThan(0)
    }
  })

  it('every entry has at least one item', () => {
    for (const e of CHANGELOG_ENTRIES) {
      expect(Array.isArray(e.items)).toBe(true)
      expect(e.items.length).toBeGreaterThan(0)
      for (const item of e.items) {
        expect(item.length).toBeGreaterThan(0)
      }
    }
  })

  it('all version strings are unique', () => {
    const versions = CHANGELOG_ENTRIES.map((e) => e.version)
    expect(new Set(versions).size).toBe(versions.length)
  })

  it('entries are ordered newest-first (dates descending)', () => {
    for (let i = 0; i < CHANGELOG_ENTRIES.length - 1; i++) {
      const a = new Date(CHANGELOG_ENTRIES[i].date).getTime()
      const b = new Date(CHANGELOG_ENTRIES[i + 1].date).getTime()
      expect(a).toBeGreaterThanOrEqual(b)
    }
  })
})

describe('latestEntry', () => {
  it('returns the first entry', () => {
    const latest = latestEntry() as ChangelogEntry
    expect(latest).toBe(CHANGELOG_ENTRIES[0])
  })

  it('has the most recent date', () => {
    const latest = latestEntry() as ChangelogEntry
    const latestMs = new Date(latest.date).getTime()
    for (const e of CHANGELOG_ENTRIES) {
      expect(latestMs).toBeGreaterThanOrEqual(new Date(e.date).getTime())
    }
  })
})
