/**
 * ContextMenu — right-click popup for canvas, nodes, and edges.
 *
 * Rendered at absolute screen position with a transparent overlay behind
 * it that captures outside clicks (closes the menu).
 */

import type { CSSProperties } from 'react'

export type ContextMenuTarget =
  | { kind: 'canvas'; x: number; y: number }
  | { kind: 'node'; x: number; y: number; nodeId: string }
  | { kind: 'edge'; x: number; y: number; edgeId: string }

interface ContextMenuProps {
  target: ContextMenuTarget
  onClose: () => void
  onDuplicateNode: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onDeleteEdge: (edgeId: string) => void
  onInspectNode: (nodeId: string) => void
  onFitView: () => void
}

const item: CSSProperties = {
  padding: '0.42rem 0.9rem',
  fontSize: '0.82rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
}

const sep: CSSProperties = {
  height: 1,
  background: 'rgba(255,255,255,0.08)',
  margin: '0.2rem 0',
}

function MenuItem({
  label,
  icon,
  danger,
  onClick,
}: {
  label: string
  icon?: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <div
      style={item}
      role="menuitem"
      onClick={onClick}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLDivElement).style.background = danger
          ? 'rgba(239,68,68,0.15)'
          : 'rgba(28,171,176,0.15)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      {icon && <span style={{ opacity: 0.6, fontSize: '0.9rem', width: 16 }}>{icon}</span>}
      <span style={{ color: danger ? '#f87171' : undefined }}>{label}</span>
    </div>
  )
}

export function ContextMenu({
  target,
  onClose,
  onDuplicateNode,
  onDeleteNode,
  onDeleteEdge,
  onInspectNode,
  onFitView,
}: ContextMenuProps) {
  const menuStyle: CSSProperties = {
    position: 'fixed',
    left: target.x,
    top: target.y,
    zIndex: 1000,
    background: '#2c2c2c',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: '0.3rem',
    minWidth: 160,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    userSelect: 'none',
  }

  return (
    <>
      {/* Transparent overlay — captures outside clicks */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
        onClick={onClose}
        onContextMenu={e => { e.preventDefault(); onClose() }}
      />

      <div style={{ ...menuStyle, zIndex: 1000 }} role="menu" onKeyDown={e => e.key === 'Escape' && onClose()}>
        {target.kind === 'node' && (
          <>
            <MenuItem
              icon="⬚"
              label="Inspect"
              onClick={() => { onInspectNode(target.nodeId); onClose() }}
            />
            <MenuItem
              icon="⧉"
              label="Duplicate"
              onClick={() => { onDuplicateNode(target.nodeId); onClose() }}
            />
            <div style={sep} />
            <MenuItem
              icon="✕"
              label="Delete node"
              danger
              onClick={() => { onDeleteNode(target.nodeId); onClose() }}
            />
          </>
        )}

        {target.kind === 'edge' && (
          <MenuItem
            icon="✕"
            label="Delete connection"
            danger
            onClick={() => { onDeleteEdge(target.edgeId); onClose() }}
          />
        )}

        {target.kind === 'canvas' && (
          <>
            <MenuItem icon="⊡" label="Fit view" onClick={() => { onFitView(); onClose() }} />
          </>
        )}
      </div>
    </>
  )
}
