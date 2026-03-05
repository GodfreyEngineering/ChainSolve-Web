import { useState, useMemo, useCallback, lazy, Suspense, type ReactNode } from 'react'
import {
  SettingsModalContext,
  isAccountTab,
  type SettingsTab,
  type AccountTab,
  type AppTab,
} from '../contexts/SettingsModalContext'
import { useWindowManager } from '../contexts/WindowManagerContext'

/** J2-1: Two separate window IDs for account vs app settings. */
export const ACCOUNT_SETTINGS_WINDOW_ID = 'account-settings'
export const APP_SETTINGS_WINDOW_ID = 'app-settings'

/** @deprecated Use ACCOUNT_SETTINGS_WINDOW_ID or APP_SETTINGS_WINDOW_ID. */
export const SETTINGS_WINDOW_ID = ACCOUNT_SETTINGS_WINDOW_ID

const LazySettingsModal = lazy(() =>
  import('./SettingsModal').then((m) => ({ default: m.SettingsModal })),
)

export function SettingsModalProvider({ children }: { children: ReactNode }) {
  const [accountTab, setAccountTab] = useState<AccountTab>('profile')
  const [appTab, setAppTab] = useState<AppTab>('general')
  const { openWindow, closeWindow, isOpen } = useWindowManager()

  const accountOpen = isOpen(ACCOUNT_SETTINGS_WINDOW_ID)
  const appOpen = isOpen(APP_SETTINGS_WINDOW_ID)

  const openSettings = useCallback(
    (tab?: SettingsTab) => {
      if (tab && isAccountTab(tab)) {
        setAccountTab(tab)
        openWindow(ACCOUNT_SETTINGS_WINDOW_ID, { width: 720, height: 520 })
      } else {
        if (tab) setAppTab(tab as AppTab)
        openWindow(APP_SETTINGS_WINDOW_ID, { width: 720, height: 520 })
      }
    },
    [openWindow],
  )

  const closeAccountSettings = useCallback(
    () => closeWindow(ACCOUNT_SETTINGS_WINDOW_ID),
    [closeWindow],
  )
  const closeAppSettings = useCallback(() => closeWindow(APP_SETTINGS_WINDOW_ID), [closeWindow])

  const value = useMemo(
    () => ({
      openSettings,
      accountOpen,
      accountTab,
      setAccountTab,
      closeAccountSettings,
      appOpen,
      appTab,
      setAppTab,
      closeAppSettings,
    }),
    [
      openSettings,
      accountOpen,
      accountTab,
      closeAccountSettings,
      appOpen,
      appTab,
      closeAppSettings,
    ],
  )

  return (
    <SettingsModalContext.Provider value={value}>
      {children}
      {accountOpen && (
        <Suspense fallback={null}>
          <LazySettingsModal kind="account" />
        </Suspense>
      )}
      {appOpen && (
        <Suspense fallback={null}>
          <LazySettingsModal kind="app" />
        </Suspense>
      )}
    </SettingsModalContext.Provider>
  )
}
