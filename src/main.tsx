/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useCallback, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/config'
import { installResizeObserverErrorSuppressor } from './lib/suppressResizeObserverError'
import { initObservability } from './observability/client'
import * as Sentry from '@sentry/react'
import { SENTRY_DSN } from './lib/env.ts'
import App from './App.tsx'

// G0-4: Suppress benign ResizeObserver loop errors BEFORE observability
// installs its error handler, so the noise never reaches error reporting.
try {
  installResizeObserverErrorSuppressor()
} catch {
  // intentionally swallowed
}

// DEV-04: Initialise Sentry error tracking if a DSN is configured.
// Must run before any other error handlers so it captures boot-time errors.
try {
  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
      ignoreErrors: [
        // Benign browser noise — not actionable
        'ResizeObserver loop',
        // Expected when no session exists
        'AuthSessionMissingError',
        // User navigation / fetch cancellation
        'AbortError',
      ],
    })
  }
} catch {
  // intentionally swallowed — Sentry must never prevent the app from booting
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
import { BrowserRouter } from 'react-router-dom'
import { LoadingScreen } from './components/ui/LoadingScreen.tsx'
import { OfflineBanner } from './components/OfflineBanner.tsx'
import { registerServiceWorker, captureInstallPrompt } from './lib/serviceWorker.ts'
import { initWebVitals } from './observability/webVitals.ts'
import { useCanvasAppearance } from './hooks/useCanvasAppearance.ts'

// UI-PERF-04: Register service worker for offline support and asset caching.
// registerServiceWorker is safe to call regardless of SW support — it exits
// early on unsupported environments (HTTP, older browsers).
registerServiceWorker().catch(() => {})
// Capture the browser's beforeinstallprompt so the app can show a custom
// "Add to Home Screen" / PWA install button at a convenient moment.
captureInstallPrompt()
// UI-PERF-06: Track Core Web Vitals (LCP, CLS, INP). Gated by OBS_ENABLED.
initWebVitals()

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
      .then(async (eng) => {
        if (cancelled) {
          eng.dispose()
          newPool.dispose()
          return
        }
        // UI-PERF-05: Load the block registry lazily so it is excluded from the
        // initial JS bundle. The registry + all domain block files load here,
        // in parallel with WASM init, only after the engine is ready.
        const { validateCatalog } = await import('./blocks/registry')
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

  // THEME-02: Apply canvas appearance CSS variables from user preferences
  useCanvasAppearance()

  const handleRetry = useCallback(() => {
    setError(null)
    setEngine(null)
    setPool(null)
    setRetryCount((c) => c + 1)
  }, [])

  return (
    <>
      {/* UI-PERF-04: Persistent offline banner — visible when browser is offline or
          a save was queued while offline. */}
      <OfflineBanner />

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
