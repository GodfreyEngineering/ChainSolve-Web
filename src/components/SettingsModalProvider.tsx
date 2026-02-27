import { useState, useMemo, useCallback, lazy, Suspense, type ReactNode } from 'react'
import { SettingsModalContext, type SettingsTab } from '../contexts/SettingsModalContext'

const LazySettingsModal = lazy(() =>
  import('./SettingsModal').then((m) => ({ default: m.SettingsModal })),
)

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
      {open && (
        <Suspense fallback={null}>
          <LazySettingsModal />
        </Suspense>
      )}
    </SettingsModalContext.Provider>
  )
}
