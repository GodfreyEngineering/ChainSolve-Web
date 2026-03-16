/**
 * ShareDialog — manage share links for a project.
 *
 * Shows existing links, allows creating new ones with expiry picker, and revoking.
 */

import type { CSSProperties } from 'react'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createShareLink,
  listShareLinks,
  revokeShareLink,
  buildShareUrl,
  type ShareLink,
} from '../../lib/shareService'

interface ShareDialogProps {
  projectId: string
  onClose: () => void
}

/** Format a date as relative time (e.g. "2 hours ago", "in 5 days"). */
function formatRelativeTime(isoDate: string): string {
  const now = Date.now()
  const target = new Date(isoDate).getTime()
  const diffMs = target - now
  const absDiff = Math.abs(diffMs)
  const seconds = Math.floor(absDiff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  const isFuture = diffMs > 0

  if (seconds < 60) return isFuture ? 'in a moment' : 'just now'
  if (minutes < 60) {
    const label = minutes === 1 ? '1 minute' : `${minutes} minutes`
    return isFuture ? `in ${label}` : `${label} ago`
  }
  if (hours < 24) {
    const label = hours === 1 ? '1 hour' : `${hours} hours`
    return isFuture ? `in ${label}` : `${label} ago`
  }
  const label = days === 1 ? '1 day' : `${days} days`
  return isFuture ? `in ${label}` : `${label} ago`
}

export function ShareDialog({ projectId, onClose }: ShareDialogProps) {
  const { t } = useTranslation()
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expiryDays, setExpiryDays] = useState<number>(30)

  const fetchLinks = useCallback(async () => {
    try {
      const data = await listShareLinks(projectId)
      setLinks(data.filter((l) => l.is_active))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load links')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchLinks()
  }, [fetchLinks])

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      await createShareLink(projectId, expiryDays)
      await fetchLinks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create link')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (linkId: string) => {
    try {
      await revokeShareLink(linkId)
      setLinks((prev) => prev.filter((l) => l.id !== linkId))
    } catch {
      // ignore
    }
  }

  const handleCopy = async (link: ShareLink) => {
    const url = buildShareUrl(link.token)
    await navigator.clipboard.writeText(url)
    setCopiedId(link.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return t('share.noExpiry', 'Never expires')
    const d = new Date(expiresAt)
    const now = new Date()
    if (d < now) return t('share.expired', 'Expired')
    return formatRelativeTime(expiresAt)
  }

  const formatCreated = (createdAt: string) => {
    return formatRelativeTime(createdAt)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000 }}
        onClick={onClose}
      />

      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 2001,
          width: 460,
          maxWidth: '90vw',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '1.5rem',
          boxShadow: 'var(--shadow-lg)',
          color: 'var(--text)',
          fontFamily: "'Montserrat', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
            {t('share.dialogTitle', 'Share project')}
          </h2>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: '1.1rem',
            }}
            onClick={onClose}
          >
            {'\u2715'}
          </button>
        </div>

        {/* Description banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 0.75rem',
            background: 'rgba(28,171,176,0.08)',
            border: '1px solid rgba(28,171,176,0.2)',
            borderRadius: 8,
            marginBottom: '1.25rem',
            fontSize: '0.82rem',
            color: 'var(--text)',
            lineHeight: 1.45,
          }}
        >
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>{'\uD83D\uDD17'}</span>
          <span>
            {t('share.accessDesc', 'Anyone with the link can view and fork this project.')}
          </span>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171',
              borderRadius: 8,
              padding: '0.6rem 0.85rem',
              marginBottom: '1rem',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ opacity: 0.5, textAlign: 'center', padding: '1rem', fontSize: '0.85rem' }}>
            {t('ui.loading', 'Loading\u2026')}
          </div>
        ) : (
          <>
            {links.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem 1rem',
                  border: '1px dashed var(--border)',
                  borderRadius: 10,
                  marginBottom: '1rem',
                }}
              >
                <div
                  style={{
                    fontSize: '1.5rem',
                    marginBottom: '0.5rem',
                    opacity: 0.4,
                  }}
                >
                  {'\uD83D\uDD17'}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {t('share.emptyTitle', 'No share links yet')}
                </div>
                <div style={{ fontSize: '0.78rem', opacity: 0.5, marginBottom: '1rem' }}>
                  {t('share.emptyDesc', 'Create a link to let others view this project.')}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  marginBottom: '1.25rem',
                }}
              >
                {links.map((link) => {
                  const url = buildShareUrl(link.token)
                  const isCopied = copiedId === link.id
                  return (
                    <div
                      key={link.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.75rem 0.85rem',
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            opacity: 0.8,
                          }}
                        >
                          {url}
                        </div>
                        <div
                          style={{
                            fontSize: '0.7rem',
                            opacity: 0.5,
                            marginTop: '0.25rem',
                            display: 'flex',
                            gap: '0.5rem',
                          }}
                        >
                          <span>
                            {t('share.created', 'Created {{time}}', {
                              time: formatCreated(link.created_at),
                            })}
                          </span>
                          <span>{'\u00B7'}</span>
                          <span>{formatExpiry(link.expires_at)}</span>
                          <span>{'\u00B7'}</span>
                          <span>
                            {t('share.viewCount', '{{n}} view(s)', {
                              n: link.view_count,
                            })}
                          </span>
                        </div>
                      </div>
                      <button
                        style={{
                          ...copyBtnStyle,
                          background: isCopied ? 'rgba(34,197,94,0.15)' : 'var(--surface-hover)',
                          color: isCopied ? '#22c55e' : 'var(--text)',
                          borderColor: isCopied ? 'rgba(34,197,94,0.3)' : 'var(--border)',
                        }}
                        title={t('share.copy', 'Copy link')}
                        onClick={() => void handleCopy(link)}
                      >
                        {isCopied ? t('share.copied', 'Copied!') : t('share.copy', 'Copy link')}
                      </button>
                      <button
                        style={{ ...iconBtn, color: 'var(--danger-text)' }}
                        title={t('share.revoke', 'Revoke link')}
                        onClick={() => void handleRevoke(link.id)}
                      >
                        {'\u2715'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Create section */}
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
              }}
            >
              <select
                style={selectStyle}
                value={String(expiryDays)}
                onChange={(e) => setExpiryDays(parseInt(e.target.value))}
                aria-label={t('share.expiryLabel', 'Link expiry')}
              >
                <option value="7">{t('share.expiry7', '7 days')}</option>
                <option value="30">{t('share.expiry30', '30 days')}</option>
                <option value="90">{t('share.expiry90', '90 days')}</option>
                <option value="0">{t('share.expiryNever', 'Never')}</option>
              </select>
              <button
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  opacity: creating ? 0.6 : 1,
                  fontFamily: 'inherit',
                }}
                disabled={creating}
                onClick={() => void handleCreate()}
              >
                {creating
                  ? t('share.creating', 'Creating\u2026')
                  : t('share.createLink', '+ Create share link')}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

const iconBtn: CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  fontSize: '0.9rem',
  padding: '0.15rem 0.25rem',
  borderRadius: 4,
  flexShrink: 0,
}

const copyBtnStyle: CSSProperties = {
  padding: '0.35rem 0.65rem',
  borderRadius: 6,
  border: '1px solid var(--border)',
  cursor: 'pointer',
  fontSize: '0.72rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  flexShrink: 0,
  transition: 'background 0.15s, color 0.15s',
}

const selectStyle: CSSProperties = {
  padding: '0.55rem 0.65rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface-1)',
  color: 'var(--text)',
  fontSize: '0.82rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
  flexShrink: 0,
}
