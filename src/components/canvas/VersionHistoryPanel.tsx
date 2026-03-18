/**
 * VersionHistoryPanel — 5.8: Persistent graph version history.
 *
 * Lists named project snapshots stored in Supabase (project_snapshots table),
 * allows creating labelled versions, restoring to a previous version, and
 * deleting old snapshots. Snapshots survive session and browser resets.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Edge, Node } from '@xyflow/react'
import {
  listSnapshots,
  createSnapshot,
  loadSnapshot,
  renameSnapshot,
  deleteSnapshot,
  type ProjectSnapshot,
} from '../../lib/snapshotService'
import type { NodeData } from '../../blocks/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VersionHistoryPanelProps {
  projectId: string | undefined
  canvasId: string | undefined
  nodes: Node<NodeData>[]
  edges: Edge[]
  onRestore: (nodes: Node<NodeData>[], edges: Edge[]) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const now = Date.now()
  const diffMs = now - new Date(iso).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 5) return 'just now'
  try {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
    if (diffSec < 60) return rtf.format(-diffSec, 'second')
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return rtf.format(-diffMin, 'minute')
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return rtf.format(-diffHr, 'hour')
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return rtf.format(-diffDay, 'day')
    const diffWeek = Math.floor(diffDay / 7)
    return rtf.format(-diffWeek, 'week')
  } catch {
    if (diffSec < 60) return `${diffSec}s ago`
    const m = Math.floor(diffSec / 60)
    if (m < 60) return `${m}m ago`
    return `${Math.floor(m / 60)}h ago`
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VersionHistoryPanel({
  projectId,
  canvasId,
  nodes,
  edges,
  onRestore,
}: VersionHistoryPanelProps) {
  const { t } = useTranslation()
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const editRef = useRef<HTMLInputElement>(null)

  // Load snapshots for current canvas
  const refresh = useCallback(async () => {
    if (!projectId || !canvasId) return
    setLoading(true)
    setError(null)
    try {
      const list = await listSnapshots(projectId, canvasId)
      setSnapshots(list)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('versions.loadError', 'Failed to load versions'),
      )
    } finally {
      setLoading(false)
    }
  }, [projectId, canvasId, t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Save a new named snapshot
  const handleSave = useCallback(async () => {
    if (!projectId || !canvasId) return
    setSaving(true)
    setError(null)
    try {
      const finalLabel = label.trim() || t('versions.untitled', 'Snapshot')
      await createSnapshot(projectId, canvasId, nodes, edges, finalLabel)
      setLabel('')
      setShowInput(false)
      await refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('versions.saveError', 'Failed to save version'),
      )
    } finally {
      setSaving(false)
    }
  }, [projectId, canvasId, nodes, edges, label, refresh, t])

  // Restore a snapshot onto the canvas
  const handleRestore = useCallback(
    async (snap: ProjectSnapshot) => {
      if (
        !confirm(
          t('versions.confirmRestore', 'Restore this version? Current canvas will be replaced.'),
        )
      )
        return
      setRestoring(snap.id)
      setError(null)
      try {
        const graph = await loadSnapshot(snap)
        onRestore(graph.nodes as Node<NodeData>[], graph.edges as Edge[])
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('versions.restoreError', 'Failed to restore version'),
        )
      } finally {
        setRestoring(null)
      }
    },
    [onRestore, t],
  )

  // Rename a snapshot label
  const handleRename = useCallback(async () => {
    if (!editingId) return
    const newLabel = editingLabel.trim()
    if (!newLabel) {
      setEditingId(null)
      return
    }
    try {
      await renameSnapshot(editingId, newLabel)
      setSnapshots((prev) => prev.map((s) => (s.id === editingId ? { ...s, label: newLabel } : s)))
    } catch {
      // ignore rename errors silently
    }
    setEditingId(null)
  }, [editingId, editingLabel])

  // Delete a snapshot
  const handleDelete = useCallback(
    async (snap: ProjectSnapshot) => {
      if (!confirm(t('versions.confirmDelete', 'Delete this version? This cannot be undone.')))
        return
      setError(null)
      try {
        await deleteSnapshot(snap)
        setSnapshots((prev) => prev.filter((s) => s.id !== snap.id))
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('versions.deleteError', 'Failed to delete version'),
        )
      }
    },
    [t],
  )

  if (!projectId || !canvasId) {
    return (
      <div style={emptyStyle}>
        {t('versions.noProject', 'Open a saved project to use version history.')}
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        {showInput ? (
          <div style={{ display: 'flex', gap: 4, flex: 1, alignItems: 'center' }}>
            <input
              ref={inputRef}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave()
                if (e.key === 'Escape') setShowInput(false)
              }}
              placeholder={t('versions.labelPlaceholder', 'Version name…')}
              style={inputStyle}
              disabled={saving}
              autoFocus
            />
            <button onClick={() => void handleSave()} style={saveBtnStyle} disabled={saving}>
              {saving ? '…' : t('versions.save', 'Save')}
            </button>
            <button onClick={() => setShowInput(false)} style={cancelBtnStyle}>
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setShowInput(true)
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
            style={saveBtnStyle}
          >
            {t('versions.saveVersion', 'Save version')}
          </button>
        )}
        <button
          onClick={() => void refresh()}
          style={refreshBtnStyle}
          title={t('versions.refresh', 'Refresh')}
          disabled={loading}
        >
          ↻
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      {/* Snapshot list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && snapshots.length === 0 ? (
          <div style={emptyStyle}>{t('versions.loading', 'Loading versions…')}</div>
        ) : snapshots.length === 0 ? (
          <div style={emptyStyle}>
            {t('versions.empty', 'No saved versions yet. Click "Save version" to create one.')}
          </div>
        ) : (
          snapshots.map((snap) => (
            <div key={snap.id} style={rowStyle}>
              {/* Label — editable on click */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === snap.id ? (
                  <input
                    ref={editRef}
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    onBlur={() => void handleRename()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRename()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    style={labelEditInputStyle}
                    autoFocus
                  />
                ) : (
                  <span
                    style={labelStyle}
                    title={t('versions.clickToRename', 'Click to rename')}
                    onClick={() => {
                      setEditingId(snap.id)
                      setEditingLabel(snap.label ?? '')
                      requestAnimationFrame(() => editRef.current?.focus())
                    }}
                  >
                    {snap.label ?? t('versions.untitled', 'Snapshot')}
                  </span>
                )}
                <div style={metaStyle}>
                  <span style={metaItemStyle}>{formatRelativeTime(snap.created_at)}</span>
                  {snap.node_count != null && (
                    <span style={metaItemStyle}>
                      {snap.node_count}n · {snap.edge_count ?? 0}e
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => void handleRestore(snap)}
                  disabled={restoring === snap.id}
                  style={restoreBtnStyle}
                  title={t('versions.restore', 'Restore')}
                >
                  {restoring === snap.id ? '…' : t('versions.restore', 'Restore')}
                </button>
                <button
                  onClick={() => void handleDelete(snap)}
                  style={deleteBtnStyle}
                  title={t('versions.delete', 'Delete')}
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  borderBottom: '1px solid color-mix(in srgb, var(--border) 40%, transparent)',
  flexShrink: 0,
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--surface-2, var(--bg))',
  color: 'var(--text)',
  fontSize: '0.68rem',
  fontFamily: 'inherit',
  outline: 'none',
}

const saveBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 4,
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.65rem',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--text-faint)',
  border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
  cursor: 'pointer',
  fontSize: '0.65rem',
  fontFamily: 'inherit',
}

const refreshBtnStyle: React.CSSProperties = {
  marginLeft: 'auto',
  padding: '2px 6px',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--text-faint)',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.8rem',
  lineHeight: 1,
}

const errorStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '0.68rem',
  color: 'var(--danger-text, #f87171)',
  background: 'rgba(239,68,68,0.08)',
  borderBottom: '1px solid rgba(239,68,68,0.2)',
}

const emptyStyle: React.CSSProperties = {
  padding: '1.5rem 1rem',
  color: 'var(--text-faint)',
  textAlign: 'center',
  fontSize: '0.72rem',
  lineHeight: 1.6,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  borderBottom: '1px solid color-mix(in srgb, var(--border) 30%, transparent)',
}

const labelStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: '0.72rem',
  fontWeight: 500,
  cursor: 'text',
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const metaStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  marginTop: 1,
}

const metaItemStyle: React.CSSProperties = {
  color: 'var(--text-faint)',
  fontSize: '0.62rem',
  fontFamily: 'ui-monospace, "Cascadia Code", monospace',
}

const labelEditInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '1px 4px',
  borderRadius: 3,
  border: '1px solid var(--primary)',
  background: 'var(--surface-2, var(--bg))',
  color: 'var(--text)',
  fontSize: '0.72rem',
  fontFamily: 'inherit',
  outline: 'none',
}

const restoreBtnStyle: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: 4,
  background: 'rgba(28,171,176,0.12)',
  color: 'var(--primary)',
  border: '1px solid rgba(28,171,176,0.3)',
  cursor: 'pointer',
  fontSize: '0.62rem',
  fontFamily: 'inherit',
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

const deleteBtnStyle: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--danger-text, #f87171)',
  border: '1px solid rgba(239,68,68,0.3)',
  cursor: 'pointer',
  fontSize: '0.75rem',
  lineHeight: 1,
}
