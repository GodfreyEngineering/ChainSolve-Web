/**
 * GroupNode — visual container for grouped nodes on the canvas.
 *
 * Uses React Flow's parent-child mechanism: member nodes have `parentId`
 * pointing to this node. Dragging the group drags all members automatically.
 *
 * When collapsed, renders proxy handles for cross-boundary connections and
 * hides member nodes.
 */

import { memo, useCallback } from 'react'
import { Handle, Position, useNodes, type NodeProps, type Node } from '@xyflow/react'
import type { NodeData } from '../../../blocks/types'
import type { ProxyHandle } from '../../../lib/groups'

const DEFAULT_COLOR = '#1CABB0'

function GroupNodeInner({ id, data, selected }: NodeProps<Node<NodeData>>) {
  const nd = data as NodeData
  const color = nd.groupColor ?? DEFAULT_COLOR
  const collapsed = nd.groupCollapsed ?? false
  const proxyHandles = ((nd as Record<string, unknown>).__proxyHandles ?? []) as ProxyHandle[]

  const allNodes = useNodes()
  const memberCount = allNodes.filter((n) => n.parentId === id).length

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // Double-click handled by Inspector for rename
  }, [])

  if (collapsed) {
    return (
      <div
        onDoubleClick={onDoubleClick}
        style={{
          ...collapsedStyle,
          borderColor: selected ? color : `${color}88`,
          boxShadow: selected
            ? `0 0 0 2px ${color}55, 0 3px 12px rgba(0,0,0,0.4)`
            : '0 3px 12px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{ ...headerStyle, background: `${color}33` }}>
          <span style={{ ...colorDot, background: color }} />
          <span style={labelStyle}>{nd.label}</span>
          <span style={badgeStyle}>{memberCount}n</span>
          <span style={chevronStyle}>{'▶'}</span>
        </div>

        {/* Proxy handles */}
        {proxyHandles.length > 0 && (
          <div style={proxyBody}>
            {proxyHandles
              .filter((h) => h.type === 'target')
              .map((h, i) => (
                <div key={h.id} style={proxyRow}>
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={h.id}
                    style={{
                      ...proxyHandleStyle,
                      background: color,
                      top: 'auto',
                    }}
                  />
                  <span style={proxyLabel}>{h.label}</span>
                  {i === 0 && <span style={proxyDirLabel}>IN</span>}
                </div>
              ))}
            {proxyHandles
              .filter((h) => h.type === 'source')
              .map((h, i) => (
                <div key={h.id} style={proxyRow}>
                  <span style={{ ...proxyLabel, textAlign: 'right' }}>{h.label}</span>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={h.id}
                    style={{
                      ...proxyHandleStyle,
                      background: '#22c55e',
                      top: 'auto',
                    }}
                  />
                  {i === 0 && <span style={{ ...proxyDirLabel, right: 22 }}>OUT</span>}
                </div>
              ))}
          </div>
        )}
      </div>
    )
  }

  // Expanded state — transparent container
  return (
    <div
      onDoubleClick={onDoubleClick}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 12,
        border: `2px ${selected ? 'solid' : 'dashed'} ${selected ? color : `${color}66`}`,
        background: `${color}0A`,
        boxShadow: selected
          ? `0 0 0 2px ${color}35, 0 3px 12px rgba(0,0,0,0.2)`
          : '0 2px 8px rgba(0,0,0,0.15)',
        fontFamily: "'Montserrat', system-ui, sans-serif",
        overflow: 'visible',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.3rem 0.6rem',
          height: GROUP_HEADER_HEIGHT,
          borderBottom: `1px solid ${color}33`,
          background: `${color}15`,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          cursor: 'grab',
        }}
      >
        <span style={{ ...colorDot, background: color }} />
        <span style={labelStyle}>{nd.label}</span>
        <span style={badgeStyle}>{memberCount}n</span>
        <span style={chevronStyle}>{'▼'}</span>
      </div>
    </div>
  )
}

export const GroupNode = memo(GroupNodeInner)

const GROUP_HEADER_HEIGHT = 36

// ── Styles ──────────────────────────────────────────────────────────────────

const collapsedStyle: React.CSSProperties = {
  minWidth: 180,
  background: '#383838',
  border: '2px solid',
  borderRadius: 10,
  fontFamily: "'Montserrat', system-ui, sans-serif",
  fontSize: '0.8rem',
  color: '#F4F4F3',
  overflow: 'hidden',
  boxSizing: 'border-box',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.3rem 0.6rem',
  height: GROUP_HEADER_HEIGHT,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  cursor: 'grab',
}

const colorDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  flexShrink: 0,
}

const labelStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '0.73rem',
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flex: 1,
}

const badgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 600,
  color: 'rgba(244,244,243,0.5)',
  flexShrink: 0,
}

const chevronStyle: React.CSSProperties = {
  fontSize: '0.6rem',
  opacity: 0.5,
  flexShrink: 0,
}

const proxyBody: React.CSSProperties = {
  padding: '0.3rem 0.6rem',
}

const proxyRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
  padding: '0.15rem 0',
  minHeight: 22,
  gap: '0.3rem',
}

const proxyLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'rgba(244,244,243,0.6)',
  flex: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const proxyDirLabel: React.CSSProperties = {
  position: 'absolute',
  left: 22,
  top: -8,
  fontSize: '0.55rem',
  fontWeight: 700,
  color: 'rgba(244,244,243,0.3)',
  letterSpacing: '0.05em',
}

const proxyHandleStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  border: '2px solid #383838',
  position: 'relative',
}
