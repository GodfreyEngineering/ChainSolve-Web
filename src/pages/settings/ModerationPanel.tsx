/**
 * ModerationPanel — K5-1: Admin/developer moderation panel for content reports.
 *
 * Shows pending user reports (display names, avatars, comments, marketplace items)
 * and allows resolving or dismissing each report. Only accessible to users with
 * is_admin or is_developer flag.
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  listPendingReports,
  resolveReport,
  dismissReport,
  type UserReport,
} from '../../lib/userReportsService'

const TARGET_TYPE_KEYS: Record<string, string> = {
  display_name: 'moderation.typeDisplayName',
  avatar: 'moderation.typeAvatar',
  comment: 'moderation.typeComment',
  marketplace_item: 'moderation.typeMarketplaceItem',
}

export function ModerationPanel() {
  const { t } = useTranslation()

  const [reports, setReports] = useState<UserReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listPendingReports()
      setReports(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchReports()
  }, [fetchReports])

  const handleResolve = useCallback(async (id: string) => {
    setActionLoading(id)
    try {
      await resolveReport(id)
      setReports((prev) => prev.filter((r) => r.id !== id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionLoading(null)
    }
  }, [])

  const handleDismiss = useCallback(async (id: string) => {
    setActionLoading(id)
    try {
      await dismissReport(id)
      setReports((prev) => prev.filter((r) => r.id !== id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionLoading(null)
    }
  }, [])

  return (
    <div>
      <h2 style={headingStyle}>{t('moderation.title')}</h2>
      <p style={descStyle}>{t('moderation.description')}</p>

      {error && (
        <div style={errorBanner} role="alert">
          {error}
        </div>
      )}

      {loading && <p style={mutedText}>{t('ui.loading')}</p>}

      {!loading && reports.length === 0 && <p style={mutedText}>{t('moderation.noReports')}</p>}

      {!loading &&
        reports.map((report) => (
          <div key={report.id} style={cardStyle}>
            <div style={cardHeader}>
              <span style={typeBadge}>
                {t(TARGET_TYPE_KEYS[report.target_type] ?? report.target_type)}
              </span>
              <span style={dateText}>{formatDate(report.created_at)}</span>
            </div>

            <div style={fieldRow}>
              <span style={fieldLabel}>{t('moderation.targetId')}</span>
              <span style={fieldValue}>{report.target_id}</span>
            </div>

            <div style={fieldRow}>
              <span style={fieldLabel}>{t('moderation.reporter')}</span>
              <span style={fieldValue}>{report.reporter_id}</span>
            </div>

            <div style={reasonBox}>
              <span style={fieldLabel}>{t('moderation.reason')}</span>
              <p style={reasonText}>{report.reason}</p>
            </div>

            <div style={actionRow}>
              <button
                style={resolveBtn}
                onClick={() => void handleResolve(report.id)}
                disabled={actionLoading === report.id}
              >
                {actionLoading === report.id ? t('moderation.processing') : t('moderation.resolve')}
              </button>
              <button
                style={dismissBtn}
                onClick={() => void handleDismiss(report.id)}
                disabled={actionLoading === report.id}
              >
                {t('moderation.dismiss')}
              </button>
            </div>
          </div>
        ))}

      {!loading && reports.length > 0 && (
        <p style={countText}>{t('moderation.pendingCount', { count: reports.length })}</p>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ── Styles ──────────────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  margin: '0 0 0.35rem',
  fontSize: '1.15rem',
  fontWeight: 700,
}

const descStyle: React.CSSProperties = {
  margin: '0 0 1.25rem',
  fontSize: '0.85rem',
  color: 'var(--text-muted)',
  lineHeight: 1.5,
}

const errorBanner: React.CSSProperties = {
  padding: '0.6rem 0.85rem',
  borderRadius: 8,
  background: 'rgba(239,68,68,0.08)',
  border: '1px solid rgba(239,68,68,0.25)',
  color: '#f87171',
  fontSize: '0.85rem',
  marginBottom: '1rem',
}

const mutedText: React.CSSProperties = {
  fontSize: '0.88rem',
  color: 'var(--text-faint)',
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '1rem',
  marginBottom: '0.75rem',
  background: 'var(--card-bg)',
}

const cardHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.75rem',
}

const typeBadge: React.CSSProperties = {
  padding: '0.15rem 0.6rem',
  borderRadius: 12,
  fontSize: '0.75rem',
  fontWeight: 600,
  background: 'rgba(59,130,246,0.12)',
  color: 'var(--primary-text)',
}

const dateText: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-faint)',
}

const fieldRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.25rem 0',
  fontSize: '0.82rem',
}

const fieldLabel: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.78rem',
  fontWeight: 600,
}

const fieldValue: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.72rem',
  color: 'var(--text-faint)',
  maxWidth: '60%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const reasonBox: React.CSSProperties = {
  marginTop: '0.5rem',
  padding: '0.5rem 0.7rem',
  borderRadius: 6,
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
}

const reasonText: React.CSSProperties = {
  margin: '0.25rem 0 0',
  fontSize: '0.82rem',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
}

const actionRow: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  marginTop: '0.75rem',
  justifyContent: 'flex-end',
}

const resolveBtn: React.CSSProperties = {
  padding: '0.35rem 0.85rem',
  borderRadius: 6,
  border: 'none',
  background: 'var(--primary)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.78rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const dismissBtn: React.CSSProperties = {
  padding: '0.35rem 0.85rem',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontWeight: 600,
  fontSize: '0.78rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const countText: React.CSSProperties = {
  fontSize: '0.78rem',
  color: 'var(--text-faint)',
  marginTop: '0.5rem',
  textAlign: 'right',
}
