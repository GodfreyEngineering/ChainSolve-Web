import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import Login from './pages/Login'
import { SettingsRedirect } from './components/SettingsRedirect'
import { isDiagnosticsUIEnabled } from './lib/devFlags'
import { RouteSkeleton } from './components/ui/RouteSkeleton'

// Lazy-load WorkspacePage (unified single-page workspace)
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'))

// CanvasPage still used for legacy /canvas scratch route
const CanvasPage = lazy(() => import('./pages/CanvasPage'))

// Lazy-load diagnostics page so it is not included in the main bundle for
// production users unless VITE_DIAGNOSTICS_UI_ENABLED=true.
const DiagnosticsPage = lazy(() => import('./pages/DiagnosticsPage'))

// Lazy-load Explore (formerly marketplace) pages (not needed on initial load)
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'))
const ItemDetailPage = lazy(() => import('./pages/ItemDetailPage'))
const MarketplaceAuthorPage = lazy(() => import('./pages/MarketplaceAuthorPage'))

// Lazy-load Terms and Privacy pages (not needed on initial load)
const TermsPage = lazy(() => import('./pages/TermsPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))

// Lazy-load docs page (public, not needed on initial load)
const DocsPage = lazy(() => import('./pages/DocsPage'))

// Lazy-load org pages (not needed on initial load)
const OrgsPage = lazy(() => import('./pages/OrgsPage'))
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'))

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
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }} aria-hidden="true">
          {'\u2713'}
        </div>
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

function CanvasRedirect() {
  const { projectId } = useParams<{ projectId: string }>()
  return <Navigate to={`/app/${projectId}`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<Login initialMode="login" />} />
      <Route path="/signup" element={<Login initialMode="signup" />} />
      <Route path="/reset-password" element={<Login initialMode="reset" />} />
      <Route
        path="/terms"
        element={
          <Suspense fallback={<RouteSkeleton variant="minimal" />}>
            <TermsPage />
          </Suspense>
        }
      />
      <Route
        path="/privacy"
        element={
          <Suspense fallback={<RouteSkeleton variant="minimal" />}>
            <PrivacyPage />
          </Suspense>
        }
      />
      <Route
        path="/app"
        element={
          <Suspense fallback={<RouteSkeleton variant="page" />}>
            <WorkspacePage />
          </Suspense>
        }
      />
      <Route
        path="/app/:projectId"
        element={
          <Suspense fallback={<RouteSkeleton variant="page" />}>
            <WorkspacePage />
          </Suspense>
        }
      />
      {/* Legacy scratch canvas — kept for backward compat + e2e tests */}
      <Route
        path="/canvas"
        element={
          <Suspense fallback={<RouteSkeleton variant="page" />}>
            <CanvasPage />
          </Suspense>
        }
      />
      {/* Legacy project canvas routes redirect to workspace */}
      <Route path="/canvas/:projectId" element={<CanvasRedirect />} />
      <Route path="/settings" element={<SettingsRedirect />} />
      <Route path="/billing/success" element={<BillingSuccess />} />
      <Route path="/billing/cancel" element={<BillingCancel />} />
      <Route
        path="/explore"
        element={
          <Suspense fallback={<RouteSkeleton variant="page" />}>
            <MarketplacePage />
          </Suspense>
        }
      />
      <Route
        path="/explore/items/:itemId"
        element={
          <Suspense fallback={<RouteSkeleton variant="page" />}>
            <ItemDetailPage />
          </Suspense>
        }
      />
      <Route
        path="/explore/author"
        element={
          <Suspense fallback={<RouteSkeleton variant="page" />}>
            <MarketplaceAuthorPage />
          </Suspense>
        }
      />
      <Route
        path="/docs"
        element={
          <Suspense fallback={<RouteSkeleton variant="minimal" />}>
            <DocsPage />
          </Suspense>
        }
      />
      {/* Legacy marketplace routes redirect to explore */}
      <Route path="/marketplace" element={<Navigate to="/explore" replace />} />
      <Route path="/marketplace/*" element={<Navigate to="/explore" replace />} />
      <Route
        path="/orgs"
        element={
          <Suspense fallback={<RouteSkeleton variant="page" />}>
            <OrgsPage />
          </Suspense>
        }
      />
      <Route
        path="/audit-log"
        element={
          <Suspense fallback={<RouteSkeleton variant="page" />}>
            <AuditLogPage />
          </Suspense>
        }
      />
      {isDiagnosticsUIEnabled() && (
        <Route
          path="/diagnostics"
          element={
            <Suspense fallback={<RouteSkeleton variant="page" />}>
              <DiagnosticsPage />
            </Suspense>
          }
        />
      )}
    </Routes>
  )
}
