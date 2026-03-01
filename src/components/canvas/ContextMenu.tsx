/**
 * ContextMenu — right-click popup for canvas, nodes, and edges.
 *
 * Rendered at absolute screen position with a transparent overlay behind
 * it that captures outside clicks (closes the menu).
 */

import type { CSSProperties } from 'react'
import type { Value } from '../../engine/value'
import { isError } from '../../engine/value'

export type ContextMenuTarget =
  | { kind: 'canvas'; x: number; y: number }
  | {
      kind: 'node'
      x: number
      y: number
      nodeId: string
      isLocked: boolean
      isGroup?: boolean
      isCollapsed?: boolean
    }
  | { kind: 'edge'; x: number; y: number; edgeId: string }
  | { kind: 'selection'; x: number; y: number; selectedCount: number }

interface ContextMenuProps {
  target: ContextMenuTarget
  onClose: () => void
  onDuplicateNode: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onDeleteEdge: (edgeId: string) => void
  onInspectNode: (nodeId: string) => void
  onRenameNode: (nodeId: string) => void
  onLockNode: (nodeId: string) => void
  onFitView: () => void
  onAddBlockAtCursor: (x: number, y: number) => void
  onGroupSelection?: () => void
  onUngroupNode?: (nodeId: string) => void
  onToggleCollapse?: (nodeId: string) => void
  onDeleteSelected?: () => void
  onSaveAsTemplate?: (nodeId: string) => void
  canUseGroups?: boolean
  onCopyNodeValue?: (nodeId: string) => void
  onJumpToNode?: (nodeId: string) => void
  computed?: ReadonlyMap<string, Value>
  onPaste?: () => void
  onAutoLayout?: () => void
  onInspectEdge?: (edgeId: string) => void
  /** AI-3: "Explain this node" (plan-only workflow). */
  onExplainNode?: (nodeId: string) => void
  /** AI-3: "Insert blocks from prompt…" (add-only patch). */
  onInsertFromPrompt?: (x: number, y: number) => void
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
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = danger
          ? 'rgba(239,68,68,0.15)'
          : 'rgba(28,171,176,0.15)'
      }}
      onMouseLeave={(e) => {
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
  onRenameNode,
  onLockNode,
  onFitView,
  onAddBlockAtCursor,
  onGroupSelection,
  onUngroupNode,
  onToggleCollapse,
  onDeleteSelected,
  onSaveAsTemplate,
  canUseGroups,
  onCopyNodeValue,
  onJumpToNode,
  computed,
  onPaste,
  onAutoLayout,
  onInspectEdge,
  onExplainNode,
  onInsertFromPrompt,
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
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />

      <div
        style={{ ...menuStyle, zIndex: 1000 }}
        role="menu"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        {target.kind === 'node' && !target.isGroup && (
          <>
            <MenuItem
              icon="⬚"
              label="Inspect"
              onClick={() => {
                onInspectNode(target.nodeId)
                onClose()
              }}
            />
            <MenuItem
              icon="✎"
              label="Rename…"
              onClick={() => {
                onRenameNode(target.nodeId)
                onClose()
              }}
            />
            <MenuItem
              icon="⧉"
              label="Duplicate"
              onClick={() => {
                onDuplicateNode(target.nodeId)
                onClose()
              }}
            />
            <div style={sep} />
            <MenuItem
              icon={target.isLocked ? '🔓' : '🔒'}
              label={target.isLocked ? 'Unlock position' : 'Lock position'}
              onClick={() => {
                onLockNode(target.nodeId)
                onClose()
              }}
            />
            {onCopyNodeValue && (
              <>
                <div style={sep} />
                <MenuItem
                  icon="⎘"
                  label="Copy value"
                  onClick={() => {
                    onCopyNodeValue(target.nodeId)
                    onClose()
                  }}
                />
              </>
            )}
            {onJumpToNode &&
              computed &&
              (() => {
                const v = computed.get(target.nodeId)
                return v !== undefined && isError(v)
              })() && (
                <MenuItem
                  icon="⤳"
                  label="Jump to source"
                  onClick={() => {
                    onJumpToNode(target.nodeId)
                    onClose()
                  }}
                />
              )}
            {onExplainNode && (
              <>
                <div style={sep} />
                <MenuItem
                  icon="💡"
                  label="Explain this node"
                  onClick={() => {
                    onExplainNode(target.nodeId)
                    onClose()
                  }}
                />
              </>
            )}
            <div style={sep} />
            <MenuItem
              icon="✕"
              label="Delete node"
              danger
              onClick={() => {
                onDeleteNode(target.nodeId)
                onClose()
              }}
            />
          </>
        )}

        {target.kind === 'node' && target.isGroup && (
          <>
            <MenuItem
              icon={target.isCollapsed ? '▼' : '▶'}
              label={target.isCollapsed ? 'Expand' : 'Collapse'}
              onClick={() => {
                onToggleCollapse?.(target.nodeId)
                onClose()
              }}
            />
            <MenuItem
              icon="✎"
              label="Rename…"
              onClick={() => {
                onRenameNode(target.nodeId)
                onClose()
              }}
            />
            <MenuItem
              icon="⬚"
              label="Inspect"
              onClick={() => {
                onInspectNode(target.nodeId)
                onClose()
              }}
            />
            <MenuItem
              icon="💾"
              label="Save as template…"
              onClick={() => {
                onSaveAsTemplate?.(target.nodeId)
                onClose()
              }}
            />
            <div style={sep} />
            <MenuItem
              icon="⊟"
              label="Ungroup"
              onClick={() => {
                onUngroupNode?.(target.nodeId)
                onClose()
              }}
            />
            <div style={sep} />
            <MenuItem
              icon="✕"
              label="Delete group"
              danger
              onClick={() => {
                onDeleteNode(target.nodeId)
                onClose()
              }}
            />
          </>
        )}

        {target.kind === 'selection' && (
          <>
            <MenuItem
              icon="▢"
              label={canUseGroups ? 'Group selection' : '🔒 Group selection'}
              onClick={() => {
                onGroupSelection?.()
                onClose()
              }}
            />
            <div style={sep} />
            <MenuItem
              icon="✕"
              label={`Delete ${target.selectedCount} selected`}
              danger
              onClick={() => {
                onDeleteSelected?.()
                onClose()
              }}
            />
          </>
        )}

        {target.kind === 'edge' && (
          <>
            {onInspectEdge && (
              <>
                <MenuItem
                  icon="⬚"
                  label="Inspect connection"
                  onClick={() => {
                    onInspectEdge(target.edgeId)
                    onClose()
                  }}
                />
                <div style={sep} />
              </>
            )}
            <MenuItem
              icon="✕"
              label="Delete connection"
              danger
              onClick={() => {
                onDeleteEdge(target.edgeId)
                onClose()
              }}
            />
          </>
        )}

        {target.kind === 'canvas' && (
          <>
            <MenuItem
              icon="+"
              label="Add block here"
              onClick={() => {
                onAddBlockAtCursor(target.x, target.y)
                onClose()
              }}
            />
            {onPaste && (
              <MenuItem
                icon="⎗"
                label="Paste"
                onClick={() => {
                  onPaste()
                  onClose()
                }}
              />
            )}
            <div style={sep} />
            <MenuItem
              icon="⊡"
              label="Fit view"
              onClick={() => {
                onFitView()
                onClose()
              }}
            />
            {onAutoLayout && (
              <MenuItem
                icon="⊞"
                label="Auto-layout"
                onClick={() => {
                  onAutoLayout()
                  onClose()
                }}
              />
            )}
            {onInsertFromPrompt && (
              <>
                <div style={sep} />
                <MenuItem
                  icon="✦"
                  label="Insert blocks from prompt…"
                  onClick={() => {
                    onInsertFromPrompt(target.x, target.y)
                    onClose()
                  }}
                />
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
