/**
 * DisplayNode — output block that shows the computed value prominently.
 * Has one target handle (left) and no source handle.
 *
 * SCI-16: Right-click the value area → context menu with copy options:
 *   "Copy (full precision)" — 17 significant digits
 *   "Copy (scientific notation)" — toExponential(15)
 *   "Copy with unit" — formatted value + unit symbol
 */

import { memo, useMemo, useState, useEffect, useRef, type CSSProperties } from 'react'
import { Handle, Position, useEdges, useNodes, type NodeProps } from '@xyflow/react'
import { useComputedValue } from '../../../contexts/ComputedContext'
import { isError, isScalar, formatValue as rawFormatValue } from '../../../engine/value'
import type { FormatOptions } from '../../../engine/value'
import { useFormatValue } from '../../../hooks/useFormatValue'
import { usePreferencesStore } from '../../../stores/preferencesStore'
import { BLOCK_REGISTRY, type NodeData } from '../../../blocks/registry'
import { getUnitSymbol } from '../../../units/unitSymbols'
import { useInferredUnits } from '../../../hooks/useInferredUnits'
import { NODE_STYLES as s, userColorBg } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

interface CopyMenu {
  x: number
  y: number
}

// ── 3.18: Inline mini-visualizations ─────────────────────────────────────────

const SPARK_W = 88
const SPARK_H = 28

/** VectorSparkline — tiny SVG line chart for 1D vector values. */
function VectorSparkline({ values }: { values: readonly number[] }) {
  if (values.length < 2) return null
  const finite = values.filter(isFinite)
  if (finite.length < 2) return null
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * SPARK_W
    const y = SPARK_H - ((isFinite(v) ? v - min : min) / range) * SPARK_H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      style={{ display: 'block', overflow: 'visible' } as CSSProperties}
      aria-hidden="true"
    >
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="var(--value-color-vector, #4ade80)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.85}
      />
    </svg>
  )
}

const HEAT_CELL = 5
const HEAT_MAX_CELLS = 14 // max columns or rows displayed

/** MatrixHeatmap — tiny colour-coded density grid for table values. */
function MatrixHeatmap({ rows, cols }: { rows: readonly (readonly number[])[]; cols: readonly string[] }) {
  const displayRows = rows.slice(0, HEAT_MAX_CELLS)
  const colCount = Math.min((cols.length || displayRows[0]?.length || 0), HEAT_MAX_CELLS)
  if (displayRows.length === 0 || colCount === 0) return null

  // Compute global min/max for normalization
  let gmin = Infinity
  let gmax = -Infinity
  for (const row of displayRows) {
    for (let c = 0; c < colCount; c++) {
      const v = row[c]
      if (typeof v === 'number' && isFinite(v)) {
        if (v < gmin) gmin = v
        if (v > gmax) gmax = v
      }
    }
  }
  const grange = gmax - gmin || 1

  const w = colCount * HEAT_CELL
  const h = displayRows.length * HEAT_CELL

  return (
    <svg width={w} height={h} style={{ display: 'block' } as CSSProperties} aria-hidden="true">
      {displayRows.map((row, ri) =>
        Array.from({ length: colCount }, (_, ci) => {
          const v = row[ci]
          const norm = typeof v === 'number' && isFinite(v) ? (v - gmin) / grange : 0.5
          // Blue (cold) → red (hot) interpolation through green
          const r = Math.round(norm * 220)
          const g = Math.round(120 - Math.abs(norm - 0.5) * 120)
          const b = Math.round((1 - norm) * 220)
          return (
            <rect
              key={`${ri}-${ci}`}
              x={ci * HEAT_CELL}
              y={ri * HEAT_CELL}
              width={HEAT_CELL}
              height={HEAT_CELL}
              fill={`rgb(${r},${g},${b})`}
              opacity={0.85}
            />
          )
        }),
      )}
    </svg>
  )
}

