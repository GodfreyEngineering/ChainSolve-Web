/**
 * NodeCommentDialog — floating panel for viewing and adding node comments.
 *
 * Shows the full comment thread for a specific node: list of comments
 * with timestamps, resolve/delete actions, and a text input to add
 * a new comment.
 */

import type { CSSProperties } from 'react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { NodeComment } from '../../lib/nodeCommentsService'
import {
  addNodeComment,
  resolveNodeComment,
  deleteNodeComment,
  editNodeComment,
} from '../../lib/nodeCommentsService'

interface NodeCommentDialogProps {
  nodeId: string
  nodeLabel?: string
  projectId: string
  canvasId: string
  comments: NodeComment[]
  /** Called when comments list has changed (add/resolve/delete). */
  onRefresh: () => void
  onClose: () => void
  /** Screen position to anchor the dialog near. */
  x: number
  y: number
}

const DIALOG_WIDTH = 300

export function NodeCommentDialog({
  nodeId,
  nodeLabel,
  projectId,
  canvasId,
  comments,
  onRefresh,
  onClose,
  x,
  y,
}: NodeCommentDialogProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Clamp position so dialog stays within viewport
  const dialogX = Math.min(x, window.innerWidth - DIALOG_WIDTH - 16)
  const dialogY = Math.min(y, window.innerHeight - 400)

  const handleSubmit = useCallback(async () => {
    if (!draft.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await addNodeComment(projectId, canvasId, nodeId, draft)
      setDraft('')
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }, [draft, projectId, canvasId, nodeId, onRefresh])

  const handleResolve = useCallback(
    async (comment: NodeComment) => {
      try {
        await resolveNodeComment(comment.id, !comment.is_resolved)
        onRefresh()
      } catch {
        // ignore
      }
    },
    [onRefresh],
  )

  const handleDelete = useCallback(
    async (commentId: string) => {
      try {
        await deleteNodeComment(commentId)
        onRefresh()
      } catch {
        // ignore
      }
    },
    [onRefresh],
  )

  const handleEditSave = useCallback(
    async (commentId: string) => {
      if (!editDraft.trim()) return
      try {
        await editNodeComment(commentId, editDraft)
        setEditingId(null)
        setEditDraft('')
        onRefresh()
      } catch {
        // ignore
      }
    },
    [editDraft, onRefresh],
  )

  const panelStyle: CSSProperties = {
    position: 'fixed',
    left: dialogX,
    top: dialogY,
    zIndex: 1200,
    width: DIALOG_WIDTH,
    maxHeight: 420,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-lg)',
    fontFamily: "'Montserrat', system-ui, sans-serif",
    fontSize: '0.8rem',
    color: 'var(--text)',
    overflow: 'hidden',
  }

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface-3)',
    flexShrink: 0,
  }

  const listStyle: CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '0.4rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  }

  const commentCardStyle = (resolved: boolean): CSSProperties => ({
    background: resolved ? 'rgba(0,0,0,0.06)' : 'var(--surface-1)',
    border: `1px solid ${resolved ? 'transparent' : 'var(--border)'}`,
    borderRadius: 7,
    padding: '0.4rem 0.5rem',
    opacity: resolved ? 0.6 : 1,
  })

  const footerStyle: CSSProperties = {
    borderTop: '1px solid var(--border)',
    padding: '0.5rem',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  }

  const textareaStyle: CSSProperties = {
    width: '100%',
    minHeight: 52,
    resize: 'vertical',
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid var(--border)',
    borderRadius: 5,
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: '0.78rem',
    padding: '0.3rem 0.4rem',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const btnStyle = (primary?: boolean): CSSProperties => ({
    padding: '0.25rem 0.6rem',
    fontSize: '0.75rem',
    borderRadius: 5,
    border: primary ? 'none' : '1px solid var(--border)',
    background: primary ? 'var(--primary)' : 'transparent',
    color: primary ? '#fff' : 'var(--text)',
    cursor: 'pointer',
    opacity: submitting ? 0.6 : 1,
  })

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return (
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1199 }}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />

      <div style={panelStyle} className="nodrag">
        <div style={headerStyle}>
          <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>
            💬 {nodeLabel ? `${nodeLabel}` : t('nodeComments.comments', 'Comments')}
          </span>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: '1rem',
              padding: '0 0.1rem',
            }}
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
          >
            ✕
          </button>
        </div>

        <div style={listStyle}>
          {comments.length === 0 && (
            <div
              style={{
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '0.8rem 0',
                fontSize: '0.76rem',
              }}
            >
              {t('nodeComments.noComments', 'No comments yet')}
            </div>
          )}
          {comments.map((c) => (
            <div key={c.id} style={commentCardStyle(c.is_resolved)}>
              {editingId === c.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <textarea
                    style={textareaStyle}
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                    <button style={btnStyle()} onClick={() => setEditingId(null)}>
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button style={btnStyle(true)} onClick={() => void handleEditSave(c.id)}>
                      {t('common.save', 'Save')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4, marginBottom: '0.3rem' }}>
                    {c.content}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.3rem',
                    }}
                  >
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>
                      {formatTime(c.created_at)}
                    </span>
                    <div style={{ display: 'flex', gap: '0.2rem' }}>
                      <button
                        title={
                          c.is_resolved
                            ? t('nodeComments.reopen', 'Reopen')
                            : t('nodeComments.resolve', 'Resolve')
                        }
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          color: c.is_resolved ? 'var(--text-faint)' : 'var(--success, #22c55e)',
                          padding: '0 0.15rem',
                        }}
                        onClick={() => void handleResolve(c)}
                      >
                        {c.is_resolved ? '↺' : '✓'}
                      </button>
                      <button
                        title={t('common.edit', 'Edit')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)',
                          padding: '0 0.15rem',
                        }}
                        onClick={() => {
                          setEditingId(c.id)
                          setEditDraft(c.content)
                        }}
                      >
                        ✎
                      </button>
                      <button
                        title={t('common.delete', 'Delete')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          color: 'var(--danger-text)',
                          padding: '0 0.15rem',
                        }}
                        onClick={() => void handleDelete(c.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div style={footerStyle}>
          <textarea
            ref={textareaRef}
            style={textareaStyle}
            placeholder={t('nodeComments.addPlaceholder', 'Add a comment…')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                void handleSubmit()
              }
            }}
          />
          {error && <div style={{ color: 'var(--danger-text)', fontSize: '0.72rem' }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.3rem' }}>
            <button style={btnStyle()} onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              style={btnStyle(true)}
              disabled={submitting || !draft.trim()}
              onClick={() => void handleSubmit()}
            >
              {submitting ? t('nodeComments.adding', 'Adding…') : t('nodeComments.add', 'Add')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
