/**
 * TermsPage.test.ts — Structural tests for the Terms page (G0-1).
 *
 * Verifies the TermsPage module exports a valid default component
 * and that i18n keys exist in all locales.
 */

import { describe, it, expect } from 'vitest'
import { CURRENT_TERMS_VERSION } from '../lib/termsVersion'

describe('TermsPage', () => {
  it('exports a default function component', async () => {
    const mod = await import('./TermsPage')
    expect(typeof mod.default).toBe('function')
    expect(mod.default.name).toBe('TermsPage')
  })
})

describe('terms i18n keys', () => {
  const REQUIRED_KEYS = ['title', 'version', 'effectiveDate', 'backToSignIn']
  const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'he']

  for (const locale of LOCALES) {
    it(`${locale}.json has all required terms keys`, async () => {
      const mod = await import(`../i18n/locales/${locale}.json`)
      const terms = mod.default?.terms ?? mod.terms
      expect(terms).toBeDefined()
      for (const key of REQUIRED_KEYS) {
        expect(terms[key], `missing terms.${key} in ${locale}.json`).toBeTruthy()
      }
    })
  }

  it('version key contains {{version}} interpolation placeholder', async () => {
    const en = await import('../i18n/locales/en.json')
    const terms = en.default?.terms ?? en.terms
    expect(terms.version).toContain('{{version}}')
  })

  it('effectiveDate key contains {{date}} interpolation placeholder', async () => {
    const en = await import('../i18n/locales/en.json')
    const terms = en.default?.terms ?? en.terms
    expect(terms.effectiveDate).toContain('{{date}}')
  })
})

describe('CURRENT_TERMS_VERSION consistency', () => {
  it('matches format expected by TermsPage', () => {
    expect(CURRENT_TERMS_VERSION).toMatch(/^\d+\.\d+$/)
  })
})
