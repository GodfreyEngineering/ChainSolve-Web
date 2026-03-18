/**
 * LoggerNode — 2.132: Time-series data logger block.
 *
 * Records timestamped numeric values from the connected signal port.
 * Stores up to a configurable number of entries in memory. Provides:
 *   - Scrollable table view of recent entries (newest first)
 *   - CSV export (download)
 *   - Clear button
 *   - Configurable max entries and time mode (relative/absolute)
 *
 * The engine receives this block as a `display` pass-through (bridge.ts remap).
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Handle, Position, useEdges, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { useComputedValue } from '../../../contexts/ComputedContext'
import { isScalar } from '../../../engine/value'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoggerNodeData extends NodeData {
  logMaxEntries?: number
  logRelativeTime?: boolean
}

interface LogEntry {
  seq: number
  ts: number // performance.now()
  absTs: number // Date.now()
  value: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtValue(v: number): string {
  if (!isFinite(v)) return String(v)
  if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0)) return v.toExponential(4)
  return parseFloat(v.toPrecision(7)).toString()
}

function fmtTime(ts: number, absTs: number, relativeTime: boolean, origin: number): string {
  if (relativeTime) {
    const dt = ts - origin
    return `+${dt.toFixed(1)}ms`
  }
  return new Date(absTs).toISOString().replace('T', ' ').slice(0, 23)
}

function exportCsv(entries: LogEntry[], relativeTime: boolean, origin: number): void {
  const header = relativeTime ? 'seq,time_ms,value' : 'seq,timestamp,value'
  const rows = entries.map((e) => {
    const t = relativeTime ? (e.ts - origin).toFixed(3) : new Date(e.absTs).toISOString()
    return `${e.seq},${t},${e.value}`
  })
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `log_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ─────────────────────────────────────────────────────────────────

function LoggerNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as LoggerNodeData
  const edges = useEdges()

  const maxEntries = Math.max(10, Math.min(nd.logMaxEntries ?? 1000, 100000))
  const relativeTime = nd.logRelativeTime ?? true

  const inputEdge = edges.find((e) => e.target === id && e.targetHandle === 'signal')
  const sourceId = inputEdge?.source ?? ''
  const computedValue = useComputedValue(sourceId)

  const prevValueRef = useRef<unknown>(undefined)
  const seqRef = useRef(0)
  const originRef = useRef<number>(0)
  const [entries, setEntries] = useState<LogEntry[]>([])

  useEffect(() => {
    const val = computedValue
    if (val === prevValueRef.current) return
    if (!val || !isScalar(val)) return
    const v = val.value
    if (isNaN(v) || !isFinite(v)) return
    prevValueRef.current = val

    const ts = performance.now()
    const absTs = Date.now()
    if (seqRef.current === 0) originRef.current = ts
    seqRef.current++

    const entry: LogEntry = { seq: seqRef.current, ts, absTs, value: v }
    setEntries((prev) => {
      const next = [entry, ...prev]
      return next.length > maxEntries ? next.slice(0, maxEntries) : next
    })
  }, [computedValue, maxEntries])

  const clear = useCallback(() => {
    prevValueRef.current = undefined
    seqRef.current = 0
    originRef.current = 0
    setEntries([])
  }, [])

  const doExport = useCallback(() => {
    const sorted = [...entries].reverse()
    exportCsv(sorted, relativeTime, originRef.current)
  }, [entries, relativeTime])

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  return (
    <div
      style={{
        ...s.node,
        minWidth: 210,
        ...(selected ? { ...s.nodeSelected, borderColor: typeColor } : {}),
      }}
      role="group"
      aria-label={`${nd.label} logger, ${entries.length} entries`}
    >
      <div style={{ ...s.header }}>
        <div className="cs-node-header-left" style={s.headerLeft}>
          <Icon icon={TypeIcon} size={14} style={{ ...s.headerIcon, color: typeColor }} />
          <span style={s.headerLabel}>{nd.label}</span>
        </div>
        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>
          {entries.length}/{maxEntries}
        </span>
      </div>

      <div className="cs-node-body" style={{ ...s.body, padding: '0.4rem 0.5rem' }}>
        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="signal"
          style={{ ...s.handleLeft, top: '50%', transform: 'translateY(-50%)' }}
        />

        {/* Log table */}
        <div
          style={{
            height: 100,
            overflowY: 'auto',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            marginBottom: 4,
          }}
        >
          {entries.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.6rem',
                color: 'var(--muted)',
              }}
            >
              {sourceId
                ? t('logger.noData', 'No data yet')
                : t('logger.noSignal', 'Connect a signal')}
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.58rem',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <tbody>
                {entries.slice(0, 200).map((e) => (
                  <tr
                    key={e.seq}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      opacity: e.seq === entries[0].seq ? 1 : 0.7,
                    }}
                  >
                    <td style={{ padding: '1px 4px', color: 'var(--muted)', width: 30 }}>
                      {e.seq}
                    </td>
                    <td style={{ padding: '1px 4px', color: 'var(--muted)', width: 90 }}>
                      {fmtTime(e.ts, e.absTs, relativeTime, originRef.current)}
                    </td>
                    <td style={{ padding: '1px 4px', color: 'var(--text)', textAlign: 'right' }}>
                      {fmtValue(e.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={doExport}
            disabled={entries.length === 0}
            className="nodrag"
            style={{
              flex: 1,
              fontSize: '0.6rem',
              padding: '2px 0',
              borderRadius: 3,
              border: '1px solid var(--border)',
              background: entries.length > 0 ? 'var(--primary)' : 'var(--card)',
              color: entries.length > 0 ? '#fff' : 'var(--muted)',
              cursor: entries.length > 0 ? 'pointer' : 'default',
            }}
          >
            {t('logger.export', 'Export CSV')}
          </button>
          <button
            onClick={clear}
            disabled={entries.length === 0}
            className="nodrag"
            style={{
              flex: 0,
              fontSize: '0.6rem',
              padding: '2px 8px',
              borderRadius: 3,
              border: '1px solid var(--border)',
              background: 'var(--card)',
              color: 'var(--muted)',
              cursor: entries.length > 0 ? 'pointer' : 'default',
            }}
          >
            {t('logger.clear', 'Clear')}
          </button>
        </div>
      </div>
    </div>
  )
}

export const LoggerNode = memo(LoggerNodeInner)
