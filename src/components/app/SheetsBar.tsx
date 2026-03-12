/**
 * SheetsBar — tab bar for multi-canvas "Sheets" (W10.7).
 *
 * Desktop (>=900px): horizontal tab row above the canvas.
 * Mobile (<900px):   dropdown selector with create button.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsMobile } from '../../hooks/useIsMobile'
import { canCreateCanvas, getEntitlements, type Plan } from '../../lib/entitlements'
import type { CanvasRow } from '../../lib/canvases'
import type { ViewMode } from '../../stores/canvasesStore'

// ── Props ───────────────────────────────────────────────────────────────────

export interface SheetsBarProps {
  canvases: CanvasRow[]
  activeCanvasId: string | null
  plan: Plan
  readOnly: boolean
  onSwitchCanvas: (canvasId: string) => void
  onCreateCanvas: () => void
  onRenameCanvas: (canvasId: string, name: string) => void
  onDeleteCanvas: (canvasId: string) => void
  onDuplicateCanvas: (canvasId: string) => void
  onReorderCanvases?: (orderedIds: string[]) => void
  /** UX-07: Set of canvas IDs with unsaved changes — shows dirty dot indicator. */
  dirtyCanvasIds?: Set<string>
  /** K1-1: Current view mode. */
  viewMode?: ViewMode
  /** K1-1: Callback to change the view mode. */
  onSetViewMode?: (mode: ViewMode) => void
}

// ── Component ───────────────────────────────────────────────────────────────

export function SheetsBar({
  canvases,
  activeCanvasId,
  plan,
  readOnly,
  onSwitchCanvas,
  onCreateCanvas,
  onRenameCanvas,
  onDeleteCanvas,
  onDuplicateCanvas,
  onReorderCanvases,
  dirtyCanvasIds,
  viewMode,
  onSetViewMode,
}: SheetsBarProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <MobileSheetsBar
        canvases={canvases}
        activeCanvasId={activeCanvasId}
        plan={plan}
        readOnly={readOnly}
        onSwitchCanvas={onSwitchCanvas}
        onCreateCanvas={onCreateCanvas}
      />
    )
  }

  return (
    <DesktopSheetsBar
      canvases={canvases}
      activeCanvasId={activeCanvasId}
      plan={plan}
      readOnly={readOnly}
      onSwitchCanvas={onSwitchCanvas}
      onCreateCanvas={onCreateCanvas}
      onRenameCanvas={onRenameCanvas}
      onDeleteCanvas={onDeleteCanvas}
      onDuplicateCanvas={onDuplicateCanvas}
      onReorderCanvases={onReorderCanvases}
      dirtyCanvasIds={dirtyCanvasIds}
      viewMode={viewMode}
      onSetViewMode={onSetViewMode}
    />
  )
}

// ── Desktop Tab Bar ─────────────────────────────────────────────────────────

