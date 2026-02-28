import { useState, useMemo, useCallback, lazy, Suspense, type ReactNode } from 'react'
import { SettingsModalContext, type SettingsTab } from '../contexts/SettingsModalContext'
import { useWindowManager } from '../contexts/WindowManagerContext'

export const SETTINGS_WINDOW_ID = 'settings'

const LazySettingsModal = lazy(() =>
  import('./SettingsModal').then((m) => ({ default: m.SettingsModal })),
)

export function SettingsModalProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<SettingsTab>('profile')
  const { openWindow, closeWindow, isOpen } = useWindowManager()
  const open = isOpen(SETTINGS_WINDOW_ID)

  const openSettings = useCallback(
    (t?: SettingsTab) => {
      if (t) setTab(t)
      openWindow(SETTINGS_WINDOW_ID, { width: 720, height: 520 })
    },
    [openWindow],
  )

  const closeSettings = useCallback(() => closeWindow(SETTINGS_WINDOW_ID), [closeWindow])

  const value = useMemo(
    () => ({ open, tab, openSettings, closeSettings, setTab }),
    [open, tab, openSettings, closeSettings],
  )

  return (
    <SettingsModalContext.Provider value={value}>
      {children}
      {open && (
        <Suspense fallback={null}>
          <LazySettingsModal />
        </Suspense>
      )}
    </SettingsModalContext.Provider>
  )
}
