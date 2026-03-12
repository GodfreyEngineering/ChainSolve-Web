/**
 * keybindings — KB-01: User-editable keyboard shortcuts.
 *
 * Defines action IDs, default key combos, utilities for matching events,
 * and formatting captured key combos.
 */

// ── Action IDs ────────────────────────────────────────────────────────────────

export type KeybindingAction =
  | 'save'
  | 'undo'
  | 'redo'
  | 'commandPalette'
  | 'quickAdd'
  | 'deleteSelection'
  | 'selectAll'
  | 'zoomFit'
  | 'toggleLeftPanel'
  | 'toggleRightPanel'
  | 'toggleBottomDock'
  | 'switchTabNext'
  | 'switchTabPrev'
  | 'parametricSweep'
  | 'toggleAutosave'

/** Human-readable labels for each action */
export const ACTION_LABELS: Record<KeybindingAction, string> = {
  save: 'Save now',
  undo: 'Undo',
  redo: 'Redo',
  commandPalette: 'Open command palette',
  quickAdd: 'Quick-add block',
  deleteSelection: 'Delete selection',
  selectAll: 'Select all',
  zoomFit: 'Zoom to fit',
  toggleLeftPanel: 'Toggle left panel',
  toggleRightPanel: 'Toggle inspector',
  toggleBottomDock: 'Toggle bottom dock',
  switchTabNext: 'Next canvas tab',
  switchTabPrev: 'Previous canvas tab',
  parametricSweep: 'Run parametric sweep',
  toggleAutosave: 'Toggle autosave',
}

/** Action groups for display */
export const ACTION_GROUPS: { title: string; actions: KeybindingAction[] }[] = [
  {
    title: 'Global',
    actions: ['save', 'undo', 'redo', 'commandPalette', 'toggleAutosave'],
  },
  {
    title: 'Canvas',
    actions: ['quickAdd', 'deleteSelection', 'selectAll', 'zoomFit', 'parametricSweep'],
  },
  {
    title: 'Panels',
    actions: [
      'toggleLeftPanel',
      'toggleRightPanel',
      'toggleBottomDock',
      'switchTabNext',
      'switchTabPrev',
    ],
  },
]

// ── Default bindings ──────────────────────────────────────────────────────────

/** Key combo format: "Ctrl+S", "Ctrl+Shift+Z", "Delete", "Ctrl+0" */
export type KeyCombo = string

export const DEFAULT_KEYBINDINGS: Record<KeybindingAction, KeyCombo> = {
  save: 'Ctrl+S',
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Shift+Z',
  commandPalette: 'Ctrl+K',
  quickAdd: 'Ctrl+Space',
  deleteSelection: 'Delete',
  selectAll: 'Ctrl+A',
  zoomFit: 'Ctrl+0',
  toggleLeftPanel: 'Ctrl+Shift+L',
  toggleRightPanel: 'Ctrl+J',
  toggleBottomDock: 'Ctrl+Shift+D',
  switchTabNext: 'Ctrl+Tab',
  switchTabPrev: 'Ctrl+Shift+Tab',
  parametricSweep: 'Ctrl+Shift+R',
  toggleAutosave: 'Ctrl+Shift+W',
}

// ── Browser-reserved key combos (warn but allow rebinding) ───────────────────

/** Key combos reserved by the browser — warn the user but don't block. */
const BROWSER_RESERVED = new Set([
  'Ctrl+W',
  'Ctrl+T',
  'Ctrl+N',
  'Ctrl+Tab',
  'Ctrl+Shift+Tab',
  'Ctrl+R',
  'Ctrl+Shift+I',
  'Ctrl+L',
  'Ctrl+U',
  'Alt+F4',
  'F5',
  'F11',
  'F12',
])

export function isBrowserReserved(combo: KeyCombo): boolean {
  return BROWSER_RESERVED.has(combo)
}

// ── Key combo parsing & formatting ───────────────────────────────────────────

/** Parse a combo string into its parts. */
export function parseCombo(combo: KeyCombo): {
  ctrl: boolean
  shift: boolean
  alt: boolean
  key: string
} {
  const parts = combo.split('+')
  const ctrl = parts.includes('Ctrl')
  const shift = parts.includes('Shift')
  const alt = parts.includes('Alt')
  const key = parts[parts.length - 1]
  return { ctrl, shift, alt, key }
}

/** Format a KeyboardEvent into a combo string. Returns null for bare modifiers. */
export function formatKeyboardEvent(e: KeyboardEvent): KeyCombo | null {
  const bare = ['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock']
  if (bare.includes(e.key)) return null

  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')

  // Normalize key name
  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key === 'ArrowUp') key = 'Up'
  else if (key === 'ArrowDown') key = 'Down'
  else if (key === 'ArrowLeft') key = 'Left'
  else if (key === 'ArrowRight') key = 'Right'
  else if (key.length === 1 && e.shiftKey) key = key.toUpperCase()
  else if (key.length === 1) key = key.toUpperCase()

  parts.push(key)
  return parts.join('+')
}

// ── Matching ─────────────────────────────────────────────────────────────────

/** Check if a keyboard event matches a combo string. */
export function matchesBinding(e: KeyboardEvent | React.KeyboardEvent, combo: KeyCombo): boolean {
  const { ctrl, shift, alt, key } = parseCombo(combo)
  const evCtrl = 'ctrlKey' in e ? e.ctrlKey || e.metaKey : false
  const evShift = 'shiftKey' in e ? e.shiftKey : false
  const evAlt = 'altKey' in e ? e.altKey : false
  if (evCtrl !== ctrl || evShift !== shift || evAlt !== alt) return false

  // Normalize event key
  let evKey = e.key
  if (evKey === ' ') evKey = 'Space'
  else if (evKey === 'ArrowUp') evKey = 'Up'
  else if (evKey === 'ArrowDown') evKey = 'Down'
  else if (evKey === 'ArrowLeft') evKey = 'Left'
  else if (evKey === 'ArrowRight') evKey = 'Right'

  return evKey.toUpperCase() === key.toUpperCase()
}

/** Find any conflicts: returns the action that already uses this combo (excluding self). */
export function findConflict(
  combo: KeyCombo,
  excludeAction: KeybindingAction,
  effectiveBindings: Record<KeybindingAction, KeyCombo>,
): KeybindingAction | null {
  for (const [action, bound] of Object.entries(effectiveBindings) as [
    KeybindingAction,
    KeyCombo,
  ][]) {
    if (action !== excludeAction && bound.toLowerCase() === combo.toLowerCase()) {
      return action
    }
  }
  return null
}
