/**
 * MetricsPage — Admin-only RUM metrics dashboard (/admin/metrics).
 *
 * Shows P50/P95 latency for project_open, save, engine_eval, canvas_switch
 * and Core Web Vitals (LCP, CLS, INP) over the last 7 days.
 *
 * Only accessible to is_admin users. Redirects to /app for non-admins.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface MetricRow {
  event_name: string
  count: number
  p50_ms: number
  p95_ms: number
  mean_ms: number
}

interface MetricsResponse {
  metrics: MetricRow[]
  since: string
  generated_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number, isUnitless?: boolean): string {
  if (isUnitless) return ms.toFixed(3)
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms}ms`
}

function ratingColor(name: string, p50: number): string {
  if (name.startsWith('vitals:CLS')) {
    return p50 < 0.1 ? '#34d399' : p50 < 0.25 ? '#fbbf24' : '#f87171'
  }
  if (name.startsWith('vitals:LCP')) {
    return p50 < 2500 ? '#34d399' : p50 < 4000 ? '#fbbf24' : '#f87171'
  }
  if (name.startsWith('vitals:INP')) {
    return p50 < 200 ? '#34d399' : p50 < 500 ? '#fbbf24' : '#f87171'
  }
  if (name.includes('engine_eval')) {
    return p50 < 50 ? '#34d399' : p50 < 200 ? '#fbbf24' : '#f87171'
  }
  // project_open / save
  return p50 < 1000 ? '#34d399' : p50 < 3000 ? '#fbbf24' : '#f87171'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MetricsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<MetricsResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session) {
          navigate('/login', { replace: true })
          return
        }

        const resp = await fetch('/api/admin/metrics', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        if (resp.status === 403) {
          if (!cancelled) navigate('/app', { replace: true })
          return
        }
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`)
        }

        const json = (await resp.json()) as MetricsResponse
        if (!cancelled) {
          setData(json)
          setLoading(false)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load metrics')
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [navigate])

  if (loading) {
    return (
      <div style={centeredStyle}>
        <span style={{ opacity: 0.5 }}>Loading metrics\u2026</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={centeredStyle}>
        <span style={{ color: '#f87171' }}>{error}</span>
      </div>
    )
  }

  const since = data ? new Date(data.since).toLocaleDateString() : ''
  const generatedAt = data ? new Date(data.generated_at).toLocaleString() : ''

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>RUM Metrics</h1>
          <p style={{ margin: '0.25rem 0 0', opacity: 0.5, fontSize: '0.82rem' }}>
            Last 7 days (since {since}) \u00b7 Generated {generatedAt}
          </p>
        </div>
        <a href="/app" style={backLink}>
          \u2190 Back to app
        </a>
      </div>

      {data && data.metrics.length === 0 && (
        <p style={{ opacity: 0.5 }}>No events recorded in the last 7 days.</p>
      )}

      {data && data.metrics.length > 0 && (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Event</th>
              <th style={{ ...th, textAlign: 'right' }}>Count</th>
              <th style={{ ...th, textAlign: 'right' }}>P50</th>
              <th style={{ ...th, textAlign: 'right' }}>P95</th>
              <th style={{ ...th, textAlign: 'right' }}>Mean</th>
            </tr>
          </thead>
          <tbody>
            {data.metrics.map((row) => {
              const isUnitless = row.event_name.startsWith('vitals:CLS')
              const color = ratingColor(row.event_name, row.p50_ms)
              return (
                <tr key={row.event_name} style={trStyle}>
                  <td style={td}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: color,
                        marginRight: 8,
                        flexShrink: 0,
                      }}
                    />
                    {row.event_name}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', opacity: 0.6 }}>
                    {row.count.toLocaleString()}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color }}>
                    {fmtMs(row.p50_ms, isUnitless)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>
                    {fmtMs(row.p95_ms, isUnitless)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', opacity: 0.7 }}>
                    {fmtMs(row.mean_ms, isUnitless)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const centeredStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const pageStyle: React.CSSProperties = {
  maxWidth: 800,
  margin: '0 auto',
  padding: '2rem 1.5rem',
  color: 'var(--text)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '1.5rem',
}

const backLink: React.CSSProperties = {
  color: 'var(--primary)',
  textDecoration: 'none',
  fontSize: '0.85rem',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.88rem',
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid var(--border)',
  opacity: 0.6,
  fontWeight: 600,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const td: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  verticalAlign: 'middle',
}

const trStyle: React.CSSProperties = {}
