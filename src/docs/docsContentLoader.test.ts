/**
 * docsContentLoader.test.ts — Tests for locale-aware docs content (L2-2).
 */

import { describe, it, expect } from 'vitest'
import { getDocsContent, getDocsContentSync, prefetchDocsContent } from './docsContentLoader'
import { DOCS_CONTENT } from './docsPageContent'

describe('getDocsContentSync', () => {
  it('returns English content for "en"', () => {
    expect(getDocsContentSync('en')).toBe(DOCS_CONTENT)
  })

  it('falls back to English for an untranslated locale', () => {
    expect(getDocsContentSync('de')).toBe(DOCS_CONTENT)
  })

  it('falls back to English for an unknown locale', () => {
    expect(getDocsContentSync('zz')).toBe(DOCS_CONTENT)
  })

  it('returned content has expected sections', () => {
    const content = getDocsContentSync('en')
    expect(content.onboarding).toBeDefined()
    expect(content.blockLibrary).toBeDefined()
    expect(content.blockMath).toBeDefined()
    expect(content.blockEng).toBeDefined()
    expect(content.blockFin).toBeDefined()
    expect(content.blockStats).toBeDefined()
    expect(content.units).toBeDefined()
    expect(content.variables).toBeDefined()
    expect(content.exports).toBeDefined()
    expect(content.trouble).toBeDefined()
  })
})

describe('getDocsContent', () => {
  it('returns English content synchronously for "en"', () => {
    const result = getDocsContent('en')
    // English is synchronous — not a Promise
    expect(result).toBe(DOCS_CONTENT)
  })

  it('returns English fallback synchronously for untranslated locale', () => {
    const result = getDocsContent('de')
    // No loader registered → synchronous English fallback
    expect(result).toBe(DOCS_CONTENT)
  })
})

describe('prefetchDocsContent', () => {
  it('resolves without error for English', async () => {
    await expect(prefetchDocsContent('en')).resolves.toBeUndefined()
  })

  it('resolves without error for untranslated locale', async () => {
    await expect(prefetchDocsContent('fr')).resolves.toBeUndefined()
  })
})
