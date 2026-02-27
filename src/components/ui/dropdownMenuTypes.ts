export interface MenuItem {
  label: string
  shortcut?: string
  disabled?: boolean
  onClick?: () => void
}

export interface MenuSeparator {
  separator: true
}

export interface MenuSubmenu {
  label: string
  children: MenuEntry[]
}

export type MenuEntry = MenuItem | MenuSeparator | MenuSubmenu

export function isSeparator(e: MenuEntry): e is MenuSeparator {
  return 'separator' in e && (e as MenuSeparator).separator === true
}

export function isSubmenu(e: MenuEntry): e is MenuSubmenu {
  return 'children' in e
}

/**
 * Compute the next keyboard-focus index when navigating a menu with Arrow keys.
 *
 * Separators are skipped; navigation wraps around at both ends.
 * Returns the unchanged focusIdx when there are no actionable items.
 */
export function computeNextFocusIdx(
  focusIdx: number,
  key: 'ArrowDown' | 'ArrowUp',
  items: MenuEntry[],
): number {
  const actionable = items
    .map((e, i) => ({ entry: e, index: i }))
    .filter(({ entry }) => !isSeparator(entry))
  if (actionable.length === 0) return focusIdx
  const currentActionIdx = actionable.findIndex((a) => a.index === focusIdx)
  if (key === 'ArrowDown') {
    const next = currentActionIdx < actionable.length - 1 ? currentActionIdx + 1 : 0
    return actionable[next].index
  } else {
    const prev = currentActionIdx > 0 ? currentActionIdx - 1 : actionable.length - 1
    return actionable[prev].index
  }
}
