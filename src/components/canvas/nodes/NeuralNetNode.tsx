/**
 * NeuralNetNode — custom node for neural network blocks (5.11).
 *
 * Renders NN blocks with:
 * - Architecture diagram showing layers as colored bars
 * - Training status (idle / training / trained / error)
 * - Loss curve sparkline during/after training
 * - Epoch counter and final loss display
 * - Model summary (total params, layer shapes)
 * - Output handle for downstream consumption
 */

import type { CSSProperties } from 'react'
import { memo, useMemo, useCallback } from 'react'
import {
  Handle,
  Position,
  useEdges,
  type NodeProps,
  type IsValidConnection,
} from '@xyflow/react'
import { useComputedValue } from '../../../contexts/ComputedContext'
import { isError, isTable } from '../../../engine/value'
import type { TableValue } from '../../../engine/value'
import { BLOCK_REGISTRY, type NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s, userColorBg } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

/** Color palette for layer types in the architecture diagram. */
const LAYER_COLORS: Record<string, string> = {
  dense: '#3b82f6',
  conv1d: '#8b5cf6',
  dropout: '#6b7280',
  activation: '#f59e0b',
  input: '#10b981',
  output: '#ef4444',
}

/** Extract loss history from trainer output table. */
function extractLossHistory(table: TableValue): number[] {
  const lossIdx = table.columns.indexOf('loss')
  if (lossIdx < 0) {
    // If no 'loss' column, try 'objective' (optimizer-like output)
    const objIdx = table.columns.indexOf('objective')
    if (objIdx < 0) return []
    return table.rows.map((r) => r[objIdx] ?? NaN)
  }
  return table.rows.map((r) => r[lossIdx] ?? NaN)
}

/** Mini sparkline for loss curve. */
function LossSparkline({
  data,
  width,
  height,
}: {
  data: number[]
  width: number
  height: number
}) {
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
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke="#f59e0b"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {(() => {
        const lastVal = filtered[filtered.length - 1]
        const lx = width
        const ly = height - ((lastVal - min) / range) * (height - 4) - 2
        return <circle cx={lx} cy={ly} r={2.5} fill="#f59e0b" />
      })()}
    </svg>
  )
}

/** Mini architecture diagram showing layers as colored bars. */
function ArchitectureDiagram({ layers }: { layers: { type: string; size: number }[] }) {
  if (layers.length === 0) return null

  const maxSize = Math.max(...layers.map((l) => l.size), 1)
  const barWidth = Math.min(16, 180 / layers.length)

  return (
    <svg
      width={layers.length * (barWidth + 2)}
      height={36}
      viewBox={`0 0 ${layers.length * (barWidth + 2)} 36`}
      style={{ display: 'block', margin: '0 auto' }}
    >
      {layers.map((layer, i) => {
        const h = Math.max(6, (layer.size / maxSize) * 30)
        const x = i * (barWidth + 2)
        const y = 36 - h
        const color = LAYER_COLORS[layer.type] ?? '#6b7280'
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx={2}
              fill={color}
              opacity={0.8}
            />
            <title>{`${layer.type}: ${layer.size}`}</title>
          </g>
        )
      })}
    </svg>
  )
}

