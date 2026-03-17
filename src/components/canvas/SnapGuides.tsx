/**
 * SnapGuides — renders alignment guide lines on the canvas during drag.
 *
 * Shows thin cyan lines when blocks are magnetically aligned.
 * Rendered as an SVG overlay inside the React Flow viewport.
 */

import type { SnapGuide } from '../../hooks/useBlockSnapping'

const GUIDE_COLOR = '#1CABB0'
const GUIDE_WIDTH = 1
const GUIDE_DASH = '4 3'

export function SnapGuides({ guides }: { guides: SnapGuide[] }) {
  if (guides.length === 0) return null

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'visible',
      }}
    >
      {guides.map((g, i) =>
        g.axis === 'x' ? (
          <line
            key={`guide-${i}`}
            x1={g.position}
            y1={g.from}
            x2={g.position}
            y2={g.to}
            stroke={GUIDE_COLOR}
            strokeWidth={GUIDE_WIDTH}
            strokeDasharray={GUIDE_DASH}
            opacity={0.7}
          />
        ) : (
          <line
            key={`guide-${i}`}
            x1={g.from}
            y1={g.position}
            x2={g.to}
            y2={g.position}
            stroke={GUIDE_COLOR}
            strokeWidth={GUIDE_WIDTH}
            strokeDasharray={GUIDE_DASH}
            opacity={0.7}
          />
        ),
      )}
    </svg>
  )
}
