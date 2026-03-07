/**
 * AnnotationNode -- V3-5.1 non-evaluating visual annotations on the canvas.
 *
 * Supports five annotation types via `data.annotationType`:
 *   - text: simple text label
 *   - callout: bordered box with text (like a sticky note)
 *   - highlight: colored translucent region
 *   - arrow: directional arrow indicator
 *   - leader: text label with a source handle for connecting to blocks
 *
 * V3-5.1 enhancements:
 *   - 8-point resize handles via ReactFlow `NodeResizer`
 *   - Width/height stored in NodeData (annotationWidth/annotationHeight)
 *   - Z-ordering via annotationZIndex (rendered via zIndex on the wrapper)
 *   - Text alignment support (left/center/right)
 *
 * These nodes have no block-system registration and are completely excluded
 * from engine evaluation (filtered in bridge.ts by the `annotation_` prefix).
 */

import { memo } from 'react'
import { Handle, Position, NodeResizer } from '@xyflow/react'
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
  const bold = nd.annotationBold ?? false
  const italic = nd.annotationItalic ?? false
  const textAlign = nd.annotationTextAlign ?? 'left'
  const w = nd.annotationWidth
  const h = nd.annotationHeight

  const fontWeight = bold ? 700 : 600
  const fontStyle = italic ? ('italic' as const) : ('normal' as const)

  // Resizable types get NodeResizer handles
  const isResizable =
    annotationType === 'highlight' || annotationType === 'callout' || annotationType === 'text'

  const resizerEl = isResizable && selected && (
    <NodeResizer
      minWidth={40}
      minHeight={24}
      isVisible={selected}
      lineStyle={{ borderColor: color, borderWidth: 1 }}
      handleStyle={{
        width: 8,
        height: 8,
        borderRadius: 2,
        background: color,
        border: '1px solid var(--surface-2)',
      }}
    />
  )

  if (annotationType === 'arrow') {
    return (
      <div
        style={{
          ...arrowStyle,
          color,
          textShadow: selected ? `0 0 8px ${color}55` : 'none',
        }}
      >
        <svg width="48" height="24" viewBox="0 0 48 24" fill="none">
          <line
            x1="0"
            y1="12"
            x2="36"
            y2="12"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <polyline
            points="32,4 44,12 32,20"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    )
  }

  if (annotationType === 'highlight') {
    return (
      <div
        style={{
          width: w ?? '100%',
          height: h ?? '100%',
          minWidth: 80,
          minHeight: 40,
          borderRadius: 8,
          background: `${color}20`,
          border: `2px ${selected ? 'solid' : 'dashed'} ${color}66`,
          boxSizing: 'border-box',
        }}
      >
        {resizerEl}
      </div>
    )
  }

  if (annotationType === 'callout') {
    return (
      <div
        style={{
          ...calloutStyle,
          width: w,
          height: h,
          borderColor: selected ? color : `${color}88`,
          boxShadow: selected
            ? `0 0 0 2px ${color}44, 0 2px 8px rgba(0,0,0,0.25)`
            : '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        {resizerEl}
        <div style={{ ...calloutAccent, background: color }} />
        <div
          style={{
            ...calloutBody,
            fontSize,
            fontWeight,
            fontStyle,
            textAlign,
          }}
        >
          {text}
        </div>
      </div>
    )
  }

  if (annotationType === 'leader') {
    return (
      <div
        style={{
          ...textStyle,
          fontSize,
          fontWeight,
          fontStyle,
          textAlign,
          color: color,
          textShadow: selected ? `0 0 8px ${color}55` : 'none',
          position: 'relative',
        }}
      >
        {text}
        <Handle
          type="source"
          position={Position.Right}
          id="leader-out"
          style={leaderHandleStyle(color)}
        />
      </div>
    )
  }

  // Default: text label
  return (
    <div
      style={{
        ...textStyle,
        fontSize,
        fontWeight,
        fontStyle,
        textAlign,
        color: color,
        textShadow: selected ? `0 0 8px ${color}55` : 'none',
        width: w,
        height: h,
        minWidth: w ? undefined : 'auto',
      }}
    >
      {resizerEl}
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
  background: 'var(--surface-2)',
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

const arrowStyle: React.CSSProperties = {
  cursor: 'grab',
  userSelect: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.15rem',
}

function leaderHandleStyle(color: string): React.CSSProperties {
  return {
    background: color,
    width: 8,
    height: 8,
    border: '2px solid var(--surface-2)',
    borderRadius: '50%',
  }
}
