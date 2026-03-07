import { createContext, useContext } from 'react'

/** J2-1: Account Settings tabs (security-sensitive). */
export type AccountTab = 'profile' | 'billing' | 'security'

/** J2-1: App Settings tabs (workbench preferences). */
export type AppTab = 'general' | 'appearance' | 'editor' | 'formatting' | 'export' | 'shortcuts'

/** Union kept for backward compatibility with openSettings(tab). */
export type SettingsTab = AccountTab | AppTab

export interface SettingsModalContextValue {
  /** Opens the correct settings window based on tab type. */
  openSettings: (tab?: SettingsTab) => void

  // Account Settings window
  accountOpen: boolean
  accountTab: AccountTab
  setAccountTab: (tab: AccountTab) => void
  closeAccountSettings: () => void

  // App Settings window
  appOpen: boolean
  appTab: AppTab
  setAppTab: (tab: AppTab) => void
  closeAppSettings: () => void
}

const ACCOUNT_TABS = new Set<string>(['profile', 'billing', 'security'])

/** Returns true if the tab belongs to Account Settings. */
export function isAccountTab(tab: string): tab is AccountTab {
  return ACCOUNT_TABS.has(tab)
}

export const SettingsModalContext = createContext<SettingsModalContextValue>({
  openSettings: () => {},
  accountOpen: false,
  accountTab: 'profile',
  setAccountTab: () => {},
  closeAccountSettings: () => {},
  appOpen: false,
  appTab: 'general',
  setAppTab: () => {},
  closeAppSettings: () => {},
})

export function useSettingsModal(): SettingsModalContextValue {
  return useContext(SettingsModalContext)
}
