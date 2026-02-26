/**
 * DiagnosticsPage — Gated diagnostics surface.
 *
 * Accessible at /diagnostics.
 *
 * Gating:
 *   - Development: always available.
 *   - Production: only if VITE_DIAGNOSTICS_UI_ENABLED=true AND
 *     localStorage 'cs_diag=1' (set by user explicitly).
 *
 * Features:
 *   - Session ID + app version + env
 *   - Last 20 captured errors
 *   - Doctor check results (run on demand)
 *   - Export diagnostics JSON (downloads file)
 *   - Send diagnostics to server
 */

import { useState, useCallback } from 'react'
import { BUILD_ENV, BUILD_SHA, BUILD_VERSION, BUILD_TIME } from '../lib/build-info'
import { isDiagnosticsUIEnabled } from '../lib/devFlags'
import { getErrorBuffer } from '../observability/client'
import { exportDiagnostics } from '../observability/diagnostics'
import { runDoctorChecks } from '../observability/doctor'
import type { DoctorCheck } from '../observability/types'
import type { ObsEvent } from '../observability/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSessionId(): string {
  try {
    const raw = localStorage.getItem('cs_obs_session_v1')
    if (raw) {
      const p = JSON.parse(raw) as { id?: string }
      return p.id ?? '—'
    }
  } catch {
    // ignore
  }
  return '—'
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh',
    background: '#1a1a1a',
    color: '#F4F4F3',
    padding: '2rem',
    fontFamily: 'system-ui, sans-serif',
  } satisfies React.CSSProperties,
  section: {
    maxWidth: '900px',
    margin: '0 auto 2rem',
    background: '#383838',
    borderRadius: '12px',
    padding: '1.5rem',
  } satisfies React.CSSProperties,
  h2: { margin: '0 0 1rem', fontSize: '1.1rem', color: '#1CABB0' } satisfies React.CSSProperties,
  kv: { display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem' } satisfies React.CSSProperties,
  key: { opacity: 0.5, minWidth: '140px' } satisfies React.CSSProperties,
  btn: {
    padding: '0.45rem 1rem',
    borderRadius: '8px',
    border: 'none',
    background: '#1CABB0',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    marginRight: '0.5rem',
    fontSize: '0.85rem',
  } satisfies React.CSSProperties,
  badge: (ok: boolean): React.CSSProperties => ({
    display: 'inline-block',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 700,
    background: ok ? '#1a3a1a' : '#3a1a1a',
    color: ok ? '#4ade80' : '#f87171',
    marginRight: '0.5rem',
  }),
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiagnosticsPage() {
  const [doctorResults, setDoctorResults] = useState<DoctorCheck[] | null>(null)
  const [doctorRunning, setDoctorRunning] = useState(false)
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const errors: readonly ObsEvent[] = getErrorBuffer()

  if (!isDiagnosticsUIEnabled()) {
    return (
      <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', opacity: 0.5 }}>
          <p>Diagnostics UI is not enabled in this environment.</p>
          <p style={{ fontSize: '0.8rem' }}>
            Set <code>localStorage.setItem(&apos;cs_diag&apos;, &apos;1&apos;)</code> and reload.
          </p>
        </div>
      </div>
    )
  }

  const handleRunDoctor = useCallback(async () => {
    setDoctorRunning(true)
    try {
      const results = await runDoctorChecks()
      setDoctorResults(results)
    } finally {
      setDoctorRunning(false)
    }
  }, [])

  const handleExport = useCallback(() => {
    const bundle = exportDiagnostics()
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    downloadJson(bundle, `chainsolve-diagnostics-${ts}.json`)
  }, [])

  const handleSend = useCallback(async () => {
    setSendStatus('sending')
    try {
      const bundle = exportDiagnostics()
      const body = JSON.stringify({
        event_id: crypto.randomUUID(),
        event_type: 'engine_diagnostics',
        ts: new Date().toISOString(),
        env: BUILD_ENV,
        app_version: BUILD_SHA,
        route_path: window.location.pathname,
        user_id: null,
        session_id: getSessionId(),
        ua: navigator.userAgent.slice(0, 500),
        cf: {},
        tags: {},
        payload: bundle,
      })
      const resp = await fetch('/api/report/client', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })
      setSendStatus(resp.ok ? 'sent' : 'error')
    } catch {
      setSendStatus('error')
    }
  }, [])

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ maxWidth: '900px', margin: '0 auto 2rem' }}>
        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.4rem' }}>Diagnostics</h1>
        <p style={{ margin: 0, opacity: 0.4, fontSize: '0.8rem' }}>
          Internal diagnostics surface — not visible to end users in production.
        </p>
      </div>

      {/* App info */}
      <section style={s.section}>
        <h2 style={s.h2}>App Info</h2>
        {[
          ['Session ID', getSessionId()],
          ['App version', BUILD_VERSION],
          ['Build SHA', BUILD_SHA],
          ['Build time', BUILD_TIME],
          ['Environment', BUILD_ENV],
          ['Route', window.location.pathname],
        ].map(([k, v]) => (
          <div key={k} style={s.kv}>
            <span style={s.key}>{k}</span>
            <span style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{v}</span>
          </div>
        ))}
      </section>

      {/* Doctor */}
      <section style={s.section}>
        <h2 style={s.h2}>Doctor Checks</h2>
        <button style={s.btn} onClick={() => void handleRunDoctor()} disabled={doctorRunning}>
          {doctorRunning ? 'Running…' : 'Run checks'}
        </button>
        {doctorResults && (
          <div style={{ marginTop: '1rem' }}>
            {doctorResults.map((r) => (
              <div key={r.name} style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                <span style={s.badge(r.ok)}>{r.ok ? 'PASS' : 'FAIL'}</span>
                <strong>{r.name}</strong>
                <span style={{ opacity: 0.6, marginLeft: '0.5rem' }}>{r.message}</span>
                <span style={{ opacity: 0.35, marginLeft: '0.5rem' }}>{r.durationMs}ms</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent errors */}
      <section style={s.section}>
        <h2 style={s.h2}>Recent Errors ({errors.length})</h2>
        {errors.length === 0 ? (
          <p style={{ opacity: 0.4, fontSize: '0.85rem', margin: 0 }}>No errors captured.</p>
        ) : (
          [...errors]
            .reverse()
            .slice(0, 20)
            .map((e) => (
              <div
                key={e.event_id}
                style={{
                  marginBottom: '0.75rem',
                  padding: '0.75rem',
                  background: '#2a2a2a',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: '#f87171', fontWeight: 600 }}>{e.event_type}</span>
                  <span style={{ opacity: 0.4 }}>{e.ts}</span>
                  <span style={{ opacity: 0.4 }}>{e.route_path}</span>
                </div>
                {'message' in (e.payload as unknown as Record<string, unknown>) && (
                  <div style={{ fontFamily: 'monospace', opacity: 0.8, wordBreak: 'break-all' }}>
                    {String((e.payload as unknown as Record<string, unknown>)['message'] ?? '')}
                  </div>
                )}
              </div>
            ))
        )}
      </section>

      {/* Export / Send */}
      <section style={s.section}>
        <h2 style={s.h2}>Diagnostics Bundle</h2>
        <button style={s.btn} onClick={handleExport}>
          Export JSON
        </button>
        <button style={{ ...s.btn, background: '#646cff' }} onClick={() => void handleSend()}>
          {sendStatus === 'sending' ? 'Sending…' : 'Send to server'}
        </button>
        {sendStatus === 'sent' && (
          <span style={{ color: '#4ade80', fontSize: '0.82rem' }}>Sent.</span>
        )}
        {sendStatus === 'error' && (
          <span style={{ color: '#f87171', fontSize: '0.82rem' }}>Send failed.</span>
        )}
        <p style={{ opacity: 0.4, fontSize: '0.78rem', marginTop: '0.75rem' }}>
          The diagnostics bundle contains app metadata, recent eval stats, and worker lifecycle
          events. It does NOT contain dataset contents, user-entered values, or secrets.
        </p>
      </section>
    </div>
  )
}
