/**
 * DeadZoneNode — 2.67: Dead Zone nonlinear control element.
 *
 * Applies an offset dead zone to its scalar input u:
 *   - |u| ≤ band → 0
 *   - u >  band  → u − band
 *   - u < −band  → u + band
 *
 * The result is output via node.data.value → engine sees 'number' source.
 * Input edges are excluded from the engine snapshot by bridge.ts.
 */

import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { Handle, Position, useEdges, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { useComputed } from '../../../contexts/ComputedContext'
import { isScalar } from '../../../engine/value'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

// ── Types ──────────────────────────────────────────────────────────────────────

interface DeadZoneNodeData extends NodeData {
  dzBand?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyDeadZone(u: number, band: number): number {
  if (isNaN(u) || isNaN(band)) return NaN
  const b = Math.abs(band)
  if (Math.abs(u) <= b) return 0
  return u > 0 ? u - b : u + b
}

function fmtNum(n: number): string {
  if (!isFinite(n)) return String(n)
  if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential(3)
  return parseFloat(n.toPrecision(5)).toString()
}

// ── Component ─────────────────────────────────────────────────────────────────

function DeadZoneNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as DeadZoneNodeData
  const { updateNodeData } = useReactFlow()
  const computed = useComputed()
  const edges = useEdges()

  const band = nd.dzBand ?? 0.1

  // Resolve upstream value
  const inputEdge = edges.find((e) => e.target === id && e.targetHandle === 'u')
  const upstream = inputEdge ? computed.get(inputEdge.source) : undefined
  const inputVal = upstream && isScalar(upstream) ? upstream.value : NaN

  const outputVal = useMemo(() => applyDeadZone(inputVal, band), [inputVal, band])

  // Push to engine
  const prevRef = useRef<number>(NaN)
  useEffect(() => {
    if (outputVal !== prevRef.current) {
      prevRef.current = outputVal
      updateNodeData(id, { value: isNaN(outputVal) ? 0 : outputVal })
    }
  }, [id, outputVal, updateNodeData])

  const updateField = useCallback(
    (patch: Partial<DeadZoneNodeData>) => updateNodeData(id, patch),
    [id, updateNodeData],
  )

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const hasInput = !isNaN(inputVal)
  const isActive = hasInput && outputVal === 0
  const statusColor = !hasInput ? 'var(--muted)' : isActive ? '#3b82f6' : '#1CABB0'

  return (
    <div
      style={{
        ...s.node,
        minWidth: 160,
        ...(selected ? { ...s.nodeSelected, borderColor: typeColor } : {}),
      }}
      role="group"
      aria-label={nd.label}
    >
      <div style={{ ...s.header, borderBottom: `2px solid ${statusColor}44` }}>
        <div className="cs-node-header-left" style={s.headerLeft}>
          <Icon icon={TypeIcon} size={14} style={{ ...s.headerIcon, color: typeColor }} />
          <span style={s.headerLabel}>{nd.label}</span>
        </div>
        <span
          style={{
            fontSize: '0.65rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: statusColor,
          }}
        >
          {hasInput ? fmtNum(outputVal) : '—'}
        </span>
      </div>

      <div className="cs-node-body" style={{ ...s.body, padding: '0.5rem 0.6rem' }}>
        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="u"
          style={{ ...s.handleLeft, top: '50%', transform: 'translateY(-50%)' }}
        />

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={{ ...s.handleRight, top: '50%', transform: 'translateY(-50%)' }}
        />

        {/* Dead zone visualizer (tiny inline diagram) */}
        <svg
          width={120}
          height={60}
          style={{ display: 'block', margin: '0 auto 6px' }}
          viewBox="-2 -2 124 64"
        >
          {/* Axes */}
          <line x1={0} y1={30} x2={120} y2={30} stroke="var(--muted)" strokeWidth={1} />
          <line x1={60} y1={0} x2={60} y2={60} stroke="var(--muted)" strokeWidth={1} />
          {/* Dead zone lines */}
          <polyline
            points={`0,60 ${60 - band * 40},30 ${60 - band * 40},30 ${60 + band * 40},30 ${60 + band * 40},30 120,0`}
            fill="none"
            stroke={typeColor}
            strokeWidth={1.5}
          />
          {/* Band markers */}
          <line
            x1={60 - band * 40}
            y1={26}
            x2={60 - band * 40}
            y2={34}
            stroke="var(--muted)"
            strokeWidth={1}
          />
          <line
            x1={60 + band * 40}
            y1={26}
            x2={60 + band * 40}
            y2={34}
            stroke="var(--muted)"
            strokeWidth={1}
          />
          {/* Input dot */}
          {hasInput && (
            <circle
              cx={60 + Math.max(-2, Math.min(2, inputVal)) * 20}
              cy={30 - Math.max(-2, Math.min(2, outputVal)) * 20}
              r={3}
              fill={statusColor}
            />
          )}
        </svg>

        {/* Band config */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)', width: 32, flexShrink: 0 }}>
            {t('deadZone.band', 'Band')}:
          </span>
          <input
            type="number"
            value={band}
            min={0}
            step={0.01}
            onChange={(e) => updateField({ dzBand: parseFloat(e.target.value) || 0 })}
            className="nodrag"
            style={{
              flex: 1,
              fontSize: '0.65rem',
              padding: '1px 4px',
              borderRadius: 3,
              border: '1px solid var(--border)',
              background: 'var(--input-bg, var(--card))',
              color: 'var(--text)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          />
        </div>

        {/* u → y display */}
        {hasInput && (
          <div
            style={{
              marginTop: 4,
              fontSize: '0.6rem',
              color: 'var(--muted)',
              fontFamily: "'JetBrains Mono', monospace",
              textAlign: 'center',
            }}
          >
            u={fmtNum(inputVal)} → y={fmtNum(outputVal)}
          </div>
        )}
      </div>
    </div>
  )
}

export const DeadZoneNode = memo(DeadZoneNodeInner)
