/**
 * HistoryPanel — right slide-out panel showing canvas snapshot history (ADV-03).
 *
 * Shows a timeline of saved snapshots for the current canvas.
 * Features:
 *   - "Save snapshot" button to capture current state
 *   - Each entry: timestamp, label (inline editable), node/edge count
 *   - Preview button → read-only canvas overlay
 *   - Restore button → creates autosave then replaces canvas with snapshot
 *   - Delete button per entry
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../../blocks/registry'
import {
  listSnapshots,
  createSnapshot,
  loadSnapshot,
  renameSnapshot,
  deleteSnapshot,
  type ProjectSnapshot,
  type SnapshotGraph,
} from '../../lib/snapshotService'

const CanvasArea = lazy(() =>
  import('../canvas/CanvasArea').then((m) => ({ default: m.CanvasArea })),
)

// ── Types ────────────────────────────────────────────────────────────────────

interface HistoryPanelProps {
  projectId: string
  canvasId: string
  /** Callback to get current nodes/edges for creating a snapshot */
  getSnapshot: () => { nodes: Node<NodeData>[]; edges: Edge[] }
  /** Callback to replace the canvas with snapshot nodes/edges (after autosave) */
  restoreSnapshot: (nodes: Node<NodeData>[], edges: Edge[]) => void
  /** Callback to create an autosave before restoring */
  saveNow: () => void
  onClose: () => void
}

// ── HistoryPanel ─────────────────────────────────────────────────────────────

