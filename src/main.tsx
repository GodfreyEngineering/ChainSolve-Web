/* eslint-disable react-refresh/only-export-components */

// ── 1. Sentry must initialise before ALL other imports ──────────────────────
import './instrument'

import { StrictMode, useCallback, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/config'
import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

import { installResizeObserverErrorSuppressor } from './lib/suppressResizeObserverError'
import { initObservability } from './observability/client'
import { getCookieConsent } from './lib/cookieConsent'
import { POSTHOG_KEY, POSTHOG_HOST } from './lib/env'
import App from './App'

// ── 2. Console error capture for feedback widget pre-population ─────────────
declare global {
  interface Window {
    __lastConsoleError?: string
  }
}
const _origConsoleError = console.error.bind(console)
console.error = (...args: unknown[]) => {
  try {
    window.__lastConsoleError = args
      .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' ')
  } catch {
    // best-effort
  }
  _origConsoleError(...args)
}

// ── 3. Suppress benign ResizeObserver loop errors ───────────────────────────
// G0-4: BEFORE observability installs its error handler.
try {
  installResizeObserverErrorSuppressor()
} catch {
  // intentionally swallowed
}

// ── 4. Initialise PostHog ───────────────────────────────────────────────────
const cookieConsent = getCookieConsent()
try {
  if (POSTHOG_KEY && cookieConsent !== 'declined') {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST || 'https://eu.i.posthog.com',
      persistence: 'memory', // GDPR-safe: no cookie written without consent
      autocapture: false, // Intentional tracking only for an engineering tool
      capture_pageview: false, // Handled by PageViewTracker component
      loaded: (ph) => {
        if (import.meta.env.DEV) ph.debug()
        if (!import.meta.env.PROD) ph.opt_out_capturing()
      },
    })
  }
} catch {
  // PostHog must never prevent the app from booting
}

// ── 5. Observability pipeline (custom error handlers) ───────────────────────
try {
  initObservability()
} catch {
  // intentionally swallowed
}

// ── 6. Apply persisted custom theme (D8-2) before first render ──────────────
import { applyPersistedCustomTheme } from './lib/customThemes'
try {
  applyPersistedCustomTheme()
} catch {
  // intentionally swallowed
}

// ── 7. Remaining imports ────────────────────────────────────────────────────
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeProvider } from './components/ThemeProvider'
import { ToastProvider } from './components/ui/Toast'
import { EngineFatalError } from './components/EngineFatalError'
import { SettingsModalProvider } from './components/SettingsModalProvider'
import { WindowManagerProvider } from './contexts/WindowManagerContext'
import { PanelLayoutProvider } from './contexts/PanelLayoutContext'
import { WindowDock } from './components/ui/WindowDock'
import { EngineContext } from './contexts/EngineContext'
import { WorkerPoolContext } from './contexts/WorkerPoolContext'
import { createEngine, type EngineAPI } from './engine/index'
import { createWorkerPool, type WorkerPoolAPI } from './engine/workerPool'
import { BrowserRouter } from 'react-router-dom'
import { LoadingScreen } from './components/ui/LoadingScreen'
import { OfflineBanner } from './components/OfflineBanner'
import { CookieConsentBanner } from './components/CookieConsent'
import { registerServiceWorker, captureInstallPrompt } from './lib/serviceWorker'
import { initWebVitals } from './observability/webVitals'
import { useCanvasAppearance } from './hooks/useCanvasAppearance'
import { PageViewTracker } from './components/analytics/PageViewTracker'

// UI-PERF-04: Register service worker for offline support and asset caching.
// When a new SW is waiting (new deployment detected), reload automatically so
// the user always gets the latest version. The reload only happens when the
// new SW explicitly enters "waiting" state — not mid-session — because the new
// SW no longer calls skipWaiting() on install.
registerServiceWorker((activate) => {
  activate()
}).catch(() => {})
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
        // initial JS bundle. Domain block packs + search metadata load here,
        // after WASM init, keeping them out of the initial closure.
        const [{ validateCatalog }, { registerAllBlocks }] = await Promise.all([
          import('./blocks/registry'),
          import('./blocks/registerAllBlocks'),
        ])
        registerAllBlocks()
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

  // ENG-04: Dispose worker pool on page unload to terminate all Web Workers
  useEffect(() => {
    if (!pool) return
    const handler = () => pool.dispose()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [pool])

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
      {/* 7.07: Cookie consent banner — shown on first visit */}
      <CookieConsentBanner />

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
        <PageViewTracker />
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

createRoot(document.getElementById('root')!, {
  // DEV-04: Report uncaught errors to Sentry with rich React context
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <PostHogProvider client={posthog}>
            <Root />
          </PostHogProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
