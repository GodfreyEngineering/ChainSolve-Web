import { describe, it, expect } from 'vitest'
import { pageTitle, SITE_ORIGIN } from './seo'

describe('pageTitle', () => {
  it('formats page title with brand suffix', () => {
    expect(pageTitle('Docs')).toBe('Docs — ChainSolve')
  })

  it('handles empty page name', () => {
    expect(pageTitle('')).toBe(' — ChainSolve')
  })
})

describe('SITE_ORIGIN', () => {
  it('is a valid HTTPS URL', () => {
    expect(SITE_ORIGIN).toMatch(/^https:\/\//)
  })

  it('does not have a trailing slash', () => {
    expect(SITE_ORIGIN.endsWith('/')).toBe(false)
  })
})

describe('useHreflang contract', () => {
  // useHreflang is a React hook so we cannot call it directly in unit tests.
  // These tests verify the module exports and constants that drive hreflang behaviour.

  it('exports useHreflang', async () => {
    const mod = await import('./seo')
    expect(typeof mod.useHreflang).toBe('function')
  })

  it('exports usePageMeta', async () => {
    const mod = await import('./seo')
    expect(typeof mod.usePageMeta).toBe('function')
  })

  it('SITE_ORIGIN matches expected production domain', () => {
    expect(SITE_ORIGIN).toBe('https://app.chainsolve.co.uk')
  })
})