export function HistoryPanel({
  projectId,
  canvasId,
  getSnapshot,
  restoreSnapshot,
  saveNow,
  onClose,
}: HistoryPanelProps) {
  const { t } = useTranslation()
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<SnapshotGraph | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const list = await listSnapshots(projectId, canvasId)
      setSnapshots(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [projectId, canvasId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const handleSaveSnapshot = async () => {
    setSaving(true)
    setError(null)
    try {
      const { nodes, edges } = getSnapshot()
      await createSnapshot(projectId, canvasId, nodes, edges)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save snapshot')
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = async (snap: ProjectSnapshot) => {
    setPreviewLoading(true)
    try {
      const graph = await loadSnapshot(snap)
      setPreviewData(graph)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshot')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleRestore = async (snap: ProjectSnapshot) => {
    if (
      !confirm(
        t(
          'history.confirmRestore',
          'Restore this snapshot? Current state will be autosaved first.',
        ),
      )
    )
      return
    try {
      // Autosave current state first
      saveNow()
      const graph = await loadSnapshot(snap)
      restoreSnapshot(graph.nodes as Node<NodeData>[], graph.edges as Edge[])
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed')
    }
  }

  const handleDelete = async (snap: ProjectSnapshot) => {
    if (!confirm(t('history.confirmDelete', 'Delete this snapshot?'))) return
    try {
      await deleteSnapshot(snap)
      setSnapshots((prev) => prev.filter((s) => s.id !== snap.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const startEdit = (snap: ProjectSnapshot) => {
    setEditingId(snap.id)
    setEditingLabel(snap.label ?? '')
  }

  const commitEdit = async () => {
    if (!editingId) return
    try {
      await renameSnapshot(editingId, editingLabel.trim())
      setSnapshots((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, label: editingLabel.trim() || null } : s)),
      )
    } catch {
      // best-effort
    } finally {
      setEditingId(null)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={backdropStyle} />

      {/* Panel */}
      <div style={panelStyle}>
        {/* Header */}
        <div style={panelHeaderStyle}>
          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
            {t('history.title', 'Version History')}
          </span>
          <button onClick={onClose} style={closeBtn} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Save snapshot button */}
        <div style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--border)' }}>
          <button
            disabled={saving}
            onClick={() => void handleSaveSnapshot()}
            style={saveSnapshotBtn}
          >
            {saving ? t('history.saving', 'Saving…') : t('history.saveSnapshot', 'Save snapshot')}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={errorStyle}>
            {error}
            <button onClick={() => setError(null)} style={{ marginLeft: 8, opacity: 0.7 }}>
              ✕
            </button>
          </div>
        )}

        {/* Snapshot list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.4rem 0' }}>
          {loading ? (
            <div style={emptyStyle}>{t('ui.loading', 'Loading…')}</div>
          ) : snapshots.length === 0 ? (
            <div style={emptyStyle}>
              {t('history.empty', 'No snapshots yet. Save one to start tracking history.')}
            </div>
          ) : (
            snapshots.map((snap) => (
              <div key={snap.id} style={entryStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Label (editable) */}
                  {editingId === snap.id ? (
                    <input
                      ref={editInputRef}
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onBlur={() => void commitEdit()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commitEdit()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      style={labelInputStyle}
                    />
                  ) : (
                    <button
                      onClick={() => startEdit(snap)}
                      style={labelBtnStyle}
                      title={t('history.clickToRename', 'Click to rename')}
                    >
                      {snap.label || t('history.untitled', 'Snapshot')}
                    </button>
                  )}
                  {/* Metadata */}
                  <div style={metaStyle}>
                    {formatDate(snap.created_at)}
                    {snap.node_count != null && (
                      <span style={{ marginLeft: 6, opacity: 0.55 }}>
                        {snap.node_count} {t('history.nodes', 'nodes')}
                        {snap.edge_count != null &&
                          `, ${snap.edge_count} ${t('history.edges', 'edges')}`}
                      </span>
                    )}
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => void handlePreview(snap)}
                    disabled={previewLoading}
                    style={actionBtn}
                    title={t('history.preview', 'Preview')}
                  >
                    👁
                  </button>
                  <button
                    onClick={() => void handleRestore(snap)}
                    style={{ ...actionBtn, color: 'var(--primary)' }}
                    title={t('history.restore', 'Restore')}
                  >
                    ↺
                  </button>
                  <button
                    onClick={() => void handleDelete(snap)}
                    style={{ ...actionBtn, color: '#f87171' }}
                    title={t('history.delete', 'Delete')}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Preview overlay */}
      {previewData && (
        <div style={previewOverlayStyle}>
          <div style={previewInnerStyle}>
            <div style={previewHeaderStyle}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {t('history.previewTitle', 'Snapshot preview')}
              </span>
              <span
                style={{
                  padding: '0.1rem 0.5rem',
                  borderRadius: 8,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  background: 'rgba(107,114,128,0.15)',
                  color: 'var(--text-muted)',
                }}
              >
                {t('share.readOnly', 'Read-only')}
              </span>
              <button
                onClick={() => setPreviewData(null)}
                style={{ ...closeBtn, marginLeft: 'auto' }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Suspense fallback={null}>
                <CanvasArea
                  key="history-preview"
                  initialNodes={(previewData.nodes as Node<NodeData>[]) ?? []}
                  initialEdges={(previewData.edges as Edge[]) ?? []}
                  readOnly
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d ago`
  return d.toLocaleDateString()
}

// ── Styles ────────────────────────────────────────────────────────────────────

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 300,
  zIndex: 201,
  background: 'var(--surface-1)',
  borderLeft: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
}

const panelHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 0.8rem',
  height: 44,
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}

const closeBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  padding: '0 0.25rem',
  fontFamily: 'inherit',
}

const saveSnapshotBtn: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0',
  borderRadius: 7,
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.82rem',
  fontFamily: 'inherit',
}

const errorStyle: React.CSSProperties = {
  padding: '0.5rem 0.8rem',
  background: 'rgba(239,68,68,0.1)',
  color: '#f87171',
  fontSize: '0.8rem',
  display: 'flex',
  alignItems: 'center',
}

const emptyStyle: React.CSSProperties = {
  padding: '1.5rem 1rem',
  textAlign: 'center',
  color: 'var(--text-muted)',
  fontSize: '0.82rem',
  lineHeight: 1.5,
}

const entryStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0.55rem 0.8rem',
  gap: '0.5rem',
  borderBottom: '1px solid var(--border)',
}

const labelBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'text',
  padding: 0,
  fontSize: '0.83rem',
  fontWeight: 500,
  color: 'var(--text)',
  fontFamily: 'inherit',
  textAlign: 'left',
  maxWidth: 160,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  display: 'block',
}

const labelInputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--primary)',
  borderRadius: 4,
  padding: '0.15rem 0.35rem',
  fontSize: '0.83rem',
  color: 'var(--text)',
  fontFamily: 'inherit',
  width: '100%',
  outline: 'none',
}

const metaStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  marginTop: 2,
}

const actionBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.82rem',
  padding: '0.25rem 0.35rem',
  borderRadius: 4,
  color: 'var(--text-muted)',
  fontFamily: 'inherit',
}

const previewOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 300,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const previewInnerStyle: React.CSSProperties = {
  width: '85vw',
  height: '80vh',
  background: 'var(--bg)',
  borderRadius: 12,
  border: '1px solid var(--border)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}

const previewHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.6rem 0.9rem',
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface-1)',
  flexShrink: 0,
}
