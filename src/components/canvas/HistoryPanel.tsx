/**
 * HistoryPanel — UX-10: Undo/redo history timeline panel for the bottom dock.
 *
 * Shows all undo-able snapshots newest-first. Click an entry to restore.
 * Displays relative timestamps, node diff badges, and supports named checkpoints.
 *
 * 5.1: Better relative timestamps (Intl.RelativeTimeFormat), named checkpoints,
 *      visual diff indicators, clear history button, editable labels.
 */

import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GraphSnapshot } from '../../hooks/useGraphHistory'

interface HistoryPanelProps {
  /** Undo stack entries, newest first. */
  entries: GraphSnapshot[]
  /** Current (live) node count for the "Current" header row. */
  currentNodeCount: number
  /** Current (live) edge count for the "Current" header row. */
  currentEdgeCount: number
  /** Called with display index (0 = most recent) when user clicks an entry. */
  onRestore: (displayIdx: number) => void
  /** Called to save a named checkpoint with the current graph state. */
  onSaveCheckpoint?: (label: string) => void
  /** Called to clear all history entries. */
  onClear?: () => void
  /** Called when a history entry label is edited (displayIdx, newLabel). */
  onRenameEntry?: (displayIdx: number, newLabel: string) => void
}

/**
 * Format a timestamp as a natural-language relative time string.
 * Uses Intl.RelativeTimeFormat for localized output like "2 minutes ago".
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffSec = Math.floor(diffMs / 1000)

  // Under 5 seconds: "just now"
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
    if (diffWeek < 5) return rtf.format(-diffWeek, 'week')

    const diffMonth = Math.floor(diffDay / 30)
    return rtf.format(-diffMonth, 'month')
  } catch {
    // Fallback for environments without Intl.RelativeTimeFormat
    if (diffSec < 60) return `${diffSec}s ago`
    const min = Math.floor(diffSec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    return `${hr}h ago`
  }
}

export function HistoryPanel({
  entries,
  currentNodeCount,
  currentEdgeCount,
  onRestore,
  onSaveCheckpoint,
  onClear,
  onRenameEntry,
}: HistoryPanelProps) {
  const { t } = useTranslation()
  const [checkpointLabel, setCheckpointLabel] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  const saveInputRef = useRef<HTMLInputElement>(null)

  const handleSaveCheckpoint = useCallback(() => {
    if (!onSaveCheckpoint) return
    const label = checkpointLabel.trim() || t('history.untitled', 'Snapshot')
    onSaveCheckpoint(label)
    setCheckpointLabel('')
    setShowSaveInput(false)
  }, [onSaveCheckpoint, checkpointLabel, t])

  const handleClear = useCallback(() => {
    if (!onClear) return
    if (confirm(t('history.confirmClear', 'Clear all history? This cannot be undone.'))) {
      onClear()
    }
  }, [onClear, t])

  const startEditLabel = useCallback(
    (idx: number, currentLabel: string) => {
      if (!onRenameEntry) return
      setEditingIdx(idx)
      setEditingLabel(currentLabel)
      // Focus after render
      requestAnimationFrame(() => editInputRef.current?.focus())
    },
    [onRenameEntry],
  )

  const commitEditLabel = useCallback(() => {
    if (editingIdx === null || !onRenameEntry) return
    onRenameEntry(editingIdx, editingLabel.trim())
    setEditingIdx(null)
  }, [editingIdx, editingLabel, onRenameEntry])

  if (entries.length === 0) {
    return (
      <div
        style={{
          padding: '1.5rem 1rem',
          color: 'var(--text-faint)',
          textAlign: 'center',
          fontSize: '0.72rem',
          lineHeight: 1.6,
        }}
      >
        {t('history.emptyUndoHistory', 'No history yet — make some changes to see them here.')}

        {/* Save checkpoint button (even when empty) */}
        {onSaveCheckpoint && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => {
                setShowSaveInput(true)
                requestAnimationFrame(() => saveInputRef.current?.focus())
              }}
              style={saveCheckpointBtnStyle}
            >
              {t('history.saveCheckpoint', 'Save checkpoint')}
            </button>
          </div>
        )}

        {showSaveInput && (
          <div style={saveInputRowStyle}>
            <input
              ref={saveInputRef}
              value={checkpointLabel}
              onChange={(e) => setCheckpointLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveCheckpoint()
                if (e.key === 'Escape') setShowSaveInput(false)
              }}
              placeholder={t('history.checkpointPlaceholder', 'Checkpoint name…')}
              style={saveInputStyle}
            />
            <button onClick={handleSaveCheckpoint} style={saveConfirmBtnStyle}>
              {t('history.save', 'Save')}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      {/* Top action row: save checkpoint + clear */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderBottom: '1px solid color-mix(in srgb, var(--border) 40%, transparent)',
        }}
      >
        {onSaveCheckpoint && (
          <>
            {showSaveInput ? (
              <div style={{ ...saveInputRowStyle, flex: 1 }}>
                <input
                  ref={saveInputRef}
                  value={checkpointLabel}
                  onChange={(e) => setCheckpointLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCheckpoint()
                    if (e.key === 'Escape') setShowSaveInput(false)
                  }}
                  placeholder={t('history.checkpointPlaceholder', 'Checkpoint name…')}
                  style={saveInputStyle}
                />
                <button onClick={handleSaveCheckpoint} style={saveConfirmBtnStyle}>
                  {t('history.save', 'Save')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setShowSaveInput(true)
                  requestAnimationFrame(() => saveInputRef.current?.focus())
                }}
                style={saveCheckpointBtnStyle}
              >
                {t('history.saveCheckpoint', 'Save checkpoint')}
              </button>
            )}
          </>
        )}

        {onClear && (
          <button onClick={handleClear} style={clearBtnStyle} title={t('history.clear', 'Clear')}>
            {t('history.clear', 'Clear')}
          </button>
        )}
      </div>

      {/* Current state indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 10px',
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          borderLeft: '2px solid var(--accent)',
          fontSize: '0.7rem',
          fontFamily: 'ui-monospace, "Cascadia Code", monospace',
        }}
      >
        <span style={{ color: 'var(--accent)', fontSize: '0.6rem' }}>&#9679;</span>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>
          {t('history.current', 'Current')}
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontSize: '0.65rem' }}>
          {currentNodeCount}n &middot; {currentEdgeCount}e
        </span>
      </div>

      {/* Undo stack entries */}
      {entries.map((entry, idx) => {
        const prevEntry = entries[idx + 1]
        const prevNodeCount = prevEntry ? prevEntry.nodes.length : entry.nodes.length
        const diffNodes = entry.nodes.length - prevNodeCount

        return (
          <div
            key={idx}
            className="cs-history-entry"
            onClick={() => onRestore(idx)}
            title={t('history.restoreTooltip', 'Click to restore to this state')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              fontSize: '0.7rem',
              fontFamily: 'ui-monospace, "Cascadia Code", monospace',
              cursor: 'pointer',
              borderLeft: '2px solid transparent',
              borderBottom: '1px solid color-mix(in srgb, var(--border) 40%, transparent)',
            }}
          >
            <span style={{ color: 'var(--text-faint)', fontSize: '0.55rem', flexShrink: 0 }}>
              &#9675;
            </span>

            {/* Label — editable on click if onRenameEntry is provided */}
            {editingIdx === idx ? (
              <input
                ref={editInputRef}
                value={editingLabel}
                onChange={(e) => {
                  e.stopPropagation()
                  setEditingLabel(e.target.value)
                }}
                onClick={(e) => e.stopPropagation()}
                onBlur={commitEditLabel}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') commitEditLabel()
                  if (e.key === 'Escape') setEditingIdx(null)
                }}
                style={labelEditInputStyle}
              />
            ) : (
              <span
                onClick={(e) => {
                  if (onRenameEntry) {
                    e.stopPropagation()
                    startEditLabel(idx, entry.label ?? '')
                  }
                }}
                title={onRenameEntry ? t('history.clickToRename', 'Click to rename') : undefined}
                style={{
                  color: 'var(--text)',
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: onRenameEntry ? 'text' : 'pointer',
                }}
              >
                {entry.label ?? t('history.action', 'Action')}
              </span>
            )}

            {/* Diff badge: color-coded +N / -N / 0 */}
            <DiffBadge diff={diffNodes} />

            <span
              style={{
                color: 'var(--text-faint)',
                fontSize: '0.65rem',
                flexShrink: 0,
                minWidth: 40,
                textAlign: 'right',
              }}
            >
              {entry.timestamp ? formatRelativeTime(entry.timestamp) : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── DiffBadge ─────────────────────────────────────────────────────────────────

function DiffBadge({ diff }: { diff: number }) {
  if (diff === 0) {
    return (
      <span
        style={{
          fontSize: '0.6rem',
          flexShrink: 0,
          padding: '0 4px',
          borderRadius: 3,
          background: 'rgba(148,163,184,0.12)',
          color: 'var(--text-faint)',
        }}
      >
        0
      </span>
    )
  }

  const isAdd = diff > 0
  return (
    <span
      style={{
        fontSize: '0.6rem',
        flexShrink: 0,
        padding: '0 4px',
        borderRadius: 3,
        fontWeight: 600,
        background: isAdd ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
        color: isAdd ? 'var(--success, #22c55e)' : 'var(--danger-text, #f87171)',
      }}
    >
      {isAdd ? '+' : ''}
      {diff}
    </span>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const saveCheckpointBtnStyle: React.CSSProperties = {
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

const clearBtnStyle: React.CSSProperties = {
  marginLeft: 'auto',
  padding: '2px 8px',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--danger-text, #f87171)',
  border: '1px solid color-mix(in srgb, var(--danger-text, #f87171) 30%, transparent)',
  cursor: 'pointer',
  fontSize: '0.65rem',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}

const saveInputRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  alignItems: 'center',
  marginTop: 6,
}

const saveInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--surface-2, var(--bg))',
  color: 'var(--text)',
  fontSize: '0.65rem',
  fontFamily: 'inherit',
  outline: 'none',
}

const saveConfirmBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 4,
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.65rem',
  fontFamily: 'inherit',
}

const labelEditInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '1px 4px',
  borderRadius: 3,
  border: '1px solid var(--primary)',
  background: 'var(--surface-2, var(--bg))',
  color: 'var(--text)',
  fontSize: '0.7rem',
  fontFamily: 'ui-monospace, "Cascadia Code", monospace',
  outline: 'none',
}
