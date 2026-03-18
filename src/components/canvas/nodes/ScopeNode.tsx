/**
 * ScopeNode — 6.14: Real-time signal scope block.
 *
 * Reads the connected input's computed scalar value on each engine
 * evaluation cycle and accumulates a configurable ring buffer of samples.
 * Renders a live SVG line chart with:
 *   - Auto-scaled or manual Y axis
 *   - Optional horizontal zero reference line
 *   - Vertical trigger line at the latest sample
 *   - Stats bar: current, min, max
 *
 * The engine receives this block as a `display` pass-through (bridge.ts remap).
 */

import { memo, useEffect, useRef, useState, useMemo } from 'react'
import { Handle, Position, useEdges, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { useComputedValue } from '../../../contexts/ComputedContext'
import { isScalar } from '../../../engine/value'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScopeNodeData extends NodeData {
  scopeBufferSize?: number
  scopeShowZero?: boolean
  scopeAutoScale?: boolean
  scopeYMin?: number
  scopeYMax?: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHART_W = 200
const CHART_H = 80
const PADDING = { l: 2, r: 2, t: 4, b: 2 }

// ── Component ─────────────────────────────────────────────────────────────────

function ScopeNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as ScopeNodeData
  const edges = useEdges()

  const bufferSize = Math.max(10, Math.min(nd.scopeBufferSize ?? 100, 2000))
  const showZero = nd.scopeShowZero ?? true
  const autoScale = nd.scopeAutoScale ?? true
  const manualYMin = nd.scopeYMin ?? -1
  const manualYMax = nd.scopeYMax ?? 1

  // Find upstream source
  const inputEdge = edges.find((e) => e.target === id && e.targetHandle === 'signal')
  const sourceId = inputEdge?.source ?? ''
  const computedValue = useComputedValue(sourceId)

  // Ring buffer stored in a ref to avoid renders on every sample
  const bufferRef = useRef<number[]>([])
  const [samples, setSamples] = useState<number[]>([])
  const prevValueRef = useRef<number | null>(null)

  useEffect(() => {
    if (!computedValue || !isScalar(computedValue)) return
    const v = computedValue.value
    if (isNaN(v) || !isFinite(v)) return
    // Only add sample when value changes (each eval is a new sample)
    if (v === prevValueRef.current) return
    prevValueRef.current = v
    bufferRef.current = [...bufferRef.current, v].slice(-bufferSize)
    setSamples([...bufferRef.current])
  }, [computedValue, bufferSize])

  const stats = useMemo(() => {
    if (samples.length === 0) return null
    const last = samples[samples.length - 1]
    let min = Infinity
    let max = -Infinity
    for (const v of samples) {
      if (v < min) min = v
      if (v > max) max = v
    }
    return { last, min, max }
  }, [samples])

  // SVG path generation
  const svgContent = useMemo(() => {
    if (samples.length < 2) return null

    const yMin = autoScale ? (stats?.min ?? 0) : manualYMin
    const yMax = autoScale ? (stats?.max ?? 1) : manualYMax
    const yRange = yMax - yMin || 1

    const innerW = CHART_W - PADDING.l - PADDING.r
    const innerH = CHART_H - PADDING.t - PADDING.b

    const toX = (i: number) => PADDING.l + (i / (samples.length - 1)) * innerW
    const toY = (v: number) => PADDING.t + innerH - ((v - yMin) / yRange) * innerH

    // Build SVG polyline points
    const points = samples.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')

    // Zero line
    const zeroLineY = showZero && yMin <= 0 && yMax >= 0 ? toY(0) : null

    // Trigger line (last sample x)
    const triggerX = toX(samples.length - 1)

    return { points, zeroLineY, triggerX }
  }, [samples, stats, autoScale, manualYMin, manualYMax, showZero])

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const fmtNum = (v: number) => {
    if (!isFinite(v)) return String(v)
    if (Math.abs(v) >= 1e4 || (Math.abs(v) < 0.001 && v !== 0)) return v.toExponential(3)
    return parseFloat(v.toPrecision(5)).toString()
  }

  return (
    <div
      style={{
        ...s.node,
        minWidth: CHART_W + 12,
        ...(selected ? { ...s.nodeSelected, borderColor: typeColor } : {}),
      }}
      role="group"
      aria-label={`${nd.label} scope`}
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
            {fmtNum(stats.last)}
          </span>
        )}
      </div>

      <div className="cs-node-body" style={{ ...s.body, padding: '0.4rem 0.5rem' }}>
        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="signal"
          style={{ ...s.handleLeft, top: '50%', transform: 'translateY(-50%)' }}
        />

        {/* Chart area */}
        <div
          style={{
            background: 'var(--card)',
            borderRadius: 4,
            border: '1px solid var(--border)',
            overflow: 'hidden',
            marginBottom: 4,
          }}
        >
          <svg width={CHART_W} height={CHART_H} style={{ display: 'block' }}>
            {/* Background grid lines */}
            {[0.25, 0.5, 0.75].map((p) => (
              <line
                key={p}
                x1={PADDING.l}
                y1={PADDING.t + p * (CHART_H - PADDING.t - PADDING.b)}
                x2={CHART_W - PADDING.r}
                y2={PADDING.t + p * (CHART_H - PADDING.t - PADDING.b)}
                stroke="var(--border)"
                strokeWidth={0.5}
              />
            ))}

            {/* Zero reference line */}
            {svgContent?.zeroLineY !== null && svgContent?.zeroLineY !== undefined && (
              <line
                x1={PADDING.l}
                y1={svgContent.zeroLineY}
                x2={CHART_W - PADDING.r}
                y2={svgContent.zeroLineY}
                stroke="var(--muted)"
                strokeWidth={0.8}
                strokeDasharray="3,3"
              />
            )}

            {/* Signal line */}
            {svgContent && (
              <polyline
                points={svgContent.points}
                fill="none"
                stroke={typeColor}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* Trigger line (latest sample) */}
            {svgContent && (
              <line
                x1={svgContent.triggerX}
                y1={PADDING.t}
                x2={svgContent.triggerX}
                y2={CHART_H - PADDING.b}
                stroke="var(--primary)"
                strokeWidth={1}
                opacity={0.5}
              />
            )}

            {/* Empty state */}
            {samples.length === 0 && (
              <text
                x={CHART_W / 2}
                y={CHART_H / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fill="var(--muted)"
              >
                {t('scope.noSignal', 'No signal')}
              </text>
            )}
          </svg>
        </div>

        {/* Stats row */}
        {stats && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.6rem',
              color: 'var(--muted)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <span>
              {t('scope.min', 'min')}: {fmtNum(stats.min)}
            </span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmtNum(stats.last)}</span>
            <span>
              {t('scope.max', 'max')}: {fmtNum(stats.max)}
            </span>
          </div>
        )}

        {/* Sample count */}
        <div
          style={{
            fontSize: '0.55rem',
            color: 'var(--muted)',
            textAlign: 'right',
            marginTop: 2,
          }}
        >
          {samples.length}/{bufferSize} {t('scope.samples', 'pts')}
        </div>
      </div>
    </div>
  )
}

export const ScopeNode = memo(ScopeNodeInner)
