/**
 * AnnotationNode — non-evaluating visual annotations on the canvas (E7-1).
 *
 * Supports three annotation types via `data.annotationType`:
 *   - text: simple text label
 *   - callout: bordered box with text (like a sticky note)
 *   - highlight: colored translucent region
 *
 * These nodes have no input/output handles and are completely excluded
 * from engine evaluation (filtered in bridge.ts).
 */

import { memo } from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import type { NodeData } from '../../../blocks/types'

const DEFAULT_COLOR = '#facc15' // warm yellow
const DEFAULT_FONT_SIZE = 14

function AnnotationNodeInner({ data, selected }: NodeProps<Node<NodeData>>) {
  const nd = data as NodeData
  const annotationType = nd.annotationType ?? 'text'
  const text = nd.annotationText ?? nd.label ?? ''
  const color = nd.annotationColor ?? DEFAULT_COLOR
  const fontSize = nd.annotationFontSize ?? DEFAULT_FONT_SIZE

  if (annotationType === 'highlight') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          minWidth: 80,
          minHeight: 40,
          borderRadius: 8,
          background: `${color}20`,
          border: `2px ${selected ? 'solid' : 'dashed'} ${color}66`,
          boxSizing: 'border-box',
        }}
      />
    )
  }

  if (annotationType === 'callout') {
    return (
      <div
        style={{
          ...calloutStyle,
          borderColor: selected ? color : `${color}88`,
          boxShadow: selected
            ? `0 0 0 2px ${color}44, 0 2px 8px rgba(0,0,0,0.25)`
            : '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ ...calloutAccent, background: color }} />
        <div
          style={{
            ...calloutBody,
            fontSize,
          }}
        >
          {text}
        </div>
      </div>
    )
  }

  // Default: text label
  return (
    <div
      style={{
        ...textStyle,
        fontSize,
        color: color,
        textShadow: selected ? `0 0 8px ${color}55` : 'none',
      }}
    >
      {text}
    </div>
  )
}

export const AnnotationNode = memo(AnnotationNodeInner)

// ── Styles ──────────────────────────────────────────────────────────────────

const textStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', system-ui, sans-serif",
  fontWeight: 600,
  lineHeight: 1.4,
  whiteSpace: 'pre-wrap',
  padding: '0.25rem 0.5rem',
  cursor: 'grab',
  userSelect: 'none',
}

const calloutStyle: React.CSSProperties = {
  minWidth: 120,
  background: 'var(--card-bg)',
  border: '2px solid',
  borderRadius: 10,
  fontFamily: "'Montserrat', system-ui, sans-serif",
  fontSize: '0.82rem',
  color: 'var(--text)',
  overflow: 'hidden',
  boxSizing: 'border-box',
}

const calloutAccent: React.CSSProperties = {
  height: 4,
  width: '100%',
}

const calloutBody: React.CSSProperties = {
  padding: '0.5rem 0.7rem',
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
}
