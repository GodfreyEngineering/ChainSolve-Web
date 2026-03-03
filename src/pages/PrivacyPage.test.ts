/**
 * PrivacyPage.test.ts — Structural tests for the Privacy page (L1-2).
 *
 * Verifies the PrivacyPage module exports a valid default component
 * and that i18n keys exist in all locales.
 */

import { describe, it, expect } from 'vitest'

describe('PrivacyPage', () => {
  it('exports a default function component', async () => {
    const mod = await import('./PrivacyPage')
    expect(typeof mod.default).toBe('function')
    expect(mod.default.name).toBe('PrivacyPage')
  })
})

describe('privacy i18n keys', () => {
  const REQUIRED_KEYS = [
    'title',
    'viewTerms',
    's1Title',
    's2Title',
    's3Title',
    's4Title',
    's5Title',
    's6Title',
    's7Title',
    's8Title',
    's9Title',
    's10Title',
  ]
  const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'he']

  for (const locale of LOCALES) {
    it(`${locale}.json has all required privacy keys`, async () => {
      const mod = await import(`../i18n/locales/${locale}.json`)
      const privacy = mod.default?.privacy ?? mod.privacy
      expect(privacy).toBeDefined()
      for (const key of REQUIRED_KEYS) {
        expect(privacy[key], `missing privacy.${key} in ${locale}.json`).toBeTruthy()
      }
    })
  }
})

describe('footer i18n keys', () => {
  const REQUIRED_KEYS = ['registered', 'companyNo', 'termsLink', 'privacyLink']
  const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'he']

  for (const locale of LOCALES) {
    it(`${locale}.json has all required footer keys`, async () => {
      const mod = await import(`../i18n/locales/${locale}.json`)
      const footer = mod.default?.footer ?? mod.footer
      expect(footer).toBeDefined()
      for (const key of REQUIRED_KEYS) {
        expect(footer[key], `missing footer.${key} in ${locale}.json`).toBeTruthy()
      }
    })
  }
})

describe('seo.privacy i18n keys', () => {
  const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'he']

  for (const locale of LOCALES) {
    it(`${locale}.json has seo.privacy title and description`, async () => {
      const mod = await import(`../i18n/locales/${locale}.json`)
      const seo = mod.default?.seo ?? mod.seo
      expect(seo).toBeDefined()
      expect(seo.privacy).toBeDefined()
      expect(seo.privacy.title, `missing seo.privacy.title in ${locale}.json`).toBeTruthy()
      expect(
        seo.privacy.description,
        `missing seo.privacy.description in ${locale}.json`,
      ).toBeTruthy()
    })
  }
})