function NeuralNetNodeInner({ id, data, selected, draggable }: NodeProps) {
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

  const isErr = value !== undefined && isError(value)
  const errorMsg = isErr ? (value as { message: string }).message : ''
  const hasTable = value !== undefined && isTable(value)

  // Parse training output
  const lossHistory = useMemo(() => {
    if (!hasTable) return []
    return extractLossHistory(value as TableValue)
  }, [value, hasTable])

  const finalLoss = useMemo(() => {
    if (lossHistory.length === 0) return null
    const last = lossHistory[lossHistory.length - 1]
    return isFinite(last) ? last : null
  }, [lossHistory])

  const epochs = lossHistory.length

  // Parse layer architecture from node data
  const layers = useMemo(() => {
    const result: { type: string; size: number }[] = []
    // Try to extract from manualValues or from the table output
    const mv = nd.manualValues as Record<string, number> | undefined
    if (nd.blockType === 'nn.dense') {
      result.push({ type: 'dense', size: mv?.units ?? 16 })
    } else if (nd.blockType === 'nn.conv1d') {
      result.push({ type: 'conv1d', size: mv?.filters ?? 8 })
    } else if (nd.blockType === 'nn.dropout') {
      result.push({ type: 'dropout', size: 4 })
    } else if (nd.blockType === 'nn.sequential' || nd.blockType === 'nn.trainer') {
      // For sequential/trainer, show a generic multi-layer diagram
      result.push(
        { type: 'input', size: 8 },
        { type: 'dense', size: 16 },
        { type: 'dense', size: 8 },
        { type: 'output', size: 4 },
      )
    }
    return result
  }, [nd.blockType, nd.manualValues])

  const status: 'idle' | 'trained' | 'error' = isErr
    ? 'error'
    : hasTable && epochs > 0
      ? 'trained'
      : 'idle'

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const borderOverride = isErr
    ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 1px var(--danger)' }
    : selected
      ? { ...s.nodeSelected, borderColor: typeColor }
      : {}

  const ROW_H = 30
  const isTrainer = nd.blockType === 'nn.trainer'
  const isSequential = nd.blockType === 'nn.sequential'

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
      aria-label={`${nd.label} neural network block`}
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
          <span style={nnStatusBadge(status)}>
            {status === 'idle' && 'Idle'}
            {status === 'trained' && 'Trained'}
            {status === 'error' && 'Error'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="cs-node-body" style={{ position: 'relative', padding: '0.35rem 0.5rem' }}>
        {/* Architecture diagram */}
        {(isSequential || isTrainer) && layers.length > 0 && (
          <div style={archSection}>
            <div style={sectionLabel}>Architecture</div>
            <ArchitectureDiagram layers={layers} />
          </div>
        )}

        {/* Input handles */}
        {inputs.map((port) => {
          const connected = allEdges.some(
            (e) => e.target === id && e.targetHandle === port.id,
          )
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
            </div>
          )
        })}

        {/* Training results (for nn.trainer) */}
        {isTrainer && status === 'trained' && (
          <>
            <div style={lossSection}>
              <div style={sectionLabel}>Loss curve</div>
              <LossSparkline data={lossHistory} width={200} height={36} />
              <div style={lossMeta}>
                {epochs} epoch{epochs !== 1 ? 's' : ''}
              </div>
            </div>
            {finalLoss !== null && (
              <div style={resultBox}>
                <div style={sectionLabel}>Final loss</div>
                <div style={lossValue}>{finalLoss.toPrecision(4)}</div>
              </div>
            )}
          </>
        )}

        {/* Idle waiting message */}
        {status === 'idle' && (
          <div style={idleMsg}>
            {isTrainer
              ? 'Connect model and data to train'
              : isSequential
                ? 'Connect layers to build model'
                : 'Connect input to configure'}
          </div>
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

      {isErr && errorMsg && (
        <div style={s.errorFooter} title={errorMsg}>
          {errorMsg}
        </div>
      )}
    </div>
  )
}

function nnStatusBadge(status: 'idle' | 'trained' | 'error'): CSSProperties {
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
    case 'idle':
      return {
        ...base,
        background: 'rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.4)',
        border: '1px solid rgba(255,255,255,0.1)',
      }
    case 'trained':
      return {
        ...base,
        background: 'rgba(245,158,11,0.15)',
        color: 'rgb(245,158,11)',
        border: '1px solid rgba(245,158,11,0.3)',
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

const archSection: CSSProperties = {
  marginBottom: '0.3rem',
  padding: '0.25rem 0.3rem',
  background: 'rgba(0,0,0,0.12)',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.05)',
}

const sectionLabel: CSSProperties = {
  fontSize: '0.55rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.15rem',
}

const lossSection: CSSProperties = {
  marginTop: '0.3rem',
  padding: '0.25rem 0.3rem',
  background: 'rgba(0,0,0,0.12)',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.05)',
}

const lossMeta: CSSProperties = {
  fontSize: '0.55rem',
  color: 'rgba(255,255,255,0.3)',
  textAlign: 'right',
}

const resultBox: CSSProperties = {
  marginTop: '0.25rem',
  padding: '0.25rem 0.35rem',
  background: 'rgba(245,158,11,0.08)',
  borderRadius: 6,
  border: '1px solid rgba(245,158,11,0.15)',
  textAlign: 'center',
}

const lossValue: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '1rem',
  fontWeight: 700,
  color: '#f59e0b',
}

const idleMsg: CSSProperties = {
  fontSize: '0.65rem',
  color: 'rgba(255,255,255,0.3)',
  textAlign: 'center',
  padding: '0.6rem 0.3rem',
  fontStyle: 'italic',
}

export const NeuralNetNode = memo(NeuralNetNodeInner)
