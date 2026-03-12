/**
 * ShareDialog — manage share links for a project.
 *
 * Shows existing links, allows creating new ones, and revoking.
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

export function ShareDialog({ projectId, onClose }: ShareDialogProps) {
  const { t } = useTranslation()
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

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
      await createShareLink(projectId)
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
    const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return t('share.expiresIn', 'Expires in {{days}} day(s)', { days })
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
          width: 440,
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
            marginBottom: '1.25rem',
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
            ✕
          </button>
        </div>

        <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', opacity: 0.7 }}>
          {t(
            'share.dialogDesc',
            'Share links let anyone view your project in read-only mode. They can fork it to make their own copy.',
          )}
        </p>

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
            {t('ui.loading', 'Loading…')}
          </div>
        ) : (
          <>
            {links.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '1.5rem 0',
                  opacity: 0.5,
                  fontSize: '0.85rem',
                }}
              >
                {t('share.noLinks', 'No active share links.')}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                }}
              >
                {links.map((link) => {
                  const url = buildShareUrl(link.token)
                  return (
                    <div
                      key={link.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.65rem 0.75rem',
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
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
                            marginTop: '0.15rem',
                            display: 'flex',
                            gap: '0.5rem',
                          }}
                        >
                          <span>{formatExpiry(link.expires_at)}</span>
                          <span>·</span>
                          <span>
                            {t('share.viewCount', '{{n}} view(s)', {
                              n: link.view_count,
                            })}
                          </span>
                        </div>
                      </div>
                      <button
                        style={iconBtn}
                        title={t('share.copy', 'Copy link')}
                        onClick={() => void handleCopy(link)}
                      >
                        {copiedId === link.id ? '✓' : '⎘'}
                      </button>
                      <button
                        style={{ ...iconBtn, color: 'var(--danger-text)' }}
                        title={t('share.revoke', 'Revoke link')}
                        onClick={() => void handleRevoke(link.id)}
                      >
                        ✕
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              style={{
                width: '100%',
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
                ? t('share.creating', 'Creating…')
                : t('share.createLink', '+ Create share link')}
            </button>
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
