/**
 * OptimizerNode — custom node for optimization blocks (5.03).
 *
 * Renders a rich optimizer UI with:
 * - Input handles for objective + variables
 * - Mini inline SVG convergence chart from computed table
 * - "Best value found: X" summary
 * - Status indicator (waiting / optimized / error)
 * - Output handle for downstream consumption (convergence plot, results table)
 */

import type { CSSProperties } from 'react'
import { memo, useMemo, useCallback } from 'react'
import { Handle, Position, useEdges, type NodeProps, type IsValidConnection } from '@xyflow/react'
import { useComputedValue } from '../../../contexts/ComputedContext'
import { isError, isTable } from '../../../engine/value'
import type { TableValue } from '../../../engine/value'
import { BLOCK_REGISTRY, type NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s, userColorBg } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

/** Extract convergence history (objective values) from the optimizer Table output. */
function extractConvergence(table: TableValue): number[] {
  const objIdx = table.columns.indexOf('objective')
  if (objIdx < 0) return []
  return table.rows.map((r) => r[objIdx] ?? NaN)
}

/** Extract the final optimal variable values from the last row. */
function extractOptimalVars(table: TableValue): { name: string; value: number }[] {
  if (table.rows.length === 0) return []
  const lastRow = table.rows[table.rows.length - 1]
  const results: { name: string; value: number }[] = []
  for (let i = 2; i < table.columns.length; i++) {
    const val = lastRow[i]
    if (val !== undefined && !isNaN(val)) {
      results.push({ name: table.columns[i], value: val })
    }
  }
  return results
}

