/**
 * TimerNode — 2.131: Wall-clock timer / performance measurement block.
 *
 * Measures elapsed time between consecutive engine evaluation cycles by
 * watching the upstream computed value. Each time the value changes,
 * a timestamp is recorded and statistics are updated:
 *   - Last interval (ms)
 *   - Mean interval over last 50 samples (ms)
 *   - Throughput (evals/sec)
 *   - Total eval count
 *
 * The engine receives this block as a `display` pass-through (bridge.ts remap).
 */

import { memo, useEffect, useRef, useState } from 'react'
import { Handle, Position, useEdges, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { useComputedValue } from '../../../contexts/ComputedContext'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

interface TimerStats {
  lastMs: number
  meanMs: number
  hz: number
  count: number
}

const MAX_SAMPLES = 50

function TimerNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as NodeData
  const edges = useEdges()

  const inputEdge = edges.find((e) => e.target === id && e.targetHandle === 'signal')
  const sourceId = inputEdge?.source ?? ''
  const computedValue = useComputedValue(sourceId)

  const prevValueRef = useRef<unknown>(undefined)
  const prevTimestampRef = useRef<number | null>(null)
  const intervalsRef = useRef<number[]>([])
  const countRef = useRef(0)

  const [stats, setStats] = useState<TimerStats | null>(null)

  useEffect(() => {
    // Detect each new evaluation by watching for value changes.
    // We compare by identity/value — any change counts as a new eval.
    const val = computedValue
    if (val === prevValueRef.current) return
    prevValueRef.current = val

    const now = performance.now()
    const prev = prevTimestampRef.current
    prevTimestampRef.current = now
    countRef.current++

    if (prev !== null) {
      const interval = now - prev
      intervalsRef.current = [...intervalsRef.current, interval].slice(-MAX_SAMPLES)
      const mean = intervalsRef.current.reduce((a, b) => a + b, 0) / intervalsRef.current.length
      const hz = mean > 0 ? 1000 / mean : 0
      setStats({ lastMs: interval, meanMs: mean, hz, count: countRef.current })
    } else {
      setStats((prev) =>
        prev ? { ...prev, count: countRef.current } : { lastMs: 0, meanMs: 0, hz: 0, count: 1 },
      )
    }
  }, [computedValue])

  const reset = () => {
    prevValueRef.current = undefined
    prevTimestampRef.current = null
    intervalsRef.current = []
    countRef.current = 0
    setStats(null)
  }

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const fmtMs = (ms: number) =>
    ms < 1
      ? `${(ms * 1000).toFixed(0)}µs`
      : ms < 1000
        ? `${ms.toFixed(1)}ms`
        : `${(ms / 1000).toFixed(2)}s`

  const fmtHz = (hz: number) =>
    hz >= 1000
      ? `${(hz / 1000).toFixed(1)}kHz`
      : hz >= 1
        ? `${hz.toFixed(1)}Hz`
        : `${hz.toFixed(3)}Hz`

  return (
    <div
      style={{
        ...s.node,
        minWidth: 160,
        ...(selected ? { ...s.nodeSelected, borderColor: typeColor } : {}),
      }}
      role="group"
      aria-label={`${nd.label} timer`}
    >
      <div style={{ ...s.header }}>
        <div className="cs-node-header-left" style={s.headerLeft}>
          <Icon icon={TypeIcon} size={14} style={{ ...s.headerIcon, color: typeColor }} />
          <span style={s.headerLabel}>{nd.label}</span>
        </div>
        {stats && (
          <span
            style={{
              fontSize: '0.6rem',
              color: 'var(--muted)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            #{stats.count}
          </span>
        )}
      </div>

      <div className="cs-node-body" style={{ ...s.body, padding: '0.5rem 0.6rem' }}>
        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="signal"
          style={{ ...s.handleLeft, top: '50%', transform: 'translateY(-50%)' }}
        />

        {stats ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px' }}>
            <StatRow label={t('timer.last', 'Last')} value={fmtMs(stats.lastMs)} />
            <StatRow label={t('timer.mean', 'Mean')} value={fmtMs(stats.meanMs)} />
            <StatRow label={t('timer.rate', 'Rate')} value={fmtHz(stats.hz)} />
            <StatRow label={t('timer.count', 'Count')} value={String(stats.count)} />
          </div>
        ) : (
          <div
            style={{ fontSize: '0.65rem', color: 'var(--muted)', textAlign: 'center', padding: 6 }}
          >
            {sourceId
              ? t('timer.waiting', 'Waiting for evals…')
              : t('timer.noSignal', 'Connect a signal')}
          </div>
        )}

        <button
          onClick={reset}
          className="nodrag"
          style={{
            width: '100%',
            marginTop: 6,
            fontSize: '0.6rem',
            padding: '2px 0',
            borderRadius: 3,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--muted)',
            cursor: 'pointer',
          }}
        >
          {t('timer.reset', 'Reset')}
        </button>
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>{label}:</span>
      <span
        style={{
          fontSize: '0.6rem',
          color: 'var(--text)',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </>
  )
}

export const TimerNode = memo(TimerNodeInner)
