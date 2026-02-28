import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import AppShell from './pages/AppShell'
import CanvasPage from './pages/CanvasPage'
import { SettingsRedirect } from './components/SettingsRedirect'
import { isDiagnosticsUIEnabled } from './lib/devFlags'

// Lazy-load diagnostics page so it is not included in the main bundle for
// production users unless VITE_DIAGNOSTICS_UI_ENABLED=true.
const DiagnosticsPage = lazy(() => import('./pages/DiagnosticsPage'))

// Lazy-load marketplace pages (not needed on initial load)
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'))
const ItemDetailPage = lazy(() => import('./pages/ItemDetailPage'))
const MarketplaceAuthorPage = lazy(() => import('./pages/MarketplaceAuthorPage'))

function BillingSuccess() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
        <h1 style={{ margin: '0 0 0.5rem' }}>You&apos;re all set!</h1>
        <p style={{ opacity: 0.6, margin: '0 0 1.5rem' }}>
          Your subscription is now active. It may take a few seconds to reflect in your account.
        </p>
        <a
          href="/app"
          style={{
            display: 'inline-block',
            padding: '0.65rem 1.5rem',
            background: '#646cff',
            color: '#fff',
            borderRadius: '8px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Go to app
        </a>
      </div>
    </div>
  )
}

function BillingCancel() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem' }}>
        <h1 style={{ margin: '0 0 0.5rem' }}>Checkout cancelled</h1>
        <p style={{ opacity: 0.6, margin: '0 0 1.5rem' }}>
          No charge was made. You can upgrade any time from your account.
        </p>
        <a
          href="/app"
          style={{
            display: 'inline-block',
            padding: '0.65rem 1.5rem',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontWeight: 500,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          Back to app
        </a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<AppShell />} />
        <Route path="/canvas" element={<CanvasPage />} />
        <Route path="/canvas/:projectId" element={<CanvasPage />} />
        <Route path="/settings" element={<SettingsRedirect />} />
        <Route path="/billing/success" element={<BillingSuccess />} />
        <Route path="/billing/cancel" element={<BillingCancel />} />
        <Route
          path="/marketplace"
          element={
            <Suspense fallback={null}>
              <MarketplacePage />
            </Suspense>
          }
        />
        <Route
          path="/marketplace/items/:itemId"
          element={
            <Suspense fallback={null}>
              <ItemDetailPage />
            </Suspense>
          }
        />
        <Route
          path="/marketplace/author"
          element={
            <Suspense fallback={null}>
              <MarketplaceAuthorPage />
            </Suspense>
          }
        />
        {isDiagnosticsUIEnabled() && (
          <Route
            path="/diagnostics"
            element={
              <Suspense fallback={null}>
                <DiagnosticsPage />
              </Suspense>
            }
          />
        )}
      </Routes>
    </BrowserRouter>
  )
}
