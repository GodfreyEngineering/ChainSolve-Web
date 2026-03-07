import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom'
import Login from './pages/Login'
import { SettingsRedirect } from './components/SettingsRedirect'
import { isDiagnosticsUIEnabled } from './lib/devFlags'
import { RouteSkeleton } from './components/ui/RouteSkeleton'

// Lazy-load WorkspacePage (unified single-page workspace)
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'))

// Lazy-load diagnostics page so it is not included in the main bundle for
// production users unless VITE_DIAGNOSTICS_UI_ENABLED=true.
const DiagnosticsPage = lazy(() => import('./pages/DiagnosticsPage'))

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

/** Redirect legacy /canvas/:projectId → /app/:projectId */
function CanvasRedirect() {
  const { projectId } = useParams<{ projectId: string }>()
  return <Navigate to={`/app/${projectId}`} replace />
}

/** Redirect /explore* → /app?tab=explore */
function ExploreRedirect() {
  return <Navigate to="/app?tab=explore" replace />
}

/** Redirect /canvas (scratch) → /app?scratch=1 */
function ScratchRedirect() {
  const [params] = useSearchParams()
  const qs = params.toString()
  return <Navigate to={`/app?scratch=1${qs ? `&${qs}` : ''}`} replace />
}

/** Catch-all 404 page for unmatched routes */
function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 400, padding: '2rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '0.5rem', opacity: 0.3 }}>404</div>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.4rem' }}>Page not found</h1>
        <p style={{ opacity: 0.6, margin: '0 0 1.5rem', fontSize: '0.9rem' }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <a
          href="/app"
          style={{
            display: 'inline-block',
            padding: '0.65rem 1.5rem',
            background: 'var(--primary)',
            color: 'var(--color-on-primary)',
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
      <Route path="/settings" element={<SettingsRedirect />} />
      <Route path="/billing/success" element={<BillingSuccess />} />
      <Route path="/billing/cancel" element={<BillingCancel />} />
      <Route
        path="/docs"
        element={
          <Suspense fallback={<RouteSkeleton variant="minimal" />}>
            <DocsPage />
          </Suspense>
        }
      />
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
      {/* Legacy redirects */}
      <Route path="/canvas" element={<ScratchRedirect />} />
      <Route path="/canvas/:projectId" element={<CanvasRedirect />} />
      <Route path="/explore" element={<ExploreRedirect />} />
      <Route path="/explore/*" element={<ExploreRedirect />} />
      <Route path="/marketplace" element={<ExploreRedirect />} />
      <Route path="/marketplace/*" element={<ExploreRedirect />} />
      {/* Catch-all 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
