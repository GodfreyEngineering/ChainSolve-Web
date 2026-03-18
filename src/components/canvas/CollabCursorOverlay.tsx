/**
 * CollabCursorOverlay — 5.7: Renders remote user cursors + presence indicators.
 *
 * Renders coloured cursor SVG pointers + nametags for each active collaborator
 * on the canvas. Positions are in React Flow canvas coordinates and are
 * transformed to screen coordinates using the React Flow viewport.
 *
 * Also renders a small presence bar in the top-right corner showing online
 * users as coloured avatar bubbles.
 */

import { memo } from 'react'
import { useViewport } from '@xyflow/react'
import type { CollabUser } from '../../lib/collaboration'

interface CollabCursorOverlayProps {
  users: CollabUser[]
}

/**
 * A single remote cursor: coloured SVG arrow + user name tag.
 * Position is in canvas coordinates; viewport transforms to screen.
 */
function RemoteCursor({
  user,
  vx,
  vy,
  zoom,
}: {
  user: CollabUser
  vx: number
  vy: number
  zoom: number
}) {
  if (!user.cursor) return null

  const sx = user.cursor.x * zoom + vx
  const sy = user.cursor.y * zoom + vy

  return (
    <div
      style={{
        position: 'absolute',
        left: sx,
        top: sy,
        pointerEvents: 'none',
        zIndex: 1000,
        transform: 'translate(0, 0)',
      }}
    >
      {/* Cursor arrow SVG */}
      <svg width="20" height="20" viewBox="0 0 20 20" style={{ display: 'block' }}>
        <path
          d="M0,0 L0,14 L4,10 L7,17 L9,16 L6,9 L11,9 Z"
          fill={user.color}
          stroke="white"
          strokeWidth="1"
        />
      </svg>
      {/* Name tag */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 4,
          background: user.color,
          color: 'white',
          fontSize: 10,
          fontWeight: 600,
          padding: '1px 5px',
          borderRadius: 3,
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          fontFamily: 'var(--font-ui, sans-serif)',
        }}
      >
        {user.name}
      </div>
    </div>
  )
}

/** Presence bar: small coloured avatar bubbles for each online user. */
function PresenceBar({ users }: { users: CollabUser[] }) {
  if (users.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        display: 'flex',
        gap: 4,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {users.map((user) => (
        <div
          key={user.userId}
          title={user.name}
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: user.color,
            border: '2px solid rgba(255,255,255,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            cursor: 'default',
            pointerEvents: 'auto',
          }}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
      ))}
    </div>
  )
}

/** Selection highlight: tints node border when a remote user has it selected. */
export function getNodeSelectionStyle(
  nodeId: string,
  users: CollabUser[],
): React.CSSProperties | null {
  for (const user of users) {
    if (user.selectedNodeIds.includes(nodeId)) {
      return { outline: `2px solid ${user.color}`, outlineOffset: 2 }
    }
  }
  return null
}

function CollabCursorOverlayInner({ users }: CollabCursorOverlayProps) {
  const { x: vx, y: vy, zoom } = useViewport()

  return (
    <>
      {/* Presence bar (top-right) */}
      <PresenceBar users={users} />

      {/* Remote cursors */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 999,
        }}
      >
        {users.map((user) => (
          <RemoteCursor key={user.userId} user={user} vx={vx} vy={vy} zoom={zoom} />
        ))}
      </div>
    </>
  )
}

export const CollabCursorOverlay = memo(CollabCursorOverlayInner)
