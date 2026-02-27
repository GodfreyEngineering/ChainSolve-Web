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
}: SheetsBarProps) {
  const isMobile = useIsMobile()
  const { t } = useTranslation()

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
      t={t}
      onSwitchCanvas={onSwitchCanvas}
      onCreateCanvas={onCreateCanvas}
      onRenameCanvas={onRenameCanvas}
      onDeleteCanvas={onDeleteCanvas}
      onDuplicateCanvas={onDuplicateCanvas}
    />
  )
}

// ── Desktop Tab Bar ─────────────────────────────────────────────────────────

interface DesktopProps extends SheetsBarProps {
  t: (key: string) => string
}

function DesktopSheetsBar({
  canvases,
  activeCanvasId,
  plan,
  readOnly,
  t,
  onSwitchCanvas,
  onCreateCanvas,
  onRenameCanvas,
  onDeleteCanvas,
  onDuplicateCanvas,
}: DesktopProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  const [contextMenu, setContextMenu] = useState<{
    canvasId: string
    x: number
    y: number
  } | null>(null)
  const contextRef = useRef<HTMLDivElement>(null)

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
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  // Close context menu on Escape
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
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
    setContextMenu({ canvasId, x: e.clientX, y: e.clientY })
  }, [])

  const handleDeleteFromMenu = useCallback(() => {
    if (!contextMenu) return
    const id = contextMenu.canvasId
    setContextMenu(null)
    if (confirm(t('sheets.deleteConfirm'))) {
      onDeleteCanvas(id)
    }
  }, [contextMenu, t, onDeleteCanvas])

  const handleDuplicateFromMenu = useCallback(() => {
    if (!contextMenu) return
    const id = contextMenu.canvasId
    setContextMenu(null)
    onDuplicateCanvas(id)
  }, [contextMenu, onDuplicateCanvas])

  const canAdd = !readOnly && canCreateCanvas(plan, canvases.length)
  const ent = getEntitlements(plan)
  const canvasCountLabel =
    ent.maxCanvases === Infinity ? `${canvases.length}` : `${canvases.length} / ${ent.maxCanvases}`

  return (
    <div style={barStyle}>
      <div style={tabsContainerStyle}>
        {canvases.map((canvas) => {
          const isActive = canvas.id === activeCanvasId
          const isEditing = canvas.id === editingId

          return (
            <div
              key={canvas.id}
              role="tab"
              aria-selected={isActive}
              style={tabStyle(isActive)}
              onClick={() => {
                if (!isEditing) onSwitchCanvas(canvas.id)
              }}
              onDoubleClick={() => {
                if (!readOnly) startRename(canvas.id)
              }}
              onContextMenu={(e) => handleTabContextMenu(e, canvas.id)}
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
                <span style={tabLabelStyle}>{canvas.name}</span>
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
      <span style={canvasCounterStyle}>{canvasCountLabel}</span>

      {/* Context menu */}
      {contextMenu && (
        <div ref={contextRef} style={contextMenuStyle(contextMenu.x, contextMenu.y)}>
          <div
            role="menuitem"
            style={contextItemStyle}
            onClick={() => startRename(contextMenu.canvasId)}
          >
            {t('sheets.rename')}
          </div>
          <div role="menuitem" style={contextItemStyle} onClick={handleDuplicateFromMenu}>
            {t('sheets.duplicate')}
          </div>
          <div style={contextSeparatorStyle} role="separator" />
          <div
            role="menuitem"
            style={{
              ...contextItemStyle,
              color: canvases.length <= 1 ? 'var(--text-muted)' : '#ef4444',
              cursor: canvases.length <= 1 ? 'default' : 'pointer',
            }}
            onClick={canvases.length > 1 ? handleDeleteFromMenu : undefined}
          >
            {t('sheets.delete')}
          </div>
        </div>
      )}
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

// ── Styles ──────────────────────────────────────────────────────────────────

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
    background: 'var(--card-bg)',
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
  background: 'var(--card-bg)',
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
