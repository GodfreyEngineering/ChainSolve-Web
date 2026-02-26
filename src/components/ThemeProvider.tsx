import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react'
import { ThemeContext, type ThemeMode } from '../contexts/ThemeContext'

const STORAGE_KEY = 'chainsolve.theme'

function getStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // localStorage unavailable (e.g. private browsing)
  }
  return 'system'
}

// Subscribe to OS color scheme changes via useSyncExternalStore
const mql =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: light)') : null

function subscribeToSystemTheme(cb: () => void) {
  mql?.addEventListener('change', cb)
  return () => mql?.removeEventListener('change', cb)
}

function getSystemSnapshot(): boolean {
  return mql?.matches ?? false
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', resolved)
  document.documentElement.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode)
  const prefersLight = useSyncExternalStore(subscribeToSystemTheme, getSystemSnapshot)

  const resolved: 'light' | 'dark' =
    mode === 'light' || mode === 'dark' ? mode : prefersLight ? 'light' : 'dark'

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }, [])

  // Apply data-theme attribute to <html> whenever resolved changes
  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  const value = useMemo(() => ({ mode, setMode, resolved }), [mode, setMode, resolved])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
