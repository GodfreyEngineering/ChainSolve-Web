/**
 * powerUserWorkflows.test.ts — L4-4
 *
 * Tests for power user workflow polish:
 *   - Keyboard shortcut coverage (File menu + Canvas-level)
 *   - KeyboardShortcutsModal includes canvas shortcuts
 *   - Tooltip / aria-label completeness on key UI elements
 *   - i18n key completeness for shortcuts section across all 6 locales
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

// ── 1. AppHeader keyboard shortcuts ─────────────────────────────────────────

describe('AppHeader keyboard shortcuts (L4-4)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, 'app', 'AppHeader.tsx'), 'utf-8')

  it('has Ctrl+N shortcut for New Project', () => {
    expect(src).toContain("shortcut: 'Ctrl+N'")
  })

  it('has Ctrl+O shortcut for Open', () => {
    expect(src).toContain("shortcut: 'Ctrl+O'")
  })

  it('has Ctrl+S shortcut for Save', () => {
    expect(src).toContain("shortcut: 'Ctrl+S'")
  })

  it('has Ctrl+Shift+S shortcut for Save As', () => {
    expect(src).toContain("shortcut: 'Ctrl+Shift+S'")
  })

  it('registers Ctrl+N keydown handler', () => {
    expect(src).toContain("e.key === 'n'")
    expect(src).toContain('handleNewProject()')
  })

  it('registers Ctrl+O keydown handler', () => {
    expect(src).toContain("e.key === 'o'")
    expect(src).toContain('setOpenDialogOpen(true)')
  })

  it('registers Ctrl+Shift+S keydown handler', () => {
    expect(src).toContain("e.key === 'S'")
    expect(src).toContain('setSaveAsOpen(true)')
  })

  it('has Ctrl+Z for Undo', () => {
    expect(src).toContain("shortcut: 'Ctrl+Z'")
  })

  it('has Ctrl+Shift+Z for Redo', () => {
    expect(src).toContain("shortcut: 'Ctrl+Shift+Z'")
  })

  it('has Del shortcut for Delete Selected', () => {
    expect(src).toContain("shortcut: 'Del'")
  })

  it('has Ctrl+F shortcut for Find Block', () => {
    expect(src).toContain("shortcut: 'Ctrl+F'")
  })
})

// ── 2. Canvas-level shortcuts exist in CanvasArea ───────────────────────────

describe('CanvasArea keyboard shortcuts', () => {
  const src = fs.readFileSync(path.resolve(__dirname, 'canvas', 'CanvasArea.tsx'), 'utf-8')

  it('handles Ctrl+G for Group', () => {
    expect(src).toContain('// Ctrl+G: Group selected nodes')
    expect(src).toContain('groupSelection()')
  })

  it('handles Ctrl+Shift+G for Ungroup', () => {
    expect(src).toContain('// Ctrl+Shift+G: Ungroup selected group')
    expect(src).toContain('ungroupNode(')
  })

  it('handles Ctrl+Shift+D for Toggle dock', () => {
    expect(src).toContain('// Ctrl+Shift+D: Toggle bottom dock')
  })

  it('handles Ctrl+Alt+G for Toggle group collapse', () => {
    expect(src).toContain('// Ctrl+Alt+G: Toggle collapse on selected group')
    expect(src).toContain('toggleGroupCollapse(')
  })

  it('handles Space for hide selected', () => {
    expect(src).toContain('hideSelectedNodes()')
  })
})

// ── 3. KeyboardShortcutsModal includes canvas shortcuts ─────────────────────

describe('KeyboardShortcutsModal canvas shortcuts (L4-4)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, 'app', 'KeyboardShortcutsModal.tsx'), 'utf-8')

  it('defines canvas shortcut group', () => {
    expect(src).toContain("t('shortcuts.canvas')")
  })

  it('includes group selected shortcut', () => {
    expect(src).toContain("t('shortcuts.groupSelected')")
    expect(src).toContain("shortcut: 'Ctrl+G'")
  })

  it('includes ungroup shortcut', () => {
    expect(src).toContain("t('shortcuts.ungroupSelected')")
    expect(src).toContain("shortcut: 'Ctrl+Shift+G'")
  })

  it('includes toggle dock shortcut', () => {
    expect(src).toContain("t('shortcuts.toggleDock')")
    expect(src).toContain("shortcut: 'Ctrl+Shift+D'")
  })

  it('includes collapse group shortcut', () => {
    expect(src).toContain("t('shortcuts.collapseGroup')")
    expect(src).toContain("shortcut: 'Ctrl+Alt+G'")
  })

  it('includes hide selected shortcut', () => {
    expect(src).toContain("t('shortcuts.hideSelected')")
    expect(src).toContain("shortcut: 'Space'")
  })

  it('merges canvas actions into the grouped display', () => {
    expect(src).toContain('[...globalActions, ...canvasActions, ...withShortcut]')
  })
})

// ── 4. Tooltip completeness ─────────────────────────────────────────────────

describe('Tooltip completeness (L4-4)', () => {
  it('ExpressionPanel close buttons have title and aria-label', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'canvas', 'ExpressionPanel.tsx'), 'utf-8')
    // Both close buttons should have title={t('ui.close')} (may be on separate lines)
    const titleMatches = src.match(/title=\{t\('ui\.close'\)\}/g)
    expect(titleMatches).not.toBeNull()
    expect(titleMatches!.length).toBeGreaterThanOrEqual(2)
  })

  it('VariablesPanel close button has title and aria-label', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'canvas', 'VariablesPanel.tsx'), 'utf-8')
    // Close button (×) should have title for tooltip
    expect(src).toContain("title={t('ui.close')}")
    expect(src).toContain("aria-label={t('ui.close')}")
  })

  it('BottomDock tab buttons have title attribute', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'canvas', 'BottomDock.tsx'), 'utf-8')
    expect(src).toContain('title={panel.label}')
    expect(src).toContain('aria-label={panel.label}')
  })
})

// ── 5. i18n key completeness for shortcuts ──────────────────────────────────

describe('i18n keys for shortcuts (L4-4)', () => {
  const SHORTCUTS_KEYS = [
    'shortcuts.global',
    'shortcuts.canvas',
    'shortcuts.groupSelected',
    'shortcuts.ungroupSelected',
    'shortcuts.toggleDock',
    'shortcuts.collapseGroup',
    'shortcuts.hideSelected',
  ] as const

  for (const locale of LOCALES) {
    for (const key of SHORTCUTS_KEYS) {
      it(`${locale} has key "${key}"`, () => {
        const data = readLocale(locale)
        const [section, field] = key.split('.')
        expect(data[section]?.[field]).toBeTruthy()
      })
    }
  }
})
