/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useCallback, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/config'
import { installResizeObserverErrorSuppressor } from './lib/suppressResizeObserverError'
import { initObservability } from './observability/client'
import App from './App.tsx'

// G0-4: Suppress benign ResizeObserver loop errors BEFORE observability
// installs its error handler, so the noise never reaches error reporting.
try {
  installResizeObserverErrorSuppressor()
} catch {
  // intentionally swallowed
}

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
import { PanelLayoutProvider } from './contexts/PanelLayoutContext.tsx'
import { WindowDock } from './components/ui/WindowDock.tsx'
import { EngineContext } from './contexts/EngineContext.ts'
import { WorkerPoolContext } from './contexts/WorkerPoolContext.ts'
import { createEngine, type EngineAPI } from './engine/index.ts'
import { createWorkerPool, type WorkerPoolAPI } from './engine/workerPool.ts'
import { validateCatalog } from './blocks/registry'
import { BrowserRouter } from 'react-router-dom'
import { LoadingScreen } from './components/ui/LoadingScreen.tsx'

function Root() {
  const [engine, setEngine] = useState<EngineAPI | null>(null)
  const [pool, setPool] = useState<WorkerPoolAPI | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    // Create a new pool on each retry; dispose old one if it exists.
    const newPool = createWorkerPool()

    createEngine()
      .then((eng) => {
        if (cancelled) {
          eng.dispose()
          newPool.dispose()
          return
        }
        validateCatalog(eng.catalog)
        ;(window as unknown as Record<string, unknown>).__chainsolve_engine = eng
        console.info('[engine] WASM engine ready, version:', eng.engineVersion)
        setEngine(eng)
        setPool(newPool)
      })
      .catch((err: unknown) => {
        newPool.dispose()
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
    setPool(null)
    setRetryCount((c) => c + 1)
  }, [])

  return (
    <>
      {/* Phase 13: Skip-to-content for keyboard accessibility */}
      <a href="#cs-main-content" className="cs-skip-link">
        Skip to content
      </a>

      {/* Boot ladder rung 3: React has rendered at least once.
          Present from the very first render (even before engine loads),
          so e2e helpers can distinguish "React never mounted" from
          "WASM init hung". */}
      <div data-testid="react-mounted" style={{ display: 'none' }} />

      {error && <EngineFatalError error={error} onRetry={handleRetry} />}

      {!error && !engine && <LoadingScreen />}

      <BrowserRouter>
        <WindowManagerProvider>
          <PanelLayoutProvider>
            <SettingsModalProvider>
              {engine && pool && (
                <EngineContext.Provider value={engine}>
                  <WorkerPoolContext.Provider value={pool}>
                    {/* Boot ladder rung 4: WASM engine is ready. */}
                    <div data-testid="engine-ready" style={{ display: 'none' }} />
                    <App />
                  </WorkerPoolContext.Provider>
                </EngineContext.Provider>
              )}
            </SettingsModalProvider>
            <WindowDock />
          </PanelLayoutProvider>
        </WindowManagerProvider>
      </BrowserRouter>
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
