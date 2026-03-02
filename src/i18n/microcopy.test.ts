/**
 * microcopy.test.ts — G1-1
 *
 * Structural tests that guard the microcopy quality invariants:
 *   1. Components that were migrated to i18n must not contain hardcoded UI strings.
 *   2. All locale files must contain the required i18n key sections.
 *   3. No emoji characters in i18n-migrated components (unicode symbols only).
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ── Helpers ──────────────────────────────────────────────────────────────────

function readComponent(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf-8')
}

function readLocale(locale: string): Record<string, unknown> {
  const raw = fs.readFileSync(path.resolve(__dirname, 'locales', `${locale}.json`), 'utf-8')
  return JSON.parse(raw) as Record<string, unknown>
}

const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'he']

// ── 1. ContextMenu — all labels use t() ──────────────────────────────────────

describe('ContextMenu uses i18n for all labels', () => {
  const src = readComponent('components/canvas/ContextMenu.tsx')

  it('imports useTranslation', () => {
    expect(src).toContain("import { useTranslation } from 'react-i18next'")
  })

  it('calls useTranslation()', () => {
    expect(src).toContain('const { t } = useTranslation()')
  })

  it('does not contain hardcoded English label strings in MenuItem calls', () => {
    // Match label="some string" (hardcoded) but not label={...} (dynamic)
    const hardcodedLabels = [...src.matchAll(/label="([^"]+)"/g)].map((m) => m[1])
    expect(hardcodedLabels).toEqual([])
  })

  it('does not contain emoji characters', () => {
    // Common emoji ranges: emoticons (U+1F600-1F64F), misc symbols (U+1F300-1F5FF),
    // transport (U+1F680-1F6FF), supplemental (U+1F900-1F9FF)
    const emojiPattern = /[\u{1F300}-\u{1F9FF}]/u
    expect(emojiPattern.test(src)).toBe(false)
  })
})

// ── 2. ErrorBoundary — uses i18n.t() ─────────────────────────────────────────

describe('ErrorBoundary uses i18n', () => {
  const src = readComponent('components/ErrorBoundary.tsx')

  it('imports i18n config', () => {
    expect(src).toContain("import i18n from '../i18n/config'")
  })

  it('uses i18n.t() for the title', () => {
    expect(src).toContain("i18n.t('errorBoundary.title')")
  })

  it('uses i18n.t() for the try-again button', () => {
    expect(src).toContain("i18n.t('errorBoundary.tryAgain')")
  })

  it('does not contain the hardcoded string "Something went wrong"', () => {
    expect(src).not.toContain("'Something went wrong'")
    expect(src).not.toContain('"Something went wrong"')
  })
})

// ── 3. EngineFatalError — uses useTranslation ────────────────────────────────

describe('EngineFatalError uses i18n', () => {
  const src = readComponent('components/EngineFatalError.tsx')

  it('imports useTranslation', () => {
    expect(src).toContain("import { useTranslation } from 'react-i18next'")
  })

  it('uses t() for CSP title', () => {
    expect(src).toContain("t('engineError.cspTitle')")
  })

  it('uses t() for copy diagnostics button', () => {
    expect(src).toContain("t('engineError.copyDiagnostics')")
  })

  it('does not contain the hardcoded string "Engine failed to load"', () => {
    expect(src).not.toContain("'Engine failed to load'")
  })
})

// ── 4. All locales have the required key sections ────────────────────────────

describe('All locales contain required i18n sections', () => {
  const requiredSections = ['contextMenu', 'errorBoundary', 'engineError', 'themeOption', 'common']

  for (const locale of LOCALES) {
    describe(`locale: ${locale}`, () => {
      const data = readLocale(locale)

      for (const section of requiredSections) {
        it(`has "${section}" section`, () => {
          expect(data).toHaveProperty(section)
          expect(typeof data[section]).toBe('object')
        })
      }
    })
  }
})

// ── 5. contextMenu key completeness across locales ───────────────────────────

describe('contextMenu keys are present in all locales', () => {
  const enData = readLocale('en')
  const enKeys = Object.keys(enData.contextMenu as Record<string, string>)

  for (const locale of LOCALES) {
    if (locale === 'en') continue
    it(`${locale} has all contextMenu keys`, () => {
      const localeData = readLocale(locale)
      const localeKeys = Object.keys(localeData.contextMenu as Record<string, string>)
      const missing = enKeys.filter((k) => !localeKeys.includes(k))
      expect(missing).toEqual([])
    })
  }
})

// ── 6. AppHeader theme labels use i18n ───────────────────────────────────────

describe('AppHeader theme labels use i18n', () => {
  const src = readComponent('components/app/AppHeader.tsx')

  it('uses t() for system theme label', () => {
    expect(src).toContain("t('themeOption.system')")
  })

  it('uses t() for light theme label', () => {
    expect(src).toContain("t('themeOption.light')")
  })

  it('uses t() for dark theme label', () => {
    expect(src).toContain("t('themeOption.dark')")
  })

  it('uses t() for scratch canvas label', () => {
    expect(src).toContain("t('canvas.scratch')")
  })

  it('uses t() for click-to-rename tooltip', () => {
    expect(src).toContain("t('canvas.clickToRename')")
  })
})
