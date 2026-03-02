/**
 * ContextMenu — right-click popup for canvas, nodes, and edges.
 *
 * Rendered at absolute screen position with a transparent overlay behind
 * it that captures outside clicks (closes the menu).
 */

import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { Value } from '../../engine/value'
import { isError } from '../../engine/value'
import type { AlignOp } from '../../lib/alignmentHelpers'

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
  /** E7-2: Alignment helper for multi-selection. */
  onAlignSelection?: (op: AlignOp) => void
  /** G6-1: Insert annotation at cursor position. */
  onInsertAnnotation?: (x: number, y: number, annotationType: string) => void
  /** G6-1: Snap-to-grid toggle in context menu. */
  snapToGrid?: boolean
  onToggleSnap?: () => void
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

function SubLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '0.25rem 0.9rem 0.1rem',
        fontSize: '0.7rem',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </div>
  )
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
  onAlignSelection,
  onInsertAnnotation,
  snapToGrid,
  onToggleSnap,
}: ContextMenuProps) {
  const { t } = useTranslation()

  const menuStyle: CSSProperties = {
    position: 'fixed',
    left: target.x,
    top: target.y,
    zIndex: 1000,
    background: 'var(--card-bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.3rem',
    minWidth: 160,
    boxShadow: 'var(--shadow-lg)',
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
              label={t('contextMenu.inspect')}
              onClick={() => {
                onInspectNode(target.nodeId)
                onClose()
              }}
            />
            <MenuItem
              icon="✎"
              label={t('contextMenu.rename')}
              onClick={() => {
                onRenameNode(target.nodeId)
                onClose()
              }}
            />
            <MenuItem
              icon="⧉"
              label={t('contextMenu.duplicate')}
              onClick={() => {
                onDuplicateNode(target.nodeId)
                onClose()
              }}
            />
            <div style={sep} />
            <MenuItem
              icon={target.isLocked ? '⊘' : '⊙'}
              label={
                target.isLocked ? t('contextMenu.unlockPosition') : t('contextMenu.lockPosition')
              }
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
                  label={t('contextMenu.copyValue')}
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
                  label={t('contextMenu.jumpToSource')}
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
                  icon="✦"
                  label={t('contextMenu.explainNode')}
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
              label={t('contextMenu.deleteNode')}
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
              label={target.isCollapsed ? t('contextMenu.expand') : t('contextMenu.collapse')}
              onClick={() => {
                onToggleCollapse?.(target.nodeId)
                onClose()
              }}
            />
            <MenuItem
              icon="✎"
              label={t('contextMenu.rename')}
              onClick={() => {
                onRenameNode(target.nodeId)
                onClose()
              }}
            />
            <MenuItem
              icon="⬚"
              label={t('contextMenu.inspect')}
              onClick={() => {
                onInspectNode(target.nodeId)
                onClose()
              }}
            />
            <MenuItem
              icon="⛁"
              label={t('contextMenu.saveAsTemplate')}
              onClick={() => {
                onSaveAsTemplate?.(target.nodeId)
                onClose()
              }}
            />
            <div style={sep} />
            <MenuItem
              icon="⊟"
              label={t('contextMenu.ungroup')}
              onClick={() => {
                onUngroupNode?.(target.nodeId)
                onClose()
              }}
            />
            <div style={sep} />
            <MenuItem
              icon="✕"
              label={t('contextMenu.deleteGroup')}
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
              label={
                canUseGroups
                  ? t('contextMenu.groupSelection')
                  : `⊘ ${t('contextMenu.groupSelection')}`
              }
              onClick={() => {
                onGroupSelection?.()
                onClose()
              }}
            />
            {onAlignSelection && (
              <>
                <div style={sep} />
                <MenuItem
                  icon="⫷"
                  label={t('contextMenu.alignLeft')}
                  onClick={() => {
                    onAlignSelection('align-left')
                    onClose()
                  }}
                />
                <MenuItem
                  icon="⫸"
                  label={t('contextMenu.alignRight')}
                  onClick={() => {
                    onAlignSelection('align-right')
                    onClose()
                  }}
                />
                <MenuItem
                  icon="⊤"
                  label={t('contextMenu.alignTop')}
                  onClick={() => {
                    onAlignSelection('align-top')
                    onClose()
                  }}
                />
                <MenuItem
                  icon="⊥"
                  label={t('contextMenu.alignBottom')}
                  onClick={() => {
                    onAlignSelection('align-bottom')
                    onClose()
                  }}
                />
                {target.selectedCount >= 3 && (
                  <>
                    <div style={sep} />
                    <MenuItem
                      icon="⇔"
                      label={t('contextMenu.distributeHorizontal')}
                      onClick={() => {
                        onAlignSelection('distribute-h')
                        onClose()
                      }}
                    />
                    <MenuItem
                      icon="⇕"
                      label={t('contextMenu.distributeVertical')}
                      onClick={() => {
                        onAlignSelection('distribute-v')
                        onClose()
                      }}
                    />
                  </>
                )}
              </>
            )}
            <div style={sep} />
            <MenuItem
              icon="✕"
              label={t('contextMenu.deleteSelected', { count: target.selectedCount })}
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
                  label={t('contextMenu.inspectConnection')}
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
              label={t('contextMenu.deleteConnection')}
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
              label={t('contextMenu.addBlockHere')}
              onClick={() => {
                onAddBlockAtCursor(target.x, target.y)
                onClose()
              }}
            />
            {onInsertAnnotation && (
              <>
                <div style={sep} />
                <SubLabel label={t('contextMenu.insertAnnotation')} />
                <MenuItem
                  icon="A"
                  label={t('contextMenu.annotText')}
                  onClick={() => {
                    onInsertAnnotation(target.x, target.y, 'annotation_text')
                    onClose()
                  }}
                />
                <MenuItem
                  icon="▭"
                  label={t('contextMenu.annotCallout')}
                  onClick={() => {
                    onInsertAnnotation(target.x, target.y, 'annotation_callout')
                    onClose()
                  }}
                />
                <MenuItem
                  icon="◻"
                  label={t('contextMenu.annotHighlight')}
                  onClick={() => {
                    onInsertAnnotation(target.x, target.y, 'annotation_highlight')
                    onClose()
                  }}
                />
                <MenuItem
                  icon="→"
                  label={t('contextMenu.annotArrow')}
                  onClick={() => {
                    onInsertAnnotation(target.x, target.y, 'annotation_arrow')
                    onClose()
                  }}
                />
              </>
            )}
            {onPaste && (
              <>
                <div style={sep} />
                <MenuItem
                  icon="⎗"
                  label={t('contextMenu.paste')}
                  onClick={() => {
                    onPaste()
                    onClose()
                  }}
                />
              </>
            )}
            <div style={sep} />
            <MenuItem
              icon="⊡"
              label={t('contextMenu.fitView')}
              onClick={() => {
                onFitView()
                onClose()
              }}
            />
            {onAutoLayout && (
              <MenuItem
                icon="⊞"
                label={t('contextMenu.autoLayout')}
                onClick={() => {
                  onAutoLayout()
                  onClose()
                }}
              />
            )}
            {onToggleSnap && (
              <MenuItem
                icon={snapToGrid ? '⊟' : '⊞'}
                label={snapToGrid ? t('contextMenu.snapGridOff') : t('contextMenu.snapGridOn')}
                onClick={() => {
                  onToggleSnap()
                  onClose()
                }}
              />
            )}
            {onInsertFromPrompt && (
              <>
                <div style={sep} />
                <MenuItem
                  icon="✦"
                  label={t('contextMenu.insertFromPrompt')}
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
