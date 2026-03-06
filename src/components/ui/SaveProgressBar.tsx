/**
 * SaveProgressBar — thin animated bar at the bottom of the toolbar
 * showing save progress (0.0–1.0). Uses CSS transitions for fade-out.
 *
 * Always rendered when canvasControls is present. CSS opacity handles visibility.
 */

import type { SaveStatus } from '../../stores/projectStore'

interface SaveProgressBarProps {
  progress: number
  status: SaveStatus
}

export function SaveProgressBar({ progress, status }: SaveProgressBarProps) {
  const active = status === 'saving' || status === 'saved'

  return (
    <div style={containerStyle}>
      <div
        style={{
          ...barStyle,
          width: active ? `${progress * 100}%` : '0%',
          opacity: status === 'saving' ? 1 : 0,
          transition:
            status === 'saving'
              ? 'width 200ms ease-out'
              : 'width 200ms ease-out, opacity 300ms ease-out 300ms',
        }}
      />
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: 2,
  overflow: 'hidden',
  pointerEvents: 'none',
}

const barStyle: React.CSSProperties = {
  height: '100%',
  background: 'var(--primary)',
}
