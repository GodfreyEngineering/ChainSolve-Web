/**
 * scratchWorkflow.test.ts — Unit tests for scratch canvas workflow (L4-1).
 *
 * Tests the logic changes that make the scratch canvas frictionless:
 *  - SaveAsDialog name defaulting for scratch vs project mode
 *  - i18n key completeness across all locales
 *  - projectStore reset default (scratch starts with 'Untitled')
 */

import { describe, it, expect } from 'vitest'
import { useProjectStore } from '../../stores/projectStore'

// ── SaveAsDialog name defaulting ────────────────────────────────────────────

/**
 * Replicates the name-init logic from SaveAsDialogInner so we can test
 * it without rendering the component.
 */
function computeInitialName(currentName: string): string {
  return currentName === 'Untitled' ? 'Untitled project' : `${currentName} (copy)`
}

describe('SaveAsDialog name defaulting (L4-1)', () => {
  it('suggests "Untitled project" when current name is "Untitled" (scratch mode)', () => {
    expect(computeInitialName('Untitled')).toBe('Untitled project')
  })

  it('appends " (copy)" for named projects', () => {
    expect(computeInitialName('My Bridge Analysis')).toBe('My Bridge Analysis (copy)')
  })

  it('appends " (copy)" for "Untitled project" (already saved once)', () => {
    expect(computeInitialName('Untitled project')).toBe('Untitled project (copy)')
  })
})

// ── projectStore scratch default ────────────────────────────────────────────

describe('projectStore scratch defaults (L4-1)', () => {
  it('resets projectName to "Untitled"', () => {
    useProjectStore.getState().beginLoad('p1', 'Old Name', '2025-01-01', 1, '2025-01-01')
    expect(useProjectStore.getState().projectName).toBe('Old Name')
    useProjectStore.getState().reset()
    expect(useProjectStore.getState().projectName).toBe('Untitled')
  })

  it('resets isDirty to false', () => {
    useProjectStore.getState().markDirty()
    expect(useProjectStore.getState().isDirty).toBe(true)
    useProjectStore.getState().reset()
    expect(useProjectStore.getState().isDirty).toBe(false)
  })

  it('resets projectId to null', () => {
    useProjectStore.getState().beginLoad('p1', 'Test', '2025-01-01', 1, '2025-01-01')
    expect(useProjectStore.getState().projectId).toBe('p1')
    useProjectStore.getState().reset()
    expect(useProjectStore.getState().projectId).toBeNull()
  })
})

// ── i18n key completeness ───────────────────────────────────────────────────

describe('i18n keys for scratch workflow (L4-1)', () => {
  const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'he'] as const
  const REQUIRED_KEYS = ['canvas.saveTooltip', 'canvas.saveAsTooltip'] as const

  for (const locale of LOCALES) {
    for (const key of REQUIRED_KEYS) {
      it(`${locale} has key "${key}"`, async () => {
        const data = await import(`../../i18n/locales/${locale}.json`)
        const [section, field] = key.split('.')
        expect(data[section]?.[field]).toBeTruthy()
      })
    }
  }
})
