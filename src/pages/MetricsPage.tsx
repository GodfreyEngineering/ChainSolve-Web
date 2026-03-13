/**
 * MetricsPage — Admin-only RUM metrics dashboard (/admin/metrics).
 *
 * Shows P50/P95 latency for project_open, save, engine_eval, canvas_switch
 * and Core Web Vitals (LCP, CLS, INP) over the last 7 days.
 *
 * Only accessible to is_admin users. Redirects to /app for non-admins.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  adminSearchUsers,
  adminGetUser,
  adminOverridePlan,
  adminResetPassword,
  adminToggleDisabled,
} from '../lib/adminService'

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

      {/* 7.08: User management section */}
      <AdminUserManagement />
    </div>
  )
}

// ── 7.08: Admin User Management ─────────────────────────────────────────────

interface UserSummary {
  id: string
  display_name: string | null
  email: string | null
  plan: string
  is_admin: boolean
  is_developer: boolean
  is_student: boolean
  created_at: string
}

interface UserDetail {
  profile: Record<string, unknown>
  email: string | null
  email_confirmed: boolean
  last_sign_in: string | null
  projects: Array<{
    id: string
    name: string
    created_at: string
    updated_at: string
    is_public: boolean
  }>
}

function AdminUserManagement() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<UserSummary[]>([])
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [planOverride, setPlanOverride] = useState('')

  const handleSearch = useCallback(async () => {
    if (searchQuery.trim().length < 2) return
    setSearching(true)
    setActionMsg(null)
    setSelectedUser(null)
    setSelectedId(null)
    try {
      const users = await adminSearchUsers(searchQuery.trim())
      setResults(users)
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Search failed')
    }
    setSearching(false)
  }, [searchQuery])

  const handleSelectUser = useCallback(async (userId: string) => {
    setSelectedId(userId)
    setActionMsg(null)
    try {
      const detail = await adminGetUser(userId)
      setSelectedUser(detail)
      setPlanOverride((detail.profile.plan as string) ?? 'free')
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Failed to load user')
    }
  }, [])

  const handleOverridePlan = useCallback(async () => {
    if (!selectedId || !planOverride) return
    try {
      await adminOverridePlan(selectedId, planOverride)
      setActionMsg(`Plan set to ${planOverride}`)
      // Refresh user detail
      const detail = await adminGetUser(selectedId)
      setSelectedUser(detail)
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Override failed')
    }
  }, [selectedId, planOverride])

  const handleResetPassword = useCallback(async () => {
    if (!selectedId) return
    try {
      await adminResetPassword(selectedId)
      setActionMsg('Password reset email sent')
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Reset failed')
    }
  }, [selectedId])

  const handleToggleDisabled = useCallback(
    async (disabled: boolean) => {
      if (!selectedId) return
      try {
        await adminToggleDisabled(selectedId, disabled)
        setActionMsg(disabled ? 'Account disabled' : 'Account enabled')
      } catch (err) {
        setActionMsg(err instanceof Error ? err.message : 'Toggle failed')
      }
    },
    [selectedId],
  )

  return (
    <div style={{ marginTop: '3rem' }}>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1.2rem' }}>User Management</h2>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <input
          style={searchInput}
          placeholder="Search by email or display name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSearch()
          }}
        />
        <button style={adminBtn} onClick={() => void handleSearch()} disabled={searching}>
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Results list */}
      {results.length > 0 && (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>User</th>
              <th style={th}>Plan</th>
              <th style={th}>Joined</th>
              <th style={th}>Roles</th>
            </tr>
          </thead>
          <tbody>
            {results.map((u) => (
              <tr
                key={u.id}
                style={{
                  ...trStyle,
                  cursor: 'pointer',
                  background: selectedId === u.id ? 'rgba(99,102,241,0.1)' : undefined,
                }}
                onClick={() => void handleSelectUser(u.id)}
              >
                <td style={td}>
                  <div style={{ fontWeight: 500 }}>{u.display_name ?? '(no name)'}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{u.email ?? u.id}</div>
                </td>
                <td style={td}>
                  <span style={planBadge}>{u.plan}</span>
                </td>
                <td style={{ ...td, fontSize: '0.78rem', opacity: 0.6 }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td style={{ ...td, fontSize: '0.78rem' }}>
                  {[u.is_admin && 'admin', u.is_developer && 'dev', u.is_student && 'student']
                    .filter(Boolean)
                    .join(', ') || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* User detail panel */}
      {selectedUser && selectedId && (
        <div style={detailPanel}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>
            {(selectedUser.profile.display_name as string) ?? 'User'} — {selectedUser.email}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
            <div>
              <strong>Plan:</strong> {selectedUser.profile.plan as string}
            </div>
            <div>
              <strong>Email confirmed:</strong> {selectedUser.email_confirmed ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Last sign in:</strong>{' '}
              {selectedUser.last_sign_in
                ? new Date(selectedUser.last_sign_in).toLocaleString()
                : 'Never'}
            </div>
            <div>
              <strong>Projects:</strong> {selectedUser.projects.length}
            </div>
          </div>

          {/* Projects list */}
          {selectedUser.projects.length > 0 && (
            <details style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                Projects ({selectedUser.projects.length})
              </summary>
              <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0, fontSize: '0.78rem' }}>
                {selectedUser.projects.slice(0, 20).map((p) => (
                  <li key={p.id} style={{ marginBottom: 4 }}>
                    {p.name} {p.is_public ? '(public)' : ''} —{' '}
                    {new Date(p.updated_at).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              style={searchInput}
              value={planOverride}
              onChange={(e) => setPlanOverride(e.target.value)}
              title="Override plan"
            >
              <option value="free">free</option>
              <option value="trialing">trialing</option>
              <option value="pro">pro</option>
              <option value="student">student</option>
              <option value="enterprise">enterprise</option>
              <option value="developer">developer</option>
            </select>
            <button style={adminBtn} onClick={() => void handleOverridePlan()}>
              Override plan
            </button>
            <button style={adminBtn} onClick={() => void handleResetPassword()}>
              Send password reset
            </button>
            <button
              style={{ ...adminBtn, borderColor: '#f87171', color: '#f87171' }}
              onClick={() => void handleToggleDisabled(true)}
            >
              Disable
            </button>
            <button style={adminBtn} onClick={() => void handleToggleDisabled(false)}>
              Enable
            </button>
          </div>

          {actionMsg && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--primary)' }}>
              {actionMsg}
            </div>
          )}
        </div>
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

const searchInput: React.CSSProperties = {
  padding: '0.4rem 0.75rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--bg)',
  color: 'inherit',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
  flex: 1,
  minWidth: 200,
}

const adminBtn: React.CSSProperties = {
  padding: '0.4rem 1rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'transparent',
  color: 'inherit',
  fontWeight: 600,
  fontSize: '0.82rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  flexShrink: 0,
}

const planBadge: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.15rem 0.5rem',
  borderRadius: 4,
  background: 'rgba(99,102,241,0.15)',
  color: 'var(--primary)',
  fontSize: '0.75rem',
  fontWeight: 600,
}

const detailPanel: React.CSSProperties = {
  marginTop: '1rem',
  padding: '1.25rem',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface-1)',
}
