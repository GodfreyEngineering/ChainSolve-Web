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