/** PREC-02: Converts a displayPrecision string to FormatOptions overrides. */
function precisionToOpts(displayPrecision: string | undefined): FormatOptions | null {
  if (!displayPrecision || displayPrecision === 'global') return null
  switch (displayPrecision) {
    case 'integer':
      return { numberDisplayMode: 'decimal', decimalPlaces: 0 }
    case '2dp':
      return { numberDisplayMode: 'decimal', decimalPlaces: 2 }
    case '4dp':
      return { numberDisplayMode: 'decimal', decimalPlaces: 4 }
    case '8dp':
      return { numberDisplayMode: 'decimal', decimalPlaces: 8 }
    case '15dp':
      return { numberDisplayMode: 'decimal', decimalPlaces: 15 }
    case 'scientific':
      return { numberDisplayMode: 'scientific', decimalPlaces: 4 }
    case 'sig_figs_3':
      return { numberDisplayMode: 'sig_figs', sigFigs: 3 }
    case 'sig_figs_6':
      return { numberDisplayMode: 'sig_figs', sigFigs: 6 }
    default:
      return null
  }
}

function DisplayNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const value = useComputedValue(id)
  const globalFormatValue = useFormatValue()
  const decimalSeparator = usePreferencesStore((s) => s.decimalSeparator)
  const thousandsSeparator = usePreferencesStore((s) => s.thousandsSeparator)
  const thousandsSeparatorChar = usePreferencesStore((s) => s.thousandsSeparatorChar)

  // PREC-02: if this node has a per-node precision override, apply it
  const precOpts = precisionToOpts(nd.displayPrecision)
  const formatValue = precOpts
    ? (v: Parameters<typeof globalFormatValue>[0]) =>
        rawFormatValue(v, undefined, {
          decimalSeparator,
          thousandsSeparator,
          thousandsSeparatorChar,
          ...precOpts,
        })
    : globalFormatValue
  const edges = useEdges()
  const nodes = useNodes()
  // 4.05: Inferred unit from upstream propagation
  const inferredUnits = useInferredUnits()
  const inferredUnit = inferredUnits.get(id)
  const [copyMenu, setCopyMenu] = useState<CopyMenu | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const isErrVal =
    value !== undefined && (isError(value) || (isScalar(value) && isNaN(value.value)))
  const displayStyle: React.CSSProperties = {
    ...s.displayValue,
    ...(isErrVal ? { color: 'var(--danger-text)', opacity: 0.7 } : {}),
  }

  // G4-1: Derive a source label from the connected upstream block
  const sourceLabel = useMemo(() => {
    const edge = edges.find((e) => e.target === id && e.targetHandle === 'value')
    if (!edge) return null
    const srcNode = nodes.find((n) => n.id === edge.source)
    if (!srcNode) return null
    const srcData = srcNode.data as NodeData | undefined
    const srcDef = srcData ? BLOCK_REGISTRY.get(srcData.blockType) : undefined
    return srcDef?.label ?? srcData?.label ?? null
  }, [edges, nodes, id])

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const borderOverride = isErrVal
    ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 1px var(--danger)' }
    : selected
      ? { ...s.nodeSelected, borderColor: typeColor }
      : {}

  // Close menu on outside click
  useEffect(() => {
    if (!copyMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCopyMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [copyMenu])

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isScalar(value as never)) return // only show menu for scalar values
    e.preventDefault()
    e.stopPropagation()
    setCopyMenu({ x: e.clientX, y: e.clientY })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopyMenu(null)
  }

  const scalarValue = value && isScalar(value) ? value.value : null
  // 4.05: Show explicit unit, or fall back to inferred unit
  const explicitUnit = nd.unit as string | undefined
  const unitSymbol = explicitUnit ? getUnitSymbol(explicitUnit) : (inferredUnit?.unit ?? '')

  const ariaLabel = `${nd.label} display, value: ${formatValue(value)}`

  return (
    <div
      style={{
        ...s.node,
        minWidth: 140,
        ...userColorBg(nd.userColor),
        ...borderOverride,
      }}
      role="group"
      aria-label={ariaLabel}
    >
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
      </div>

      <div
        className="cs-node-body"
        style={{
          ...s.body,
          textAlign: 'center',
          position: 'relative',
          minHeight: 48,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          id="value"
          style={{ ...s.handleLeft, top: '50%', transform: 'translateY(-50%)' }}
        />
        {/* 16.66: aria-live region — announces value changes to screen readers.
            aria-live="polite" won't interrupt ongoing speech; aria-atomic="true"
            ensures the full value is announced rather than just the diff. */}
        <span
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
          }}
        >
          {nd.label}: {formatValue(value)}
        </span>
        {/* SCI-16: Right-click for copy menu */}
        <span
          style={{ ...displayStyle, cursor: scalarValue !== null ? 'context-menu' : undefined }}
          className="nodrag"
          onContextMenu={handleContextMenu}
          title={scalarValue !== null ? String(scalarValue) : undefined}
        >
          {formatValue(value)}
          {unitSymbol && (
            <span
              style={{
                fontSize: '0.85rem',
                marginLeft: '0.25rem',
                padding: '0.05rem 0.3rem',
                borderRadius: 4,
                background: explicitUnit ? 'rgba(28,171,176,0.12)' : 'rgba(255,255,255,0.04)',
                border: explicitUnit
                  ? '1px solid rgba(28,171,176,0.2)'
                  : '1px dashed rgba(255,255,255,0.1)',
                opacity: explicitUnit ? 0.85 : 0.55,
                fontStyle: explicitUnit ? undefined : 'italic',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
              }}
            >
              {unitSymbol}
            </span>
          )}
        </span>
        {/* 3.18: Inline mini-visualizations for vectors and tables */}
        {value?.kind === 'vector' && value.value.length >= 2 && (
          <div style={{ marginTop: 2 }}>
            <VectorSparkline values={value.value} />
          </div>
        )}
        {value?.kind === 'table' && value.rows.length > 0 && (
          <div style={{ marginTop: 2 }}>
            <MatrixHeatmap rows={value.rows} cols={value.columns} />
          </div>
        )}

        {sourceLabel && (
          <span
            style={{
              fontSize: '0.55rem',
              color: 'rgba(244,244,243,0.3)',
              letterSpacing: '0.03em',
              userSelect: 'none',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {sourceLabel}
          </span>
        )}
      </div>

      {/* SCI-16: Copy context menu rendered as a fixed portal-like overlay */}
      {copyMenu && scalarValue !== null && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: copyMenu.x,
            top: copyMenu.y,
            zIndex: 9999,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
            padding: '4px 0',
            minWidth: 210,
            fontSize: '0.8rem',
          }}
        >
          {[
            {
              label: 'Copy (full precision)',
              value: scalarValue.toPrecision(17),
            },
            {
              label: 'Copy (scientific notation)',
              value: scalarValue.toExponential(15),
            },
            ...(unitSymbol
              ? [
                  {
                    label: 'Copy with unit',
                    value: `${scalarValue.toPrecision(17)} ${unitSymbol}`,
                  },
                ]
              : []),
          ].map((item) => (
            <button
              key={item.label}
              style={menuItemStyle}
              onClick={() => copyToClipboard(item.value)}
            >
              {item.label}
              <span
                style={{
                  fontSize: '0.65rem',
                  opacity: 0.45,
                  marginLeft: 8,
                  fontFamily: 'monospace',
                }}
              >
                {item.value.length > 22 ? item.value.slice(0, 20) + '…' : item.value}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '6px 14px',
  background: 'transparent',
  border: 'none',
  color: 'var(--text)',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: '0.8rem',
  gap: 4,
}

export const DisplayNode = memo(DisplayNodeInner)
