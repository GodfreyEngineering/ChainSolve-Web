import { createContext, useContext } from 'react'

export type SettingsTab = 'profile' | 'billing' | 'preferences'

export interface SettingsModalContextValue {
  open: boolean
  tab: SettingsTab
  openSettings: (tab?: SettingsTab) => void
  closeSettings: () => void
  setTab: (tab: SettingsTab) => void
}

export const SettingsModalContext = createContext<SettingsModalContextValue>({
  open: false,
  tab: 'profile',
  openSettings: () => {},
  closeSettings: () => {},
  setTab: () => {},
})

export function useSettingsModal(): SettingsModalContextValue {
  return useContext(SettingsModalContext)
}
