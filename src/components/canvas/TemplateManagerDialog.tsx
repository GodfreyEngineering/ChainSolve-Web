/**
 * TemplateManagerDialog — P150: Template editor for user-defined reusable groups.
 *
 * Shows all saved templates for the current user.  Supports:
 *   - Viewing template list (name, creation date)
 *   - Inline rename (click pencil icon → edit field → save)
 *   - Delete with confirmation
 *
 * Pro-only: calls listTemplates() which queries group_templates RLS-protected
 * to the current user's Pro plan.  Free users see a "Pro feature" message.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { listTemplates, deleteTemplate, renameTemplate } from '../../lib/templates'
import type { Template } from '../../lib/templates'

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1200,
  },
  dialog: {
    background: 'var(--card-bg, #252525)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: '1.5rem',
    width: 520,
    maxWidth: 'calc(100vw - 2rem)',
    maxHeight: 'calc(100vh - 6rem)',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    color: 'var(--fg, #F4F4F3)',
    fontFamily: 'system-ui, sans-serif',
  },
  title: { margin: '0 0 0.25rem', fontSize: '1.05rem', fontWeight: 700 },
  subtitle: { margin: '0 0 1rem', opacity: 0.55, fontSize: '0.85rem' },
  list: {
    overflowY: 'auto' as const,
    flex: 1,
    minHeight: 0,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  row: (hovered: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.65rem 0.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
    borderRadius: 6,
  }),
  colorDot: (color: string): React.CSSProperties => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  }),
  nameText: {
    flex: 1,
    fontSize: '0.9rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  dateText: {
    opacity: 0.45,
    fontSize: '0.75rem',
    whiteSpace: 'nowrap' as const,
  },
  iconBtn: {
    padding: '0.2rem 0.4rem',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'rgba(244,244,243,0.55)',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
  } satisfies React.CSSProperties,
  editInput: {
    flex: 1,
    padding: '0.25rem 0.5rem',
    borderRadius: 6,
    border: '1px solid #1CABB0',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--fg, #F4F4F3)',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.88rem',
  } satisfies React.CSSProperties,
  emptyState: {
    textAlign: 'center' as const,
    padding: '2rem 1rem',
    opacity: 0.5,
    fontSize: '0.88rem',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '1rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
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
  error: {
    color: '#ef4444',
    fontSize: '0.82rem',
    marginBottom: '0.5rem',
  },
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TemplateManagerDialogProps {
  open: boolean
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TemplateManagerDialog({ open, onClose }: TemplateManagerDialogProps) {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<Template[]>([])
  // Component is conditionally mounted (only when open=true), so loading starts true.
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    listTemplates()
      .then(setTemplates)
      .catch(() => setError(t('templateManager.errorLoad')))
      .finally(() => setLoading(false))
  }, [open, t])

  if (!open) return null

  function startRename(tmpl: Template) {
    setRenamingId(tmpl.id)
    setRenameValue(tmpl.name)
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  async function commitRename(id: string) {
    const trimmed = renameValue.trim()
    if (!trimmed) {
      cancelRename()
      return
    }
    try {
      await renameTemplate(id, trimmed)
      setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, name: trimmed } : t)))
    } catch {
      setError(t('templateManager.errorRename'))
    }
    cancelRename()
  }

  async function confirmDelete(id: string) {
    if (!window.confirm(t('templateManager.deleteConfirm'))) return
    setDeletingId(id)
    try {
      await deleteTemplate(id)
      setTemplates((ts) => ts.filter((t) => t.id !== id))
    } catch {
      setError(t('templateManager.errorDelete'))
    }
    setDeletingId(null)
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString()
    } catch {
      return iso
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 style={s.title}>{t('templateManager.title')}</h2>
        <p style={s.subtitle}>{t('templateManager.subtitle')}</p>

        {error && <p style={s.error}>{error}</p>}

        <div style={s.list}>
          {loading && <p style={s.emptyState}>{t('templateManager.loading')}</p>}

          {!loading && templates.length === 0 && (
            <p style={s.emptyState}>{t('templateManager.empty')}</p>
          )}

          {!loading &&
            templates.map((tmpl) => {
              const isRenaming = renamingId === tmpl.id
              const isDeleting = deletingId === tmpl.id
              const isHovered = hoveredId === tmpl.id

              return (
                <div
                  key={tmpl.id}
                  style={s.row(isHovered)}
                  onMouseEnter={() => setHoveredId(tmpl.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  data-testid={`template-row-${tmpl.id}`}
                >
                  <span style={s.colorDot(tmpl.color)} />

                  {isRenaming ? (
                    <>
                      <input
                        style={s.editInput}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void commitRename(tmpl.id)
                          if (e.key === 'Escape') cancelRename()
                        }}
                        autoFocus
                        maxLength={80}
                      />
                      <button
                        style={s.iconBtn}
                        onClick={() => void commitRename(tmpl.id)}
                        title={t('templateManager.confirmRename')}
                      >
                        ✓
                      </button>
                      <button style={s.iconBtn} onClick={cancelRename} title={t('common.cancel')}>
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={s.nameText} title={tmpl.name}>
                        {tmpl.name}
                      </span>
                      <span style={s.dateText}>{formatDate(tmpl.created_at)}</span>
                      <button
                        style={s.iconBtn}
                        onClick={() => startRename(tmpl)}
                        title={t('templateManager.rename')}
                        data-testid={`rename-${tmpl.id}`}
                      >
                        ✎
                      </button>
                      <button
                        style={{ ...s.iconBtn, color: isDeleting ? '#ef4444' : undefined }}
                        onClick={() => void confirmDelete(tmpl.id)}
                        disabled={isDeleting}
                        title={t('templateManager.delete')}
                        data-testid={`delete-${tmpl.id}`}
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              )
            })}
        </div>

        <div style={s.actions}>
          <button style={s.ghostBtn} onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
