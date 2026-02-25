/**
 * CanvasPage — full-page layout for the node-graph editor.
 * Thin top bar with a back link; the rest is CanvasArea.
 */

import { CanvasArea } from '../components/canvas/CanvasArea'

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    overflow: 'hidden',
    background: 'var(--bg)',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0 1rem',
    height: 44,
    borderBottom: '1px solid var(--border)',
    background: 'var(--card-bg)',
    flexShrink: 0,
  },
  backLink: {
    fontSize: '0.82rem',
    opacity: 0.6,
    textDecoration: 'none',
    color: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  },
  title: {
    fontWeight: 700,
    fontSize: '0.95rem',
    letterSpacing: '-0.3px',
  },
  hint: {
    marginLeft: 'auto',
    fontSize: '0.72rem',
    opacity: 0.4,
  },
}

export default function CanvasPage() {
  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <a href="/app" style={s.backLink}>
          ← Back
        </a>
        <span style={s.title}>ChainSolve Canvas</span>
        <span style={s.hint}>
          Drag blocks from the left panel · Connect handles · Delete to remove
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <CanvasArea />
      </div>
    </div>
  )
}
