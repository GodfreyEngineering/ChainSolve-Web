/**
 * GroupNode — visual container for grouped nodes on the canvas.
 *
 * Uses React Flow's parent-child mechanism: member nodes have `parentId`
 * pointing to this node. Dragging the group drags all members automatically.
 *
 * When collapsed, renders proxy handles for cross-boundary connections and
 * hides member nodes.
 *
 * UX-21 additions:
 *   - Double-click label → inline rename
 *   - Click color dot → mini color picker (8 presets)
 *   - Lock indicator when groupLocked = true
 *   - Improved badge styling
 */

import { memo, useCallback, useState, useRef } from 'react'
import { Handle, Position, useNodes, useReactFlow, type NodeProps, type Node } from '@xyflow/react'
import type { NodeData } from '../../../blocks/types'
import type { ProxyHandle } from '../../../lib/groups'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

const DEFAULT_COLOR = 'var(--primary)'

const GROUP_COLORS = [
  '#1CABB0',
  '#6366f1',
  '#f59e0b',
  '#ef4444',
  '#22c55e',
  '#ec4899',
  '#8b5cf6',
  '#64748b',
]

function GroupNodeInner({ id, data, selected }: NodeProps<Node<NodeData>>) {
  const nd = data as NodeData
  const color = nd.groupColor ?? DEFAULT_COLOR
  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)
  const collapsed = nd.groupCollapsed ?? false
  const locked = nd.groupLocked ?? false
  const asSubGraph = nd.groupAsSubGraph ?? false
  const proxyHandles = ((nd as Record<string, unknown>).__proxyHandles ?? []) as ProxyHandle[]

  const allNodes = useNodes()
  const memberCount = allNodes.filter((n) => n.parentId === id).length
  const { updateNodeData } = useReactFlow()

  // UX-21: Inline rename state
  const [renaming, setRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // UX-21: Color picker state
  const [colorPickerOpen, setColorPickerOpen] = useState(false)

  const startRename = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setRenameDraft(nd.label)
      setRenaming(true)
      setTimeout(() => renameInputRef.current?.select(), 0)
    },
    [nd.label],
  )

  const commitRename = useCallback(() => {
    const trimmed = renameDraft.trim()
    if (trimmed) updateNodeData(id, { label: trimmed })
    setRenaming(false)
  }, [renameDraft, id, updateNodeData])

  const cancelRename = useCallback(() => {
    setRenaming(false)
  }, [])

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      startRename(e)
    },
    [startRename],
  )

  const handleColorPick = useCallback(
    (c: string) => {
      updateNodeData(id, { groupColor: c })
      setColorPickerOpen(false)
    },
    [id, updateNodeData],
  )

  const toggleLock = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      updateNodeData(id, { groupLocked: !locked })
    },
    [id, locked, updateNodeData],
  )

  /** Shared header content (label + rename + color dot + badges). */
  const renderHeaderContent = () => (
    <>
      <Icon icon={TypeIcon} size={14} style={{ flexShrink: 0, opacity: 0.7, color: typeColor }} />

      {/* Color dot — click to toggle color picker */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <span
          style={{
            ...colorDot,
            background: color,
            cursor: 'pointer',
            outline: colorPickerOpen ? '2px solid rgba(255,255,255,0.6)' : 'none',
            outlineOffset: 1,
          }}
          onClick={(e) => {
            e.stopPropagation()
            setColorPickerOpen((v) => !v)
          }}
          title="Change group color"
        />
        {colorPickerOpen && (
          <div style={colorPickerStyle}>
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                style={{
                  ...colorSwatchStyle,
                  background: c,
                  border: c === color ? '2px solid rgba(255,255,255,0.9)' : '2px solid transparent',
                  transform: c === color ? 'scale(1.15)' : 'scale(1)',
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleColorPick(c)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Label or inline rename input */}
      {renaming ? (
        <input
          ref={renameInputRef}
          value={renameDraft}
          onChange={(e) => setRenameDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitRename()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              cancelRename()
            }
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          style={{
            flex: 1,
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${color}88`,
            borderRadius: 4,
            color: 'var(--text)',
            fontSize: '0.73rem',
            fontWeight: 700,
            fontFamily: 'inherit',
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            padding: '0 4px',
            outline: 'none',
            minWidth: 0,
          }}
        />
      ) : (
        <span style={labelStyle} onDoubleClick={onDoubleClick} title="Double-click to rename">
          {nd.label}
        </span>
      )}

      {/* Member count badge */}
      <span
        style={{
          ...badgeStyle,
          background: `${color}22`,
          border: `1px solid ${color}44`,
          color: color,
        }}
      >
        {memberCount}n
      </span>

      {/* Lock indicator */}
      {locked && (
        <span
          onClick={toggleLock}
          title="Group is locked — click to unlock"
          style={{ fontSize: '0.65rem', flexShrink: 0, cursor: 'pointer', opacity: 0.7 }}
        >
          🔒
        </span>
      )}
      {!locked && selected && (
        <span
          onClick={toggleLock}
          title="Lock group to prevent accidental edits"
          style={{ fontSize: '0.65rem', flexShrink: 0, cursor: 'pointer', opacity: 0.3 }}
        >
          🔓
        </span>
      )}

      <span style={chevronStyle}>{collapsed ? '▶' : '▼'}</span>
    </>
  )

  if (collapsed && asSubGraph) {
    // 3.31: SubGraph mode — render as a solid composite block (Houdini Digital Asset style)
    const inHandles = proxyHandles.filter((h) => h.type === 'target')
    const outHandles = proxyHandles.filter((h) => h.type === 'source')
    const maxPorts = Math.max(inHandles.length, outHandles.length, 1)
    return (
      <div style={{
        minWidth: 180, maxWidth: 260,
        background: 'var(--surface-2)',
        border: `1.5px solid ${selected ? color : color + '88'}`,
        borderRadius: 8,
        boxShadow: selected
          ? `0 0 0 2px ${color}55, 0 4px 16px rgba(0,0,0,0.5)`
          : '0 3px 12px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}>
        {/* Solid header — block style */}
        <div style={{
          background: color,
          padding: '4px 8px',
          display: 'flex', alignItems: 'center', gap: 6,
          borderBottom: `1px solid ${color}66`,
        }}>
          <span style={{ fontSize: 9, opacity: 0.9 }}>⊞</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nd.label}
          </span>
          <span style={{ fontSize: 8, color: `${color}cc`, background: 'rgba(255,255,255,0.2)', padding: '0 4px', borderRadius: 3 }}>
            ⊞ SubGraph
          </span>
        </div>
        {/* Port rows */}
        <div style={{ padding: '4px 0', minHeight: maxPorts * 22 + 8 }}>
          {Array.from({ length: maxPorts }, (_, i) => {
            const inH = inHandles[i]
            const outH = outHandles[i]
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1px 10px', minHeight: 22, position: 'relative' }}>
                {inH ? (
                  <>
                    <Handle type="target" position={Position.Left} id={inH.id} style={{ position: 'relative', left: -10, top: 'auto', background: '#888', width: 8, height: 8, border: '2px solid #1a1a1a', transform: 'none' }} />
                    <span style={{ fontSize: 9, color: '#aaa', marginLeft: 4 }}>{inH.label}</span>
                  </>
                ) : <span />}
                {outH ? (
                  <>
                    <span style={{ fontSize: 9, color: '#aaa', marginRight: 4, textAlign: 'right' }}>{outH.label}</span>
                    <Handle type="source" position={Position.Right} id={outH.id} style={{ position: 'relative', right: -10, top: 'auto', background: color, width: 8, height: 8, border: '2px solid #1a1a1a', transform: 'none' }} />
                  </>
                ) : <span />}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (collapsed) {
    return (
      <div
        style={{
          ...collapsedStyle,
          borderColor: selected ? typeColor : `${color}88`,
          boxShadow: selected
            ? `0 0 0 2px ${color}55, 0 3px 12px rgba(0,0,0,0.4)`
            : '0 3px 12px rgba(0,0,0,0.4)',
          transition: 'box-shadow 0.2s, border-color 0.2s',
        }}
      >
        {/* Header */}
        <div
          style={{
            ...headerStyle,
            background: `linear-gradient(to right, color-mix(in srgb, ${typeColor} 6%, transparent), ${color}33)`,
            borderBottom: `2px solid color-mix(in srgb, ${typeColor} 30%, transparent)`,
          }}
        >
          {renderHeaderContent()}
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
                      background: 'var(--success)',
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
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 12,
        border: `2px ${selected ? 'solid' : 'dashed'} ${selected ? typeColor : `${color}66`}`,
        background: `${color}0A`,
        boxShadow: selected
          ? `0 0 0 2px ${color}35, 0 3px 12px rgba(0,0,0,0.2)`
          : '0 2px 8px rgba(0,0,0,0.15)',
        fontFamily: "'Montserrat', system-ui, sans-serif",
        overflow: 'visible',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        outline: locked ? `2px dashed ${color}66` : 'none',
        outlineOffset: 3,
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
          borderBottom: `2px solid color-mix(in srgb, ${typeColor} 30%, transparent)`,
          background: `linear-gradient(to right, color-mix(in srgb, ${typeColor} 6%, transparent), ${color}15)`,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          cursor: 'grab',
          overflow: 'visible',
        }}
      >
        {renderHeaderContent()}
      </div>
    </div>
  )
}

export const GroupNode = memo(GroupNodeInner)

const GROUP_HEADER_HEIGHT = 36

// ── Styles ──────────────────────────────────────────────────────────────────

const collapsedStyle: React.CSSProperties = {
  minWidth: 180,
  background: 'var(--surface-2)',
  border: '2px solid',
  borderRadius: 10,
  fontFamily: "'Montserrat', system-ui, sans-serif",
  fontSize: '0.8rem',
  color: 'var(--text)',
  overflow: 'hidden',
  boxSizing: 'border-box',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.3rem 0.6rem',
  height: GROUP_HEADER_HEIGHT,
  borderBottom: '1px solid var(--border)',
  cursor: 'grab',
  overflow: 'visible',
}

const colorDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  flexShrink: 0,
  display: 'block',
}

const colorPickerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 14,
  left: -2,
  zIndex: 1000,
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 6,
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 16px)',
  gap: 4,
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
}

const colorSwatchStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: '50%',
  cursor: 'pointer',
  padding: 0,
  transition: 'transform 0.1s',
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
  cursor: 'default',
}

const badgeStyle: React.CSSProperties = {
  fontSize: '0.6rem',
  fontWeight: 700,
  flexShrink: 0,
  padding: '1px 5px',
  borderRadius: 4,
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
  color: 'var(--text-muted)',
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
  color: 'var(--text-muted)',
  letterSpacing: '0.05em',
}

const proxyHandleStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  border: '2px solid var(--surface-2)',
  position: 'relative',
}
