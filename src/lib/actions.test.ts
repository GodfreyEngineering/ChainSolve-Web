import { describe, it, expect } from 'vitest'
import { filterActions, ACTION_SYNONYMS, type PaletteAction } from './actions'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAction(label: string, group = 'File', shortcut?: string): PaletteAction {
  return { id: label, label, group, shortcut, disabled: false, execute: () => {} }
}

function makeDisabled(label: string): PaletteAction {
  return { id: label, label, group: 'Edit', disabled: true, execute: () => {} }
}

const SAMPLE: PaletteAction[] = [
  makeAction('Undo', 'Edit', 'Ctrl+Z'),
  makeAction('Redo', 'Edit', 'Ctrl+Y'),
  makeAction('Duplicate canvas', 'File'),
  makeAction('Export PDF', 'File'),
  makeAction('Evaluate graph', 'Tools'),
  makeAction('Open project', 'File'),
  makeAction('Save', 'File', 'Ctrl+S'),
  makeAction('Keyboard shortcuts', 'Help'),
  makeDisabled('Disabled action'),
]

// ── filterActions — basic ─────────────────────────────────────────────────────

describe('filterActions — basic', () => {
  it('returns all actions (including disabled) when query is empty', () => {
    expect(filterActions(SAMPLE, '')).toEqual(SAMPLE)
  })

  it('returns all actions for whitespace-only query', () => {
    expect(filterActions(SAMPLE, '   ')).toEqual(SAMPLE)
  })

  it('excludes disabled actions when query is non-empty', () => {
    const result = filterActions(SAMPLE, 'action')
    expect(result.every((a) => !a.disabled)).toBe(true)
  })

  it('is case-insensitive', () => {
    const lower = filterActions(SAMPLE, 'undo')
    const upper = filterActions(SAMPLE, 'UNDO')
    expect(lower.length).toBe(upper.length)
    expect(lower.map((a) => a.label)).toEqual(upper.map((a) => a.label))
  })

  it('matches by shortcut', () => {
    const result = filterActions(SAMPLE, 'ctrl+z')
    expect(result.some((a) => a.label === 'Undo')).toBe(true)
  })

  it('matches by group', () => {
    const result = filterActions(SAMPLE, 'tools')
    expect(result.some((a) => a.label === 'Evaluate graph')).toBe(true)
  })

  it('returns empty for a nonsense query', () => {
    expect(filterActions(SAMPLE, 'xyzzy_not_a_thing')).toEqual([])
  })
})

// ── filterActions — ranking ───────────────────────────────────────────────────

describe('filterActions — ranking', () => {
  it('ranks exact label match first', () => {
    const actions = [
      makeAction('Save as'),
      makeAction('Save', 'File', 'Ctrl+S'),
      makeAction('Auto-save preferences'),
    ]
    const result = filterActions(actions, 'save')
    expect(result[0].label).toBe('Save')
  })

  it('ranks prefix match before contains match', () => {
    const actions = [makeAction('Export PDF'), makeAction('PDF export')]
    const result = filterActions(actions, 'pdf')
    // 'PDF export' starts with 'pdf' (after lowercasing), 'Export PDF' contains 'pdf'
    expect(result[0].label).toBe('PDF export')
  })

  it('contains match ranks before group-only match', () => {
    const actions = [makeAction('Something else', 'Export group'), makeAction('Export canvas')]
    const result = filterActions(actions, 'export')
    expect(result[0].label).toBe('Export canvas')
  })

  it('preserves relative order for equal-ranked items', () => {
    const actions = [makeAction('Undo last'), makeAction('Undo selection'), makeAction('Undo all')]
    const result = filterActions(actions, 'undo')
    const labels = result.map((a) => a.label)
    expect(labels).toEqual(['Undo last', 'Undo selection', 'Undo all'])
  })
})

// ── filterActions — synonyms ──────────────────────────────────────────────────

describe('filterActions — synonyms', () => {
  it('typing "copy" surfaces "Duplicate" actions', () => {
    const result = filterActions(SAMPLE, 'copy')
    expect(result.some((a) => a.label === 'Duplicate canvas')).toBe(true)
  })

  it('typing "run" surfaces "Evaluate" actions', () => {
    const result = filterActions(SAMPLE, 'run')
    expect(result.some((a) => a.label === 'Evaluate graph')).toBe(true)
  })

  it('typing "shortcuts" surfaces "Keyboard shortcuts"', () => {
    const result = filterActions(SAMPLE, 'shortcuts')
    expect(result.some((a) => a.label === 'Keyboard shortcuts')).toBe(true)
  })

  it('typing "pdf" surfaces "Export PDF"', () => {
    const result = filterActions(SAMPLE, 'pdf')
    expect(result.some((a) => a.label === 'Export PDF')).toBe(true)
  })

  it('direct label match ranks above synonym match', () => {
    const actions = [makeAction('Duplicate canvas', 'File'), makeAction('Copy selection', 'Edit')]
    // Query "copy" — "Copy selection" is a direct match, "Duplicate" is a synonym
    const result = filterActions(actions, 'copy')
    expect(result[0].label).toBe('Copy selection')
  })
})

// ── ACTION_SYNONYMS structural check ─────────────────────────────────────────

describe('ACTION_SYNONYMS', () => {
  it('is a non-empty object', () => {
    expect(typeof ACTION_SYNONYMS).toBe('object')
    expect(Object.keys(ACTION_SYNONYMS).length).toBeGreaterThan(0)
  })

  it('all values are arrays of strings', () => {
    for (const [, targets] of Object.entries(ACTION_SYNONYMS)) {
      expect(Array.isArray(targets)).toBe(true)
      for (const t of targets) expect(typeof t).toBe('string')
    }
  })
})
