/**
 * WindowDock — renders minimized window tabs in a bottom dock bar.
 *
 * Only visible when at least one window is minimized.
 * Clicking a tab restores (un-minimizes) the window.
 */
import { useWindowManager } from '../../contexts/WindowManagerContext'

const dockBar: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 9999,
  display: 'flex',
  gap: '0.25rem',
  padding: '0.25rem 0.5rem',
  background: 'var(--surface2, #2c2c2c)',
  borderTop: '1px solid var(--border)',
}

const tabStyle: React.CSSProperties = {
  padding: '0.3rem 0.75rem',
  fontSize: '0.78rem',
  fontWeight: 500,
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--card-bg)',
  color: 'inherit',
  cursor: 'pointer',
  fontFamily: 'inherit',
  maxWidth: 160,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

/** Capitalize + humanize a windowId for display (e.g. "settings" → "Settings"). */
function formatTitle(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]/g, ' ')
}

export function WindowDock() {
  const { windows, toggleMinimize, focusWindow } = useWindowManager()
  const minimized = windows.filter((w) => w.minimized)

  if (minimized.length === 0) return null

  return (
    <div style={dockBar}>
      {minimized.map((w) => (
        <button
          key={w.id}
          style={tabStyle}
          onClick={() => {
            toggleMinimize(w.id)
            focusWindow(w.id)
          }}
          title={formatTitle(w.id)}
        >
          {formatTitle(w.id)}
        </button>
      ))}
    </div>
  )
}
