import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/config'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ToastProvider } from './components/ui/Toast.tsx'

// ── Boot guard ─────────────────────────────────────────────────────────────────
// Catches fatal errors that occur before React mounts (import failures, script
// errors, etc.) and shows a visible error screen instead of a blank page.

let reactMounted = false

function showBootError(message: string) {
  if (reactMounted) return // React ErrorBoundary handles post-mount errors
  const root = document.getElementById('root')
  if (!root) return
  root.innerHTML = [
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;',
    'padding:2rem;font-family:system-ui,sans-serif;background:#1a1a1a;color:#f87171;text-align:center">',
    '<div style="max-width:480px">',
    '<h2 style="margin:0 0 0.75rem">Something went wrong during startup</h2>',
    '<p style="opacity:0.7;font-size:0.9rem;word-break:break-word">',
    message.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    '</p>',
    '<p style="opacity:0.4;font-size:0.75rem;margin-top:1rem">',
    'Check browser DevTools (F12 → Console) for details.</p>',
    '<button onclick="location.reload()" style="margin-top:1.5rem;padding:0.5rem 1.25rem;',
    'border-radius:8px;border:none;background:#646cff;color:#fff;font-weight:600;cursor:pointer">',
    'Reload page</button>',
    '</div></div>',
  ].join('')
}

window.addEventListener('error', (e) => showBootError(e.message))
window.addEventListener('unhandledrejection', (e) =>
  showBootError((e as PromiseRejectionEvent).reason?.message ?? String(e)),
)

// ── Mount React ─────────────────────────────────────────────────────────────────

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
  reactMounted = true
} catch (err) {
  showBootError(err instanceof Error ? err.message : 'Unknown boot error')
}
