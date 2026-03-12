/**
 * HistoryPanel — UX-10: Undo/redo history timeline panel for the bottom dock.
 *
 * Shows all undo-able snapshots newest-first. Click an entry to restore.
 * Displays relative timestamps and node/edge counts for context.
 */

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
}

function formatRelative(ts: number | undefined): string {
  if (!ts) return ''
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  return `${hr}h ago`
}

export function HistoryPanel({
  entries,
  currentNodeCount,
  currentEdgeCount,
  onRestore,
}: HistoryPanelProps) {
  const { t } = useTranslation()

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
        {t('history.empty', 'No history yet — make some changes to see them here.')}
      </div>
    )
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
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
        <span style={{ color: 'var(--accent)', fontSize: '0.6rem' }}>●</span>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>
          {t('history.current', 'Current')}
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontSize: '0.65rem' }}>
          {currentNodeCount}n · {currentEdgeCount}e
        </span>
      </div>

      {/* Undo stack entries */}
      {entries.map((entry, idx) => {
        const prevEntry = entries[idx + 1]
        const prevNodeCount = prevEntry ? prevEntry.nodes.length : entry.nodes.length
        const diffNodes = entry.nodes.length - prevNodeCount
        const diffSign = diffNodes > 0 ? '+' : ''
        const diffColor =
          diffNodes > 0 ? 'var(--success, #22c55e)' : diffNodes < 0 ? 'var(--danger-text)' : ''

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
              ○
            </span>
            <span
              style={{
                color: 'var(--text)',
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.label ?? t('history.action', 'Action')}
            </span>
            {diffNodes !== 0 && (
              <span style={{ color: diffColor, fontSize: '0.65rem', flexShrink: 0 }}>
                {diffSign}
                {diffNodes}n
              </span>
            )}
            <span
              style={{
                color: 'var(--text-faint)',
                fontSize: '0.65rem',
                flexShrink: 0,
                minWidth: 40,
                textAlign: 'right',
              }}
            >
              {formatRelative(entry.timestamp)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