/** Tiny inline SVG sparkline for convergence. */
function Sparkline({
  data,
  width,
  height,
  color,
}: {
  data: number[]
  width: number
  height: number
  color: string
}) {
  if (data.length < 2) return null

  const filtered = data.filter((d) => isFinite(d))
  if (filtered.length < 2) return null

  const min = Math.min(...filtered)
  const max = Math.max(...filtered)
  const range = max - min || 1

  const points = filtered
    .map((v, i) => {
      const x = (i / (filtered.length - 1)) * width
      const y = height - ((v - min) / range) * (height - 4) - 2
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block' }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Final point dot */}
      {(() => {
        const lastVal = filtered[filtered.length - 1]
        const lx = width
        const ly = height - ((lastVal - min) / range) * (height - 4) - 2
        return <circle cx={lx} cy={ly} r={2.5} fill={color} />
      })()}
    </svg>
  )
}

function OptimizerNodeInner({ id, data, selected, draggable }: NodeProps) {
  const nd = data as NodeData
  const allEdges = useEdges()
  const value = useComputedValue(id)
  const isLocked = draggable === false

  const def = BLOCK_REGISTRY.get(nd.blockType)
  const inputs = def?.inputs ?? []

  const isValidConnection = useCallback<IsValidConnection>(
    (conn) =>
      !allEdges.some((e) => e.target === conn.target && e.targetHandle === conn.targetHandle),
    [allEdges],
  )

  // Parse optimizer output
  const tableResult = useMemo(() => {
    if (!value || !isTable(value)) return null
    return value
  }, [value])

  const convergence = useMemo(
    () => (tableResult ? extractConvergence(tableResult) : []),
    [tableResult],
  )

  const optimalVars = useMemo(
    () => (tableResult ? extractOptimalVars(tableResult) : []),
    [tableResult],
  )

  const bestObjective = useMemo(() => {
    if (convergence.length === 0) return null
    const last = convergence[convergence.length - 1]
    return isFinite(last) ? last : null
  }, [convergence])

  const isErr = value !== undefined && isError(value)
  const errorMsg = isErr ? (value as { message: string }).message : ''
  const hasResult = tableResult !== null && convergence.length > 0
  const status: 'waiting' | 'optimized' | 'error' = isErr
    ? 'error'
    : hasResult
      ? 'optimized'
      : 'waiting'

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const borderOverride = isErr
    ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 1px var(--danger)' }
    : selected
      ? { ...s.nodeSelected, borderColor: typeColor }
      : {}

  const ROW_H = 30

  return (
    <div
      style={{
        ...s.node,
        minWidth: 240,
        maxWidth: 320,
        ...userColorBg(nd.userColor),
        ...borderOverride,
      }}
      role="group"
      aria-label={`${nd.label} optimizer block`}
    >
      {/* Header */}
      <div
        style={{
          ...s.header,
          borderBottom: `2px solid color-mix(in srgb, ${typeColor} 30%, transparent)`,
          background: `linear-gradient(to right, color-mix(in srgb, ${typeColor} 6%, transparent), transparent)`,
        }}
      >
        <div className="cs-node-header-left" style={s.headerLeft}>
          <Icon icon={TypeIcon} size={14} style={{ ...s.headerIcon, color: typeColor }} />
          <span style={s.headerLabel}>{nd.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
          {isLocked && <span style={{ fontSize: '0.6rem', lineHeight: 1, opacity: 0.7 }}>🔒</span>}
          <span style={statusBadgeStyle(status)}>
            {status === 'waiting' && 'Waiting'}
            {status === 'optimized' && 'Done'}
            {status === 'error' && 'Error'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="cs-node-body" style={{ position: 'relative', padding: '0.35rem 0.5rem' }}>
        {/* Input handles */}
        {inputs.map((port) => {
          const connected = allEdges.some((e) => e.target === id && e.targetHandle === port.id)
          return (
            <div
              key={port.id}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                height: ROW_H,
              }}
            >
              <Handle
                type="target"
                position={Position.Left}
                id={port.id}
                isValidConnection={isValidConnection}
                style={{
                  ...(connected ? s.handleLeft : s.handleLeftDisconnected),
                  position: 'relative',
                  transform: 'none',
                  top: 'auto',
                  left: 'auto',
                  marginLeft: -5,
                  flexShrink: 0,
                }}
              />
              <span style={s.portLabel}>{port.label}</span>
              {connected && <span style={connectedBadge}>connected</span>}
            </div>
          )
        })}

        {/* Convergence sparkline */}
        {hasResult && (
          <div style={chartSection}>
            <div style={chartLabel}>Convergence</div>
            <div style={{ padding: '0.15rem 0' }}>
              <Sparkline data={convergence} width={200} height={40} color="var(--primary)" />
            </div>
            <div style={chartMeta}>{convergence.length} iterations</div>
          </div>
        )}

        {/* Best value */}
        {bestObjective !== null && (
          <div style={resultSection}>
            <div style={resultLabel}>Best value found</div>
            <div style={resultValue}>{bestObjective.toPrecision(6)}</div>
          </div>
        )}

        {/* Optimal variables */}
        {optimalVars.length > 0 && (
          <div style={{ marginTop: '0.2rem' }}>
            {optimalVars.map((v) => (
              <div key={v.name} style={varRow}>
                <span style={varName}>{v.name}</span>
                <span style={varValue}>{v.value.toPrecision(6)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Waiting state */}
        {status === 'waiting' && (
          <div style={waitingMsg}>Connect an objective and variables to optimize</div>
        )}

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={{
            ...s.handleRight,
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            right: -6,
          }}
        />
      </div>

      {/* Error footer */}
      {isErr && errorMsg && (
        <div style={s.errorFooter} title={errorMsg}>
          {errorMsg}
        </div>
      )}
    </div>
  )
}

function statusBadgeStyle(status: 'waiting' | 'optimized' | 'error'): CSSProperties {
  const base: CSSProperties = {
    fontSize: '0.55rem',
    fontWeight: 700,
    padding: '0.05rem 0.35rem',
    borderRadius: 3,
    lineHeight: 1.3,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  }
  switch (status) {
    case 'waiting':
      return {
        ...base,
        background: 'rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.4)',
        border: '1px solid rgba(255,255,255,0.1)',
      }
    case 'optimized':
      return {
        ...base,
        background: 'rgba(34,197,94,0.15)',
        color: 'rgb(34,197,94)',
        border: '1px solid rgba(34,197,94,0.3)',
      }
    case 'error':
      return {
        ...base,
        background: 'rgba(239,68,68,0.15)',
        color: 'rgb(239,68,68)',
        border: '1px solid rgba(239,68,68,0.3)',
      }
  }
}

const connectedBadge: CSSProperties = {
  fontSize: '0.55rem',
  color: 'var(--primary)',
  opacity: 0.6,
  fontFamily: 'monospace',
  flexShrink: 0,
  marginLeft: 'auto',
}

const chartSection: CSSProperties = {
  marginTop: '0.35rem',
  padding: '0.25rem 0.3rem',
  background: 'rgba(0,0,0,0.12)',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.05)',
}

const chartLabel: CSSProperties = {
  fontSize: '0.58rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.1rem',
}

const chartMeta: CSSProperties = {
  fontSize: '0.55rem',
  color: 'rgba(255,255,255,0.3)',
  textAlign: 'right',
}

const resultSection: CSSProperties = {
  marginTop: '0.35rem',
  padding: '0.3rem 0.35rem',
  background: 'rgba(28,171,176,0.08)',
  borderRadius: 6,
  border: '1px solid rgba(28,171,176,0.15)',
  textAlign: 'center',
}

const resultLabel: CSSProperties = {
  fontSize: '0.58rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.1rem',
}

const resultValue: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '1.1rem',
  fontWeight: 700,
  color: 'var(--primary)',
}

const varRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.1rem 0.2rem',
  fontSize: '0.68rem',
}

const varName: CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  fontWeight: 600,
}

const varValue: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  color: 'var(--primary)',
  fontWeight: 600,
}

const waitingMsg: CSSProperties = {
  fontSize: '0.65rem',
  color: 'rgba(255,255,255,0.3)',
  textAlign: 'center',
  padding: '0.8rem 0.3rem',
  fontStyle: 'italic',
}

export const OptimizerNode = memo(OptimizerNodeInner)
