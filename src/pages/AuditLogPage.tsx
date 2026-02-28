/**
 * AuditLogPage — P127: Audit log viewer (enterprise-only).
 *
 * Route: /audit-log
 *
 * Entitlement-gated: requires Pro plan (isPro check on user's profile).
 * Shows a read-only, paginated table of audit events newest-first.
 * Supports filtering by own events vs. org events.
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getAuditLog, type AuditLogEntry } from '../lib/auditLogService'
import { getProfile } from '../lib/profilesService'
import { getCurrentUser } from '../lib/auth'
import { isPro } from '../lib/entitlements'

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg, #1a1a1a)',
    color: 'var(--fg, #F4F4F3)',
    fontFamily: 'system-ui, sans-serif',
  } satisfies React.CSSProperties,
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0 1.5rem',
    height: 56,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    background: 'var(--card-bg, #252525)',
  } satisfies React.CSSProperties,
  body: {
    maxWidth: 1000,
    margin: '0 auto',
    padding: '2rem 1.5rem',
  } satisfies React.CSSProperties,
  card: {
    background: 'var(--card-bg, #252525)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '1.25rem',
    marginBottom: '1.5rem',
  } satisfies React.CSSProperties,
  upgradeBox: {
    textAlign: 'center' as const,
    padding: '3rem 2rem',
  } satisfies React.CSSProperties,
  filterRow: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
    flexWrap: 'wrap' as const,
  } satisfies React.CSSProperties,
  filterBtn: (active: boolean): React.CSSProperties => ({
    padding: '0.35rem 0.85rem',
    borderRadius: 20,
    border: active ? '1px solid #1CABB0' : '1px solid rgba(255,255,255,0.12)',
    background: active ? 'rgba(28,171,176,0.15)' : 'transparent',
    color: active ? '#1CABB0' : 'rgba(244,244,243,0.6)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }),
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '0.84rem',
  } satisfies React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(244,244,243,0.5)',
    fontWeight: 600,
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } satisfies React.CSSProperties,
  td: {
    padding: '0.55rem 0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    verticalAlign: 'top' as const,
  } satisfies React.CSSProperties,
  eventBadge: {
    display: 'inline-block',
    padding: '0.1rem 0.45rem',
    borderRadius: 4,
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    background: 'rgba(28,171,176,0.1)',
    color: '#1CABB0',
  } satisfies React.CSSProperties,
  idCell: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    opacity: 0.55,
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } satisfies React.CSSProperties,
  muted: {
    opacity: 0.5,
    fontSize: '0.88rem',
  } satisfies React.CSSProperties,
  error: {
    color: '#ef4444',
    fontSize: '0.82rem',
  } satisfies React.CSSProperties,
  primaryBtn: {
    padding: '0.55rem 1.25rem',
    borderRadius: 8,
    border: 'none',
    background: '#1CABB0',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } satisfies React.CSSProperties,
  ghostBtn: {
    padding: '0.45rem 1rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: 'rgba(244,244,243,0.7)',
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } satisfies React.CSSProperties,
}

// ── Component ─────────────────────────────────────────────────────────────────

type FilterMode = 'user' | 'org'

export default function AuditLogPage() {
  const { t } = useTranslation()

  const [allowed, setAllowed] = useState<boolean | null>(null) // null = loading
  const [userId, setUserId] = useState<string | null>(null)

  const [filterMode, setFilterMode] = useState<FilterMode>('user')
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Auth + entitlement check ───────────────────────────────────────────────

  useEffect(() => {
    async function checkAccess() {
      const user = await getCurrentUser()
      if (!user) {
        setAllowed(false)
        return
      }
      setUserId(user.id)
      const profile = await getProfile(user.id)
      setAllowed(profile !== null && isPro(profile.plan))
    }
    void checkAccess()
  }, [])

  // ── Load entries ───────────────────────────────────────────────────────────

  const loadEntries = useCallback(
    async (reset: boolean, nextCursor: string | null) => {
      if (!userId) return
      setError(null)
      setLoadingMore(true)
      try {
        const opts =
          filterMode === 'user'
            ? { userId, cursor: nextCursor ?? undefined }
            : { cursor: nextCursor ?? undefined }
        const page = await getAuditLog({ ...opts, limit: 50 })
        setEntries((prev) => (reset ? page.entries : [...prev, ...page.entries]))
        setCursor(page.nextCursor)
        setHasMore(page.nextCursor !== null)
      } catch {
        setError(t('auditLog.errorLoad'))
      } finally {
        setLoadingMore(false)
      }
    },
    [userId, filterMode, t],
  )

  useEffect(() => {
    if (allowed && userId) {
      setEntries([])
      setCursor(null)
      void loadEntries(true, null)
    }
  }, [allowed, userId, filterMode, loadEntries])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <div style={s.nav}>
        <a
          href="/app"
          style={{ color: 'rgba(244,244,243,0.6)', textDecoration: 'none', fontSize: '0.85rem' }}
        >
          ← {t('auditLog.backToApp')}
        </a>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{t('auditLog.title')}</span>
      </div>

      <div style={s.body}>
        {/* Loading entitlement check */}
        {allowed === null && <p style={s.muted}>{t('auditLog.loading')}</p>}

        {/* Upgrade gate */}
        {allowed === false && (
          <div style={{ ...s.card, ...s.upgradeBox }}>
            <p style={{ marginBottom: '1.25rem', opacity: 0.7 }}>{t('auditLog.proOnly')}</p>
            <a href="/app" style={s.primaryBtn}>
              {t('auditLog.upgrade')}
            </a>
          </div>
        )}

        {/* Viewer */}
        {allowed === true && (
          <div style={s.card}>
            {/* Filter tabs */}
            <div style={s.filterRow}>
              <button
                style={s.filterBtn(filterMode === 'user')}
                onClick={() => setFilterMode('user')}
                data-testid="filter-user"
              >
                {t('auditLog.filterUser')}
              </button>
              <button
                style={s.filterBtn(filterMode === 'org')}
                onClick={() => setFilterMode('org')}
                data-testid="filter-org"
              >
                {t('auditLog.filterOrg')}
              </button>
            </div>

            {error && <p style={s.error}>{error}</p>}

            {entries.length === 0 && !loadingMore && <p style={s.muted}>{t('auditLog.empty')}</p>}

            {entries.length > 0 && (
              <table style={s.table} data-testid="audit-table">
                <thead>
                  <tr>
                    <th style={s.th}>{t('auditLog.colTime')}</th>
                    <th style={s.th}>{t('auditLog.colEvent')}</th>
                    <th style={s.th}>{t('auditLog.colObject')}</th>
                    <th style={s.th}>{t('auditLog.colId')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} data-testid={`audit-row-${entry.id}`}>
                      <td style={s.td}>
                        <span style={{ ...s.muted, fontSize: '0.78rem' }}>
                          {formatTime(entry.created_at)}
                        </span>
                      </td>
                      <td style={s.td}>
                        <span style={s.eventBadge}>{entry.event_type}</span>
                      </td>
                      <td style={s.td}>{entry.object_type}</td>
                      <td style={{ ...s.td, ...s.idCell }} title={entry.object_id}>
                        {entry.object_id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {hasMore && (
              <div style={{ marginTop: '1rem', textAlign: 'center' as const }}>
                <button
                  style={s.ghostBtn}
                  onClick={() => void loadEntries(false, cursor)}
                  disabled={loadingMore}
                  data-testid="load-more-btn"
                >
                  {loadingMore ? t('auditLog.loading') : t('auditLog.loadMore')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