function DesktopSheetsBar({
  canvases,
  activeCanvasId,
  plan,
  readOnly,
  onSwitchCanvas,
  onCreateCanvas,
  onRenameCanvas,
  onDeleteCanvas,
  onDuplicateCanvas,
  onReorderCanvases,
  dirtyCanvasIds,
  viewMode = 'fullscreen',
  onSetViewMode,
}: SheetsBarProps) {
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  const [contextMenu, setContextMenu] = useState<{
    canvasId: string
    x: number
    y: number
  } | null>(null)
  // Inline delete confirmation (replaces confirm())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const contextRef = useRef<HTMLDivElement>(null)
  // Drag-and-drop reorder
  const dragIdRef = useRef<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  // Focus input when editing starts
  useEffect(() => {
    if (editingId) {
      setTimeout(() => editInputRef.current?.select(), 0)
    }
  }, [editingId])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null)
        setConfirmDeleteId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  // Close context menu on Escape
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null)
        setConfirmDeleteId(null)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [contextMenu])

  const startRename = useCallback(
    (canvasId: string) => {
      const canvas = canvases.find((c) => c.id === canvasId)
      if (!canvas) return
      setEditValue(canvas.name)
      setEditingId(canvasId)
      setContextMenu(null)
      setConfirmDeleteId(null)
    },
    [canvases],
  )

  const commitRename = useCallback(() => {
    if (!editingId) return
    const trimmed = editValue.trim()
    if (trimmed) {
      onRenameCanvas(editingId, trimmed)
    }
    setEditingId(null)
  }, [editingId, editValue, onRenameCanvas])

  const handleTabContextMenu = useCallback((e: React.MouseEvent, canvasId: string) => {
    e.preventDefault()
    setConfirmDeleteId(null)
    setContextMenu({ canvasId, x: e.clientX, y: e.clientY })
  }, [])

  const handleDeleteFromMenu = useCallback(() => {
    if (!contextMenu) return
    // Show inline confirmation instead of confirm()
    setConfirmDeleteId(contextMenu.canvasId)
  }, [contextMenu])

  const confirmDelete = useCallback(() => {
    if (!confirmDeleteId) return
    setContextMenu(null)
    setConfirmDeleteId(null)
    onDeleteCanvas(confirmDeleteId)
  }, [confirmDeleteId, onDeleteCanvas])

  const handleDuplicateFromMenu = useCallback(() => {
    if (!contextMenu) return
    const id = contextMenu.canvasId
    setContextMenu(null)
    setConfirmDeleteId(null)
    onDuplicateCanvas(id)
  }, [contextMenu, onDuplicateCanvas])

  // UX-07: Move to position
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null)
  const [movePosition, setMovePosition] = useState('')

  const handleMoveToPosition = useCallback(() => {
    if (!contextMenu) return
    setMoveTargetId(contextMenu.canvasId)
    const current = canvases.findIndex((c) => c.id === contextMenu.canvasId)
    setMovePosition(String(current + 1))
    setContextMenu(null)
    setConfirmDeleteId(null)
  }, [contextMenu, canvases])

  const commitMoveToPosition = useCallback(() => {
    if (!moveTargetId || !onReorderCanvases) { setMoveTargetId(null); return }
    const pos = parseInt(movePosition, 10)
    if (isNaN(pos) || pos < 1 || pos > canvases.length) { setMoveTargetId(null); return }
    const ids = canvases.map((c) => c.id)
    const fromIdx = ids.indexOf(moveTargetId)
    if (fromIdx === -1) { setMoveTargetId(null); return }
    ids.splice(fromIdx, 1)
    ids.splice(pos - 1, 0, moveTargetId)
    onReorderCanvases(ids)
    setMoveTargetId(null)
  }, [moveTargetId, movePosition, canvases, onReorderCanvases])

  // ── Drag-and-drop reorder ──────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, canvasId: string) => {
    dragIdRef.current = canvasId
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', canvasId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, canvasId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragIdRef.current && dragIdRef.current !== canvasId) {
      setDropTargetId(canvasId)
    }
  }, [])

  const handleDragLeave = useCallback(() => {
    setDropTargetId(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault()
      setDropTargetId(null)
      const dragId = dragIdRef.current
      dragIdRef.current = null
      if (!dragId || dragId === targetId || !onReorderCanvases) return

      const ids = canvases.map((c) => c.id)
      const fromIdx = ids.indexOf(dragId)
      const toIdx = ids.indexOf(targetId)
      if (fromIdx === -1 || toIdx === -1) return

      ids.splice(fromIdx, 1)
      ids.splice(toIdx, 0, dragId)
      onReorderCanvases(ids)
    },
    [canvases, onReorderCanvases],
  )

  const handleDragEnd = useCallback(() => {
    dragIdRef.current = null
    setDropTargetId(null)
  }, [])

  const canAdd = !readOnly && canCreateCanvas(plan, canvases.length)
  const ent = getEntitlements(plan)
  const canvasCountLabel =
    ent.maxCanvases === Infinity ? `${canvases.length}` : `${canvases.length} / ${ent.maxCanvases}`

  const deleteTargetCanvas = confirmDeleteId ? canvases.find((c) => c.id === confirmDeleteId) : null
  const canDelete = canvases.length > 1

  return (
    <div style={barStyle} data-tour="sheets-bar">
      <div style={tabsContainerStyle}>
        {canvases.map((canvas) => {
          const isActive = canvas.id === activeCanvasId
          const isEditing = canvas.id === editingId
          const isDropTarget = canvas.id === dropTargetId

          return (
            <div
              key={canvas.id}
              role="tab"
              aria-selected={isActive}
              draggable={!readOnly && !isEditing}
              className="cs-sheet-tab"
              style={{
                ...tabStyle(isActive),
                ...(isDropTarget ? { borderLeft: '2px solid var(--primary)' } : {}),
              }}
              onClick={() => {
                if (!isEditing) onSwitchCanvas(canvas.id)
              }}
              onDoubleClick={() => {
                if (!readOnly) startRename(canvas.id)
              }}
              onContextMenu={(e) => {
                if (!readOnly) handleTabContextMenu(e, canvas.id)
              }}
              onDragStart={(e) => handleDragStart(e, canvas.id)}
              onDragOver={(e) => handleDragOver(e, canvas.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, canvas.id)}
              onDragEnd={handleDragEnd}
            >
              {isEditing ? (
                <input
                  ref={editInputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  style={editInputStyle}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  {/* UX-07: dirty indicator dot */}
                  {dirtyCanvasIds?.has(canvas.id) && (
                    <span
                      title={t('sheets.unsavedChanges', 'Unsaved changes')}
                      style={{
                        display: 'inline-block',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        marginRight: 4,
                        flexShrink: 0,
                        opacity: 0.8,
                      }}
                    />
                  )}
                  <span style={tabLabelStyle}>{canvas.name}</span>
                  {!readOnly && canDelete && (
                    <button
                      className="cs-sheet-tab-close"
                      title={t('sheets.delete')}
                      aria-label={t('sheets.delete')}
                      style={tabCloseBtnStyle(isActive)}
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDeleteId(canvas.id)
                        setContextMenu({
                          canvasId: canvas.id,
                          x: e.clientX,
                          y: e.clientY,
                        })
                      }}
                    >
                      x
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}

        {/* Add sheet button */}
        <button
          onClick={onCreateCanvas}
          disabled={!canAdd}
          title={canAdd ? t('sheets.addSheet') : t('sheets.limitReached')}
          style={addButtonStyle(canAdd)}
        >
          +
        </button>
      </div>
      {/* K1-1: View mode toggle (only when >=2 sheets) */}
      {canvases.length >= 2 && onSetViewMode && (
        <div style={viewModeGroupStyle}>
          <ViewModeBtn
            active={viewMode === 'fullscreen'}
            title={t('sheets.viewFullscreen')}
            onClick={() => onSetViewMode('fullscreen')}
          >
            <ViewIconFullscreen />
          </ViewModeBtn>
          <ViewModeBtn
            active={viewMode === 'tiled-h'}
            title={t('sheets.viewTiledH')}
            onClick={() => onSetViewMode('tiled-h')}
          >
            <ViewIconTiledH />
          </ViewModeBtn>
          <ViewModeBtn
            active={viewMode === 'tiled-v'}
            title={t('sheets.viewTiledV')}
            onClick={() => onSetViewMode('tiled-v')}
          >
            <ViewIconTiledV />
          </ViewModeBtn>
        </div>
      )}
      <span style={canvasCounterStyle}>{canvasCountLabel}</span>

      {/* UX-07: Move to Position inline mini-dialog */}
      {moveTargetId && (() => {
        const mvCanvas = canvases.find((c) => c.id === moveTargetId)
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.35)',
            }}
            onClick={() => setMoveTargetId(null)}
          >
            <div
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '1rem 1.25rem',
                minWidth: 280,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.6rem' }}>
                {t('sheets.moveDialogTitle', 'Move "{{name}}" to position', { name: mvCanvas?.name ?? '' })}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  min={1}
                  max={canvases.length}
                  value={movePosition}
                  onChange={(e) => setMovePosition(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitMoveToPosition()
                    if (e.key === 'Escape') setMoveTargetId(null)
                  }}
                  style={{
                    flex: 1,
                    padding: '0.3rem 0.5rem',
                    borderRadius: 5,
                    border: '1px solid var(--border)',
                    background: 'var(--input-bg)',
                    color: 'var(--text)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                  autoFocus
                />
                <button
                  onClick={commitMoveToPosition}
                  style={{
                    padding: '0.3rem 0.8rem',
                    borderRadius: 5,
                    border: 'none',
                    background: 'var(--primary)',
                    color: 'var(--color-on-primary)',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontFamily: 'inherit',
                  }}
                >
                  {t('sheets.move', 'Move')}
                </button>
                <button
                  onClick={() => setMoveTargetId(null)}
                  style={{
                    padding: '0.3rem 0.8rem',
                    borderRadius: 5,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontFamily: 'inherit',
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
              <div style={{ marginTop: '0.4rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {t('sheets.moveDialogHint', '1 to {{max}}', { max: canvases.length })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Context menu */}
      {contextMenu && (
        <div ref={contextRef} style={contextMenuStyle(contextMenu.x, contextMenu.y)}>
          {confirmDeleteId && deleteTargetCanvas ? (
            /* Inline delete confirmation */
            <div style={{ padding: '0.4rem 0.75rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text)', marginBottom: 6 }}>
                {t('sheets.deleteConfirmInline', {
                  defaultValue: 'Delete "{{name}}"? This cannot be undone.',
                  name: deleteTargetCanvas.name,
                })}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={confirmDelete} style={confirmDeleteBtnStyle}>
                  {t('sheets.delete')}
                </button>
                <button onClick={() => setConfirmDeleteId(null)} style={confirmCancelBtnStyle}>
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          ) : (
            /* Normal context menu */
            <>
              <CtxItem
                label={t('sheets.rename')}
                onClick={() => startRename(contextMenu.canvasId)}
              />
              <CtxItem label={t('sheets.duplicate')} onClick={handleDuplicateFromMenu} />
              {onReorderCanvases && canvases.length > 1 && (
                <CtxItem
                  label={t('sheets.moveToPosition', 'Move to position\u2026')}
                  onClick={handleMoveToPosition}
                />
              )}
              <div style={contextSeparatorStyle} role="separator" />
              <CtxItem
                label={t('sheets.delete')}
                danger
                disabled={canvases.length <= 1}
                onClick={canvases.length > 1 ? handleDeleteFromMenu : undefined}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Context menu item with hover effect. */
function CtxItem({
  label,
  danger,
  disabled,
  onClick,
}: {
  label: string
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <div
      role="menuitem"
      style={{
        ...contextItemStyle,
        color: disabled ? 'var(--text-muted)' : danger ? 'var(--danger)' : 'var(--text)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLDivElement).style.background = danger
            ? 'rgba(239,68,68,0.1)'
            : 'rgba(28,171,176,0.1)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      {label}
    </div>
  )
}

// ── Mobile Sheets Dropdown ──────────────────────────────────────────────────

interface MobileProps {
  canvases: CanvasRow[]
  activeCanvasId: string | null
  plan: Plan
  readOnly: boolean
  onSwitchCanvas: (canvasId: string) => void
  onCreateCanvas: () => void
}

function MobileSheetsBar({
  canvases,
  activeCanvasId,
  plan,
  readOnly,
  onSwitchCanvas,
  onCreateCanvas,
}: MobileProps) {
  const { t } = useTranslation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId)
  const canAdd = !readOnly && canCreateCanvas(plan, canvases.length)
  const mobileEnt = getEntitlements(plan)
  const mobileCountLabel =
    mobileEnt.maxCanvases === Infinity
      ? `${canvases.length}`
      : `${canvases.length} / ${mobileEnt.maxCanvases}`

  // Close on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  return (
    <div style={mobileBarStyle}>
      <div ref={dropdownRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <button onClick={() => setDropdownOpen(!dropdownOpen)} style={mobileDropdownTrigger}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeCanvas?.name ?? t('sheets.title')}
          </span>
          <span style={{ opacity: 0.5, fontSize: '0.7rem', marginLeft: 4 }}>{'\u25be'}</span>
        </button>

        {dropdownOpen && (
          <div style={mobileDropdownPanel}>
            {canvases.map((canvas) => (
              <div
                key={canvas.id}
                role="option"
                aria-selected={canvas.id === activeCanvasId}
                style={mobileDropdownItem(canvas.id === activeCanvasId)}
                onClick={() => {
                  onSwitchCanvas(canvas.id)
                  setDropdownOpen(false)
                }}
              >
                {canvas.name}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onCreateCanvas}
        disabled={!canAdd}
        title={canAdd ? t('sheets.addSheet') : t('sheets.limitReached')}
        style={mobileAddButton(canAdd)}
      >
        +
      </button>
      <span style={canvasCounterStyle}>{mobileCountLabel}</span>
    </div>
  )
}

// ── K1-1: View mode toggle button + mini layout icons ──────────────────────

function ViewModeBtn({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button title={title} onClick={onClick} style={viewModeBtnStyle(active)}>
      {children}
    </button>
  )
}

/** Single rectangle — fullscreen layout. */
function ViewIconFullscreen() {
  return (
    <div
      style={{
        width: 12,
        height: 9,
        border: '1.5px solid currentColor',
        borderRadius: 1,
      }}
    />
  )
}

/** Two rectangles side-by-side — tiled horizontal. */
function ViewIconTiledH() {
  return (
    <div
      style={{
        display: 'flex',
        width: 12,
        height: 9,
        border: '1.5px solid currentColor',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, borderRight: '1px solid currentColor' }} />
      <div style={{ flex: 1 }} />
    </div>
  )
}

/** Two rectangles stacked — tiled vertical. */
function ViewIconTiledV() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 12,
        height: 9,
        border: '1.5px solid currentColor',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, borderBottom: '1px solid currentColor' }} />
      <div style={{ flex: 1 }} />
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const viewModeGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: 1,
  marginLeft: 'auto',
  paddingRight: 4,
  flexShrink: 0,
}

function viewModeBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    border: 'none',
    background: active ? 'var(--primary-dim)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    cursor: 'pointer',
    borderRadius: 4,
    padding: 0,
    transition: 'color 0.15s, background 0.15s',
  }
}

const canvasCounterStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  opacity: 0.4,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  padding: '0 0.5rem',
  flexShrink: 0,
}

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: 'var(--surface2)',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
  position: 'relative',
  minHeight: 32,
}

const tabsContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 0,
  overflow: 'auto',
  flex: 1,
  paddingLeft: 4,
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    padding: '0.3rem 0.75rem',
    fontSize: '0.78rem',
    fontFamily: 'inherit',
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--text)' : 'var(--text-muted)',
    background: active ? 'var(--bg)' : 'transparent',
    borderTop: active ? '2px solid var(--primary)' : '2px solid transparent',
    borderLeft: active ? '1px solid var(--border)' : '1px solid transparent',
    borderRight: active ? '1px solid var(--border)' : '1px solid transparent',
    borderBottom: active ? '1px solid var(--bg)' : '1px solid transparent',
    marginBottom: active ? -1 : 0,
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    maxWidth: 160,
    position: 'relative',
    transition: 'color 0.15s, background 0.15s',
  }
}

const tabLabelStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

function tabCloseBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.65rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    borderRadius: 3,
    marginLeft: 4,
    padding: 0,
    opacity: active ? 0.6 : 0,
    transition: 'opacity 0.15s, background 0.15s',
    flexShrink: 0,
    lineHeight: 1,
  }
}

const editInputStyle: React.CSSProperties = {
  background: 'var(--input-bg)',
  border: '1px solid var(--primary)',
  borderRadius: 3,
  color: 'var(--text)',
  fontSize: '0.78rem',
  fontFamily: 'inherit',
  padding: '0.1rem 0.3rem',
  width: 100,
  outline: 'none',
}

function addButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    border: 'none',
    background: 'transparent',
    color: enabled ? 'var(--text-muted)' : 'rgba(255,255,255,0.1)',
    fontSize: '1rem',
    fontFamily: 'inherit',
    cursor: enabled ? 'pointer' : 'default',
    borderRadius: 4,
    marginLeft: 2,
    marginRight: 4,
    flexShrink: 0,
    transition: 'color 0.15s, background 0.15s',
  }
}

function contextMenuStyle(x: number, y: number): React.CSSProperties {
  return {
    position: 'fixed',
    top: y,
    left: x,
    minWidth: 160,
    background: 'var(--surface-1)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.3rem 0',
    zIndex: 9999,
    boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
  }
}

const contextItemStyle: React.CSSProperties = {
  padding: '0.4rem 0.75rem',
  fontSize: '0.8rem',
  color: 'var(--text)',
  cursor: 'pointer',
  userSelect: 'none',
}

const contextSeparatorStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--border)',
  margin: '0.3rem 0.5rem',
}

const confirmDeleteBtnStyle: React.CSSProperties = {
  padding: '0.25rem 0.6rem',
  fontSize: '0.75rem',
  fontFamily: 'inherit',
  border: 'none',
  borderRadius: 4,
  background: 'var(--danger)',
  color: 'var(--color-on-primary)',
  cursor: 'pointer',
}

const confirmCancelBtnStyle: React.CSSProperties = {
  padding: '0.25rem 0.6rem',
  fontSize: '0.75rem',
  fontFamily: 'inherit',
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
}

// ── Mobile styles ───────────────────────────────────────────────────────────

const mobileBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'var(--surface2)',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
  padding: '0.25rem 0.5rem',
  minHeight: 36,
}

const mobileDropdownTrigger: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '0.3rem 0.5rem',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
  color: 'var(--text)',
  cursor: 'pointer',
  minWidth: 0,
}

const mobileDropdownPanel: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  marginTop: 2,
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.3rem 0',
  zIndex: 100,
  boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
  maxHeight: 240,
  overflowY: 'auto',
}

function mobileDropdownItem(active: boolean): React.CSSProperties {
  return {
    padding: '0.45rem 0.75rem',
    fontSize: '0.82rem',
    color: active ? 'var(--primary)' : 'var(--text)',
    fontWeight: active ? 600 : 400,
    background: active ? 'var(--primary-dim)' : 'transparent',
    cursor: 'pointer',
    userSelect: 'none',
  }
}

function mobileAddButton(enabled: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: enabled ? 'var(--primary-dim)' : 'transparent',
    color: enabled ? 'var(--primary)' : 'var(--text-muted)',
    fontSize: '1.1rem',
    fontFamily: 'inherit',
    cursor: enabled ? 'pointer' : 'default',
    flexShrink: 0,
  }
}
