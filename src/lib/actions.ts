/**
 * Action utilities for the Command Palette.
 *
 * Converts existing MenuEntry trees (used by DropdownMenu) into a flat,
 * searchable list of PaletteActions — zero duplication of handlers.
 */

import {
  isSeparator,
  isSubmenu,
  type MenuEntry,
} from '../components/ui/dropdownMenuTypes'

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
          if (!child.onClick) { childIdx++; continue }
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
        if (!entry.onClick) { idx++; continue }
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

/* ── Filter ────────────────────────────────────────────────────────────────── */

/** Filter actions by a search query (case-insensitive substring match). */
export function filterActions(
  actions: PaletteAction[],
  query: string,
): PaletteAction[] {
  const q = query.trim().toLowerCase()
  if (!q) return actions
  return actions.filter(
    (a) =>
      !a.disabled &&
      (a.label.toLowerCase().includes(q) ||
        a.group.toLowerCase().includes(q) ||
        (a.shortcut?.toLowerCase().includes(q) ?? false)),
  )
}
