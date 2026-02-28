/**
 * FloatingInspector — wraps the Inspector panel in a floating AppWindow.
 *
 * Manages selection following (auto-update inspected node on click)
 * and pin/unpin (lock to a specific node).
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { AppWindow } from '../ui/AppWindow'
import { Inspector } from './Inspector'
import { useWindowManager } from '../../contexts/WindowManagerContext'

export const INSPECTOR_WINDOW_ID = 'inspector'
const DEFAULT_GEOMETRY = { width: 320, height: 500 }

interface FloatingInspectorProps {
  nodeId: string | null
  pinned: boolean
  onTogglePin: () => void
  onToggleCollapse?: (groupId: string) => void
  onUngroupNode?: (groupId: string) => void
  canUseGroups?: boolean
}

export function FloatingInspector({
  nodeId,
  pinned,
  onTogglePin,
  onToggleCollapse,
  onUngroupNode,
  canUseGroups,
}: FloatingInspectorProps) {
  const { t } = useTranslation()
  const { closeWindow } = useWindowManager()
  const [, setDummy] = useState(0)

  const handleClose = useCallback(() => {
    closeWindow(INSPECTOR_WINDOW_ID)
  }, [closeWindow])

  // Force a re-render when user interacts (keeps content fresh)
  const noop = useCallback(() => setDummy((v) => v + 1), [])

  return (
    <AppWindow
      windowId={INSPECTOR_WINDOW_ID}
      title={t('toolbar.inspector', 'Inspector')}
      minWidth={260}
      minHeight={280}
    >
      {/* Pin toggle bar */}
      <div style={pinBarStyle}>
        <button
          onClick={onTogglePin}
          style={{
            ...pinBtnStyle,
            color: pinned ? '#f59e0b' : 'rgba(244,244,243,0.4)',
          }}
          title={
            pinned
              ? t('inspector.unpin', 'Unpin selection')
              : t('inspector.pin', 'Pin to current node')
          }
          aria-label={pinned ? 'Unpin selection' : 'Pin to current node'}
        >
          {pinned ? '\u{1F4CC}' : '\u{1F4CC}'}
          <span style={{ marginLeft: 4, fontSize: '0.7rem', opacity: 0.7 }}>
            {pinned
              ? t('inspector.pinned', 'Pinned')
              : t('inspector.followSelection', 'Following selection')}
          </span>
        </button>
      </div>

      {/* Reuse existing Inspector — pass width=0 since AppWindow handles sizing */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Inspector
          nodeId={nodeId}
          width={0}
          onClose={handleClose}
          onResizeStart={noop}
          onToggleCollapse={onToggleCollapse}
          onUngroupNode={onUngroupNode}
          canUseGroups={canUseGroups}
          floating
        />
      </div>
    </AppWindow>
  )
}

/** Default geometry for the inspector window. */
export const INSPECTOR_DEFAULTS = DEFAULT_GEOMETRY

// ── Styles ──────────────────────────────────────────────────────────────────

const pinBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '3px 8px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  flexShrink: 0,
}

const pinBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.75rem',
  fontFamily: 'inherit',
  padding: '2px 4px',
  borderRadius: 4,
}
