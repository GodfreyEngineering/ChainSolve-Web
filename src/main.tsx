/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useCallback, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/config'
import { initObservability } from './observability/client'
import App from './App.tsx'

// Initialise observability early — installs global error handlers.
// Never throws; failures are silently swallowed so the app always boots.
try {
  initObservability()
} catch {
  // intentionally swallowed
}

// Apply any persisted custom theme (D8-2) before first render to avoid flash.
import { applyPersistedCustomTheme } from './lib/customThemes'
try {
  applyPersistedCustomTheme()
} catch {
  // intentionally swallowed
}
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ThemeProvider } from './components/ThemeProvider.tsx'
import { ToastProvider } from './components/ui/Toast.tsx'
import { EngineFatalError } from './components/EngineFatalError.tsx'
import { SettingsModalProvider } from './components/SettingsModalProvider.tsx'
import { WindowManagerProvider } from './contexts/WindowManagerContext.tsx'
import { WindowDock } from './components/ui/WindowDock.tsx'
import { EngineContext } from './contexts/EngineContext.ts'
import { createEngine, type EngineAPI } from './engine/index.ts'
import { validateCatalog } from './blocks/registry'

function Root() {
  const [engine, setEngine] = useState<EngineAPI | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    createEngine()
      .then((eng) => {
        if (cancelled) {
          eng.dispose()
          return
        }
        validateCatalog(eng.catalog)
        ;(window as unknown as Record<string, unknown>).__chainsolve_engine = eng
        console.info('[engine] WASM engine ready, version:', eng.engineVersion)
        setEngine(eng)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      })

    return () => {
      cancelled = true
    }
  }, [retryCount])

  const handleRetry = useCallback(() => {
    setError(null)
    setEngine(null)
    setRetryCount((c) => c + 1)
  }, [])

  return (
    <>
      {/* Boot ladder rung 3: React has rendered at least once.
          Present from the very first render (even before engine loads),
          so e2e helpers can distinguish "React never mounted" from
          "WASM init hung". */}
      <div data-testid="react-mounted" style={{ display: 'none' }} />

      {error && <EngineFatalError error={error} onRetry={handleRetry} />}

      <WindowManagerProvider>
        <SettingsModalProvider>
          {engine && (
            <EngineContext.Provider value={engine}>
              {/* Boot ladder rung 4: WASM engine is ready. */}
              <div data-testid="engine-ready" style={{ display: 'none' }} />
              <App />
            </EngineContext.Provider>
          )}
        </SettingsModalProvider>
        <WindowDock />
      </WindowManagerProvider>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <Root />
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
