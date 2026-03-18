/**
 * NodeSideSheet — slide-from-right inspector panel anchored to the canvas edge.
 *
 * Opened by double-clicking a node. 400 px wide, full canvas height.
 * Uses a CSS transform transition so it doesn't reflow the canvas layout.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Inspector } from './Inspector'

interface NodeSideSheetProps {
  open: boolean
  nodeId: string | null
  pinned: boolean
  onClose: () => void
  onTogglePin: () => void
  onToggleCollapse?: (groupId: string) => void
  onUngroupNode?: (groupId: string) => void
  canUseGroups?: boolean
}

export function NodeSideSheet({
  open,
  nodeId,
  pinned,
  onClose,
  onTogglePin,
  onToggleCollapse,
  onUngroupNode,
  canUseGroups,
}: NodeSideSheetProps) {
  const { t } = useTranslation()
  const sheetRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  return (
    <>
      {/* Invisible backdrop — click outside to close */}
      {open && <div aria-hidden="true" onClick={handleBackdropClick} style={backdropStyle} />}

      {/* Side sheet panel */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="false"
        aria-label={t('inspector.title', 'Inspector')}
        data-side-sheet
        style={{
          ...sheetStyle,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          pointerEvents: open ? 'all' : 'none',
        }}
      >
        {/* Header */}
        <div style={headerStyle}>
          <span style={titleStyle}>{t('inspector.title', 'Inspector')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Pin toggle */}
            <button
              onClick={onTogglePin}
              title={
                pinned
                  ? t('inspector.unpin', 'Unpin selection')
                  : t('inspector.pin', 'Pin to current node')
              }
              aria-label={
                pinned
                  ? t('inspector.unpin', 'Unpin selection')
                  : t('inspector.pin', 'Pin to current node')
              }
              style={{
                ...iconBtnStyle,
                color: pinned ? 'var(--warning)' : 'rgba(244,244,243,0.4)',
              }}
            >
              {pinned ? '\u25C9' : '\u25CB'}
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              title={t('common.close', 'Close')}
              aria-label={t('common.close', 'Close')}
              style={iconBtnStyle}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Inspector content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Inspector
            nodeId={nodeId}
            width={0}
            onClose={onClose}
            onResizeStart={() => {}}
            onToggleCollapse={onToggleCollapse}
            onUngroupNode={onUngroupNode}
            canUseGroups={canUseGroups}
            floating
          />
        </div>
      </div>
    </>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const backdropStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 39,
  background: 'transparent',
}

const sheetStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  width: 400,
  background: 'var(--card)',
  borderLeft: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 40,
  transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
  willChange: 'transform',
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  flexShrink: 0,
  background: 'var(--surface)',
}

const titleStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text)',
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  opacity: 0.7,
}

const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.85rem',
  color: 'rgba(244,244,243,0.6)',
  borderRadius: 4,
  padding: 0,
  transition: 'color 0.15s, background 0.15s',
}
