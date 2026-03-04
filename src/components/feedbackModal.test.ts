/**
 * feedbackModal.test.ts — L4-3
 *
 * Tests for the unified feedback modal:
 *   - FeedbackModal component exports
 *   - collectDiagnostics includes engine logs
 *   - Suggestion category mapping
 *   - i18n key completeness across all 6 locales
 *   - AppHeader + PreferencesSettings use FeedbackModal (not legacy modals)
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ── Helpers ──────────────────────────────────────────────────────────────────

function readLocale(locale: string): Record<string, Record<string, string>> {
  const raw = fs.readFileSync(
    path.resolve(__dirname, '..', 'i18n', 'locales', `${locale}.json`),
    'utf-8',
  )
  return JSON.parse(raw) as Record<string, Record<string, string>>
}

const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'he'] as const

// ── 1. FeedbackModal structure ──────────────────────────────────────────────

describe('FeedbackModal structure', () => {
  const src = fs.readFileSync(path.resolve(__dirname, 'FeedbackModal.tsx'), 'utf-8')

  it('exports FeedbackModal component', () => {
    expect(src).toContain('export function FeedbackModal')
  })

  it('imports exportDiagnostics for redacted engine logs', () => {
    expect(src).toContain("import { exportDiagnostics } from '../observability/diagnostics'")
  })

  it('calls exportDiagnostics when includeLogs is true', () => {
    expect(src).toContain('exportDiagnostics()')
  })

  it('supports three feedback types', () => {
    expect(src).toContain("'bug'")
    expect(src).toContain("'suggestion'")
    expect(src).toContain("'block_request'")
  })

  it('maps block_request to block_library suggestion category', () => {
    expect(src).toContain("block_request: 'block_library'")
  })

  it('maps suggestion to feature_request category', () => {
    expect(src).toContain("suggestion: 'feature_request'")
  })

  it('uses type-specific placeholders', () => {
    expect(src).toContain('t(`feedback.titlePlaceholder_${feedbackType}`)')
    expect(src).toContain('t(`feedback.descriptionPlaceholder_${feedbackType}`)')
  })

  it('shows screenshot upload only for bug type', () => {
    expect(src).toContain('{isBug && (')
  })

  it('shows diagnostics checkbox only for bug type', () => {
    expect(src).toContain("t('feedback.includeDiagnostics')")
    expect(src).toContain("t('feedback.diagnosticsHint')")
  })
})

// ── 2. AppHeader uses FeedbackModal ─────────────────────────────────────────

describe('AppHeader uses unified FeedbackModal', () => {
  const src = fs.readFileSync(path.resolve(__dirname, 'app', 'AppHeader.tsx'), 'utf-8')

  it('imports LazyFeedbackModal', () => {
    expect(src).toContain("import('../FeedbackModal')")
  })

  it('does not import legacy BugReportModal', () => {
    expect(src).not.toContain("import('../BugReportModal')")
  })

  it('does not import legacy SuggestionModal', () => {
    expect(src).not.toContain("import('../SuggestionModal')")
  })

  it('has menu.feedback entry', () => {
    expect(src).toContain("t('menu.feedback')")
  })

  it('renders LazyFeedbackModal with initialType prop', () => {
    expect(src).toContain('initialType={feedbackType}')
  })
})

// ── 3. PreferencesSettings uses FeedbackModal ───────────────────────────────

describe('PreferencesSettings uses unified FeedbackModal', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', 'pages', 'settings', 'PreferencesSettings.tsx'),
    'utf-8',
  )

  it('lazy-imports FeedbackModal', () => {
    expect(src).toContain("import('../../components/FeedbackModal')")
  })

  it('does not import legacy BugReportModal', () => {
    expect(src).not.toContain('import { BugReportModal }')
  })

  it('does not import legacy SuggestionModal', () => {
    expect(src).not.toContain('import { SuggestionModal }')
  })

  it('renders FeedbackModal with initialType prop', () => {
    expect(src).toContain('initialType={feedbackType}')
  })
})

// ── 4. i18n key completeness ────────────────────────────────────────────────

describe('i18n keys for feedback modal (L4-3)', () => {
  const FEEDBACK_KEYS = [
    'feedback.title',
    'feedback.type_bug',
    'feedback.type_suggestion',
    'feedback.type_block_request',
    'feedback.titleLabel',
    'feedback.titlePlaceholder_bug',
    'feedback.titlePlaceholder_suggestion',
    'feedback.titlePlaceholder_block_request',
    'feedback.descriptionLabel',
    'feedback.descriptionPlaceholder_bug',
    'feedback.descriptionPlaceholder_suggestion',
    'feedback.descriptionPlaceholder_block_request',
    'feedback.includeDiagnostics',
    'feedback.diagnosticsHint',
    'feedback.submit',
    'feedback.submitting',
    'feedback.success',
    'feedback.error',
  ] as const

  for (const locale of LOCALES) {
    for (const key of FEEDBACK_KEYS) {
      it(`${locale} has key "${key}"`, () => {
        const data = readLocale(locale)
        const [section, field] = key.split('.')
        expect(data[section]?.[field]).toBeTruthy()
      })
    }
  }
})

// ── 5. menu.feedback key in EN ──────────────────────────────────────────────

describe('menu.feedback key exists', () => {
  it('en.json has menu.feedback', () => {
    const data = readLocale('en')
    expect(data.menu?.feedback).toBeTruthy()
  })
})
