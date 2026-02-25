import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import AppShell from './pages/AppShell'
import CanvasPage from './pages/CanvasPage'
import Settings from './pages/Settings'

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
        <Route path="/settings" element={<Settings />} />
        <Route path="/billing/success" element={<BillingSuccess />} />
        <Route path="/billing/cancel" element={<BillingCancel />} />
      </Routes>
    </BrowserRouter>
  )
}
