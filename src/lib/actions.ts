/**
 * Action utilities for the Command Palette.
 *
 * Converts existing MenuEntry trees (used by DropdownMenu) into a flat,
 * searchable list of PaletteActions — zero duplication of handlers.
 */

import { isSeparator, isSubmenu, type MenuEntry } from '../components/ui/dropdownMenuTypes'

/* ── Types ─────────────────────────────────────────────────────────────────── */

/** A single searchable action for the command palette. */
export interface PaletteAction {
  /** Composite key: "{menuId}:{idx}" or "{menuId}:{parent}:{idx}" */
  id: string
  /** Display label, e.g. "Undo" */
  label: string
  /** Grouping context, e.g. "Edit" or "View \u203a Theme" */
  group: string
  /** Keyboard shortcut text, e.g. "Ctrl+Z" */
  shortcut?: string
  /** Whether the action is currently disabled */
  disabled: boolean
  /** Execute the action (reuses the existing onClick closure) */
  execute: () => void
}

/** Matches the shape of the `menus` array built in AppHeader. */
export interface MenuDef {
  id: string
  label: string
  items: MenuEntry[]
}

/* ── Flatten ───────────────────────────────────────────────────────────────── */

/** Convert a menu-bar definition into a flat action list for the palette. */
export function flattenMenusToActions(menus: MenuDef[]): PaletteAction[] {
  const result: PaletteAction[] = []

  for (const menu of menus) {
    let idx = 0
    for (const entry of menu.items) {
      if (isSeparator(entry)) continue

      if (isSubmenu(entry)) {
        let childIdx = 0
        for (const child of entry.children) {
          if (isSeparator(child)) continue
          if (isSubmenu(child)) continue // skip nested submenus
          if (!child.onClick) {
            childIdx++
            continue
          }
          result.push({
            id: `${menu.id}:${entry.label}:${childIdx}`,
            label: child.label,
            group: `${menu.label} \u203a ${entry.label}`,
            shortcut: child.shortcut,
            disabled: !!child.disabled,
            execute: child.onClick,
          })
          childIdx++
        }
      } else {
        if (!entry.onClick) {
          idx++
          continue
        }
        result.push({
          id: `${menu.id}:${idx}`,
          label: entry.label,
          group: menu.label,
          shortcut: entry.shortcut,
          disabled: !!entry.disabled,
          execute: entry.onClick,
        })
      }
      idx++
    }
  }

  return result
}

/* ── Synonyms ──────────────────────────────────────────────────────────────── */

/**
 * Synonym map: each key is a user-facing alias → canonical label fragments
 * that it should match. Lookups are case-insensitive.
 *
 * Example: typing "copy" also surfaces "Duplicate canvas" actions.
 */
export const ACTION_SYNONYMS: Record<string, string[]> = {
  copy: ['duplicate'],
  dupe: ['duplicate'],
  delete: ['remove', 'clear', 'discard'],
  remove: ['delete', 'clear'],
  clear: ['reset', 'remove', 'delete'],
  run: ['evaluate', 'recalculate'],
  evaluate: ['run', 'recalculate'],
  recalculate: ['evaluate', 'run'],
  print: ['export', 'pdf'],
  pdf: ['export', 'audit'],
  excel: ['xlsx', 'export'],
  xlsx: ['excel', 'export'],
  settings: ['preferences', 'options'],
  preferences: ['settings'],
  theme: ['dark', 'light', 'appearance'],
  dark: ['theme'],
  light: ['theme'],
  appearance: ['theme'],
  search: ['find', 'palette'],
  find: ['search', 'palette'],
  palette: ['search', 'command'],
  help: ['docs', 'documentation', 'shortcuts'],
  docs: ['documentation', 'help'],
  shortcuts: ['keyboard', 'hotkeys'],
  keyboard: ['shortcuts'],
  undo: ['revert'],
  revert: ['undo'],
  redo: ['repeat'],
  'bug report': ['feedback', 'issue'],
  feedback: ['bug', 'report'],
  open: ['load', 'import'],
  load: ['open', 'import'],
  import: ['open', 'load'],
  save: ['export', 'commit'],
  new: ['create', 'fresh', 'blank'],
  create: ['new', 'add'],
  add: ['insert', 'new', 'create'],
  insert: ['add'],
  layout: ['organise', 'arrange', 'auto'],
  organise: ['layout', 'arrange'],
  arrange: ['organise', 'layout'],
  validate: ['check', 'health', 'lint'],
  check: ['validate', 'health'],
  zoom: ['scale', 'fit'],
  fit: ['zoom', 'scale'],
  fullscreen: ['zoom', 'expand'],
}

/** Expand a query token to include synonyms. Returns a Set of lowercase strings. */
function expandQuery(q: string): Set<string> {
  const terms = new Set<string>([q])
  for (const [alias, targets] of Object.entries(ACTION_SYNONYMS)) {
    if (alias === q || targets.includes(q)) {
      terms.add(alias)
      for (const t of targets) terms.add(t)
    }
  }
  return terms
}

/* ── Ranking ───────────────────────────────────────────────────────────────── */

/**
 * Score an action against a query (lower = better).
 *   0 — exact label match
 *   1 — label starts with query
 *   2 — label contains query
 *   3 — group / shortcut match
 *   4 — synonym-only match
 */
function scoreAction(a: PaletteAction, q: string, synonymTerms: Set<string>): number {
  const label = a.label.toLowerCase()
  if (label === q) return 0
  if (label.startsWith(q)) return 1
  if (label.includes(q)) return 2
  if (a.group.toLowerCase().includes(q) || (a.shortcut?.toLowerCase().includes(q) ?? false))
    return 3
  // Check synonyms against label / group
  for (const term of synonymTerms) {
    if (term !== q && (label.includes(term) || a.group.toLowerCase().includes(term))) return 4
  }
  return 99
}

/* ── Filter ────────────────────────────────────────────────────────────────── */

/**
 * Filter and rank actions by a search query.
 *
 * - Case-insensitive substring match on label, group, and shortcut.
 * - Synonyms: common aliases (e.g. "copy" matches "Duplicate") are
 *   checked so users can type natural language.
 * - Ranking: exact label > prefix > contains > group/shortcut > synonym.
 * - Disabled actions are excluded.
 */
export function filterActions(actions: PaletteAction[], query: string): PaletteAction[] {
  const q = query.trim().toLowerCase()
  if (!q) return actions

  const synonymTerms = expandQuery(q)

  const scored: Array<{ action: PaletteAction; score: number }> = []

  for (const a of actions) {
    if (a.disabled) continue
    const score = scoreAction(a, q, synonymTerms)
    if (score < 99) scored.push({ action: a, score })
  }

  // Stable sort: primary by score, secondary preserve original order
  scored.sort((x, y) => x.score - y.score)
  return scored.map((s) => s.action)
}
