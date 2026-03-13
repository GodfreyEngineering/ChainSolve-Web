/**
 * MLModelNode — custom node for ML model blocks (5.08).
 *
 * Renders ML model blocks with:
 * - Input handles for training features + labels
 * - Status badge (waiting / trained / error)
 * - Model summary (coefficients, R², type info)
 * - Output handle for downstream (predict, metrics)
 */

import type { CSSProperties } from 'react'
import { memo, useMemo, useCallback } from 'react'
import { Handle, Position, useEdges, type NodeProps, type IsValidConnection } from '@xyflow/react'
import { useComputedValue } from '../../../contexts/ComputedContext'
import { isError, isTable, isScalar } from '../../../engine/value'
import type { TableValue } from '../../../engine/value'
import { BLOCK_REGISTRY, type NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s, userColorBg } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

/** Friendly descriptions for model types. */
const MODEL_DESCRIPTIONS: Record<string, string> = {
  'ml.linearRegression': 'Linear fit (y = ax + b)',
  'ml.polynomialRegression': 'Polynomial curve fit',
  'ml.knnClassifier': 'K-Nearest Neighbors',
  'ml.decisionTree': 'Decision tree',
}

function MLModelNodeInner({ id, data, selected, draggable }: NodeProps) {
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
  const hasScalar = value !== undefined && isScalar(value)
  const hasTrained = hasTable || hasScalar

  const status: 'waiting' | 'trained' | 'error' = isErr
    ? 'error'
    : hasTrained
      ? 'trained'
      : 'waiting'

  // Extract model info from table output
  const modelInfo = useMemo(() => {
    if (!hasTable) return null
    const table = value as TableValue
    const rows = table.rows.length
    const cols = table.columns.length
    return { rows, cols, columns: table.columns }
  }, [value, hasTable])

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)
  const modelDesc = MODEL_DESCRIPTIONS[nd.blockType] ?? 'ML Model'

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
        minWidth: 220,
        maxWidth: 300,
        ...userColorBg(nd.userColor),
        ...borderOverride,
      }}
      role="group"
      aria-label={`${nd.label} ML model block`}
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
          <span style={statusBadge(status)}>
            {status === 'waiting' && 'Idle'}
            {status === 'trained' && 'Trained'}
            {status === 'error' && 'Error'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="cs-node-body" style={{ position: 'relative', padding: '0.35rem 0.5rem' }}>
        {/* Model type description */}
        <div style={descStyle}>{modelDesc}</div>

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
              {connected && <span style={connBadge}>&#9654;</span>}
            </div>
          )
        })}

        {/* Model output summary */}
        {status === 'trained' && modelInfo && (
          <div style={summaryBox}>
            <div style={summaryLabel}>Model trained</div>
            <div style={summaryMeta}>
              {modelInfo.rows} coefficient{modelInfo.rows !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {status === 'trained' && hasScalar && (
          <div style={summaryBox}>
            <div style={summaryLabel}>Output</div>
            <div style={scalarDisplay}>{(value as { value: number }).value.toPrecision(6)}</div>
          </div>
        )}

        {/* Waiting state */}
        {status === 'waiting' && <div style={waitingStyle}>Connect training data to fit model</div>}

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

function statusBadge(status: 'waiting' | 'trained' | 'error'): CSSProperties {
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
    case 'trained':
      return {
        ...base,
        background: 'rgba(59,130,246,0.15)',
        color: 'rgb(96,165,250)',
        border: '1px solid rgba(59,130,246,0.3)',
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

const descStyle: CSSProperties = {
  fontSize: '0.6rem',
  color: 'rgba(255,255,255,0.35)',
  fontStyle: 'italic',
  marginBottom: '0.2rem',
}

const connBadge: CSSProperties = {
  fontSize: '0.55rem',
  color: 'var(--primary)',
  opacity: 0.6,
  flexShrink: 0,
  marginLeft: 'auto',
}

const summaryBox: CSSProperties = {
  marginTop: '0.3rem',
  padding: '0.25rem 0.35rem',
  background: 'rgba(59,130,246,0.08)',
  borderRadius: 6,
  border: '1px solid rgba(59,130,246,0.15)',
  textAlign: 'center',
}

const summaryLabel: CSSProperties = {
  fontSize: '0.55rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const summaryMeta: CSSProperties = {
  fontSize: '0.65rem',
  color: 'rgba(255,255,255,0.6)',
  fontFamily: "'JetBrains Mono', monospace",
}

const scalarDisplay: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '1rem',
  fontWeight: 700,
  color: 'var(--primary)',
}

const waitingStyle: CSSProperties = {
  fontSize: '0.65rem',
  color: 'rgba(255,255,255,0.3)',
  textAlign: 'center',
  padding: '0.6rem 0.3rem',
  fontStyle: 'italic',
}

export const MLModelNode = memo(MLModelNodeInner)
