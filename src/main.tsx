import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/config'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ToastProvider } from './components/ui/Toast.tsx'
import { createEngine } from './engine/index.ts'

// Initialize the WASM compute engine (non-blocking).
// Exposed on window for e2e tests and debugging.
createEngine()
  .then((engine) => {
    ;(window as unknown as Record<string, unknown>).__chainsolve_engine = engine
    console.info('[engine] WASM engine ready')
  })
  .catch((err: unknown) => {
    console.warn(
      '[engine] WASM engine unavailable, TS engine remains active:',
      err,
    )
  })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)
