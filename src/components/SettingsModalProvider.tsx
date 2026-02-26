import { useState, useMemo, useCallback, type ReactNode } from 'react'
import { SettingsModalContext, type SettingsTab } from '../contexts/SettingsModalContext'
import { SettingsModal } from './SettingsModal'

export function SettingsModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<SettingsTab>('profile')

  const openSettings = useCallback((t?: SettingsTab) => {
    if (t) setTab(t)
    setOpen(true)
  }, [])

  const closeSettings = useCallback(() => setOpen(false), [])

  const value = useMemo(
    () => ({ open, tab, openSettings, closeSettings, setTab }),
    [open, tab, openSettings, closeSettings],
  )

  return (
    <SettingsModalContext.Provider value={value}>
      {children}
      <SettingsModal />
    </SettingsModalContext.Provider>
  )
}
