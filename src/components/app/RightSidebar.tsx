/**
 * RightSidebar — collapsible right sidebar for the workspace (V3-2.3).
 *
 * Default tab: Inspector (docked). When open, the Inspector renders inline
 * here instead of as a floating AppWindow.
 * Toggle: Ctrl+J or via the View menu.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Info } from 'lucide-react'
import { usePanelLayout } from '../../contexts/PanelLayoutContext'
import { Inspector } from '../canvas/Inspector'
import { Icon } from '../ui/Icon'
import { Tooltip } from '../ui/Tooltip'
import { useIsMobile } from '../../hooks/useIsMobile'

const MIN_WIDTH = 240
const MAX_WIDTH = 480

interface RightSidebarProps {
  /** Currently selected node ID (for docked Inspector). */
  selectedNodeId: string | null
  onToggleCollapse?: (groupId: string) => void
  onUngroupNode?: (groupId: string) => void
  canUseGroups?: boolean
}

export function RightSidebar({
  selectedNodeId,
  onToggleCollapse,
  onUngroupNode,
  canUseGroups,
}: RightSidebarProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const { rightOpen, rightWidth, setRightWidth, toggleRight, setRightOpen } = usePanelLayout()
  const [width, setWidth] = useState(rightWidth)
  const resizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  // Sync persisted width on mount
  useEffect(() => {
    setWidth(rightWidth)
  }, [rightWidth])

  // Keyboard shortcut: Ctrl+J
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        toggleRight()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleRight])

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      resizing.current = true
      startX.current = e.clientX
      startWidth.current = width
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'

      const onMove = (me: MouseEvent) => {
        if (!resizing.current) return
        // Dragging left increases width
        const delta = startX.current - me.clientX
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
        setWidth(newWidth)
      }
      const onUp = () => {
        resizing.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        setRightWidth(width)
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [width, setRightWidth],
  )

  if (!rightOpen || isMobile) return null

  return (
    <div style={{ ...panelStyle, width }}>
      {/* Resize handle (left edge) */}
      <div style={resizeHandleStyle} onMouseDown={onResizeStart} />

      {/* Tab bar */}
      <div style={tabBarStyle}>
        <Tooltip content={t('sidebar.collapse')} side="bottom">
          <button
            style={collapseBtnStyle}
            onClick={() => setRightOpen(false)}
            aria-label="Collapse"
          >
            <Icon icon={ChevronRight} size={14} />
          </button>
        </Tooltip>
        <div style={{ flex: 1 }} />
        <span style={tabActiveStyle}>
          <Icon icon={Info} size={14} />
          <span style={{ fontSize: '0.7rem' }}>{t('toolbar.inspector', 'Inspector')}</span>
        </span>
      </div>

      {/* Docked Inspector */}
      <div style={contentStyle}>
        <Inspector
          nodeId={selectedNodeId}
          width={0}
          onClose={() => setRightOpen(false)}
          onResizeStart={() => {}}
          onToggleCollapse={onToggleCollapse}
          onUngroupNode={onUngroupNode}
          canUseGroups={canUseGroups}
          floating
        />
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: 'var(--surface-1)',
  borderLeft: '1px solid var(--border)',
  flexShrink: 0,
  position: 'relative',
  overflow: 'hidden',
}

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0 0.25rem',
  height: 32,
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}

const tabActiveStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--primary)',
  padding: '0 0.35rem',
}

const collapseBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  borderRadius: 4,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
}

const resizeHandleStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 4,
  cursor: 'ew-resize',
  zIndex: 10,
}
