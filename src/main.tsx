/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useCallback, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/config'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ToastProvider } from './components/ui/Toast.tsx'
import { EngineFatalError } from './components/EngineFatalError.tsx'
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

  if (error) {
    return <EngineFatalError error={error} onRetry={handleRetry} />
  }

  if (!engine) {
    return null // Brief flash while WASM loads (typically < 100ms)
  }

  return (
    <EngineContext.Provider value={engine}>
      <div data-testid="engine-ready" style={{ display: 'none' }} />
      <App />
    </EngineContext.Provider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <Root />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)
