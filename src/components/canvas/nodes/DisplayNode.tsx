/**
 * DisplayNode — output block that shows the computed value prominently.
 * Has one target handle (left) and no source handle.
 *
 * SCI-16: Right-click the value area → context menu with copy options:
 *   "Copy (full precision)" — 17 significant digits
 *   "Copy (scientific notation)" — toExponential(15)
 *   "Copy with unit" — formatted value + unit symbol
 */

import { memo, useMemo, useState, useEffect, useRef } from 'react'
import { Handle, Position, useEdges, useNodes, type NodeProps } from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { isError, isScalar } from '../../../engine/value'
import { useFormatValue } from '../../../hooks/useFormatValue'
import { BLOCK_REGISTRY, type NodeData } from '../../../blocks/registry'
import { getUnitSymbol } from '../../../units/unitSymbols'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

interface CopyMenu {
  x: number
  y: number
}

function DisplayNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const computed = useComputed()
  const value = computed.get(id)
  const formatValue = useFormatValue()
  const edges = useEdges()
  const nodes = useNodes()
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
  const unitSymbol = nd.unit ? getUnitSymbol(nd.unit) : ''

  return (
    <div
      style={{
        ...s.node,
        minWidth: 140,
        ...borderOverride,
      }}
    >
      <div
        style={{
          ...s.header,
          borderBottom: `2px solid color-mix(in srgb, ${typeColor} 30%, transparent)`,
          background: `linear-gradient(to right, color-mix(in srgb, ${typeColor} 6%, transparent), transparent)`,
        }}
      >
        <div style={s.headerLeft}>
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
        {/* SCI-16: Right-click for copy menu */}
        <span
          style={{ ...displayStyle, cursor: scalarValue !== null ? 'context-menu' : undefined }}
          className="nodrag"
          onContextMenu={handleContextMenu}
        >
          {formatValue(value)}
          {nd.unit && (
            <span style={{ fontSize: '0.7rem', marginLeft: '0.2rem', opacity: 0.7 }}>
              {unitSymbol}
            </span>
          )}
        </span>
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
              <span style={{ fontSize: '0.65rem', opacity: 0.45, marginLeft: 8, fontFamily: 'monospace' }}>
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
