/**
 * AnnotationNode -- V3-5.3 non-evaluating visual annotations on the canvas.
 *
 * Supports annotation types via `data.annotationType`:
 *   - text, callout, highlight, arrow, leader
 *   - rectangle, ellipse, diamond, rounded_rectangle (V3-5.2 shapes)
 *
 * V3-5.3: Double-click text/callout/leader to enter inline edit mode.
 * Click outside (blur) commits the edit.
 */

import { memo, useCallback, useRef, useState } from 'react'
import { Handle, Position, NodeResizer, useReactFlow } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import type { NodeData } from '../../../blocks/types'

const DEFAULT_COLOR = '#facc15'
const DEFAULT_FONT_SIZE = 14

function AnnotationNodeInner({ id, data, selected }: NodeProps<Node<NodeData>>) {
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
  const borderWidth = nd.annotationBorderWidth ?? 2
  const fillColor = nd.annotationFillColor ?? `${color}20`

  const fontWeight = bold ? 700 : 600
  const fontStyle = italic ? ('italic' as const) : ('normal' as const)

  const [editing, setEditing] = useState(false)
  const editRef = useRef<HTMLDivElement>(null)
  const { updateNodeData } = useReactFlow()

  const hasText =
    annotationType === 'text' || annotationType === 'callout' || annotationType === 'leader'

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!hasText) return
      e.stopPropagation()
      setEditing(true)
      requestAnimationFrame(() => {
        if (editRef.current) {
          editRef.current.focus()
          // Select all text
          const sel = window.getSelection()
          const range = document.createRange()
          range.selectNodeContents(editRef.current)
          sel?.removeAllRanges()
          sel?.addRange(range)
        }
      })
    },
    [hasText],
  )

  const commitEdit = useCallback(() => {
    if (!editing) return
    const newText = editRef.current?.innerText ?? text
    setEditing(false)
    updateNodeData(id, { annotationText: newText })
  }, [editing, text, id, updateNodeData])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditing(false)
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        commitEdit()
      }
    },
    [commitEdit],
  )

  const isResizable =
    annotationType === 'highlight' ||
    annotationType === 'callout' ||
    annotationType === 'text' ||
    annotationType === 'rectangle' ||
    annotationType === 'ellipse' ||
    annotationType === 'diamond' ||
    annotationType === 'rounded_rectangle'

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

  /** Inline-editable text element. */
  const editableText = editing ? (
    <div
      ref={editRef}
      contentEditable
      suppressContentEditableWarning
      onBlur={commitEdit}
      onKeyDown={handleKeyDown}
      style={{
        outline: 'none',
        minWidth: 20,
        cursor: 'text',
        borderBottom: `1px solid ${color}88`,
      }}
    >
      {text}
    </div>
  ) : (
    <span>{text}</span>
  )

  // ── Arrow ──────────────────────────────────────────────────────────────────
  if (annotationType === 'arrow') {
    const thickness = nd.annotationArrowThickness ?? 3
    const dash = nd.annotationArrowDash ?? 'solid'
    const startMarker = nd.annotationArrowStart ?? 'none'
    const endMarker = nd.annotationArrowEnd ?? 'arrowhead'
    const dashArray =
      dash === 'dashed'
        ? `${thickness * 3} ${thickness * 2}`
        : dash === 'dotted'
          ? `${thickness} ${thickness * 1.5}`
          : undefined

    const mid = (type: string, pos: 'start' | 'end') =>
      `arrow-${type}-${pos}-${color.replace('#', '')}`

    return (
      <div style={{ ...arrowStyle, color, textShadow: selected ? `0 0 8px ${color}55` : 'none' }}>
        <svg width="80" height="32" viewBox="0 0 80 32" fill="none" overflow="visible">
          <defs>
            {endMarker === 'arrowhead' && (
              <marker
                id={mid('arrowhead', 'end')}
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <polyline
                  points="1,1 7,4 1,7"
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </marker>
            )}
            {endMarker === 'dot' && (
              <marker
                id={mid('dot', 'end')}
                markerWidth="8"
                markerHeight="8"
                refX="4"
                refY="4"
                orient="auto"
              >
                <circle cx="4" cy="4" r="3" fill={color} />
              </marker>
            )}
            {endMarker === 'square' && (
              <marker
                id={mid('square', 'end')}
                markerWidth="8"
                markerHeight="8"
                refX="4"
                refY="4"
                orient="auto"
              >
                <rect x="1" y="1" width="6" height="6" fill={color} />
              </marker>
            )}
            {startMarker === 'arrowhead' && (
              <marker
                id={mid('arrowhead', 'start')}
                markerWidth="8"
                markerHeight="8"
                refX="1"
                refY="4"
                orient="auto"
              >
                <polyline
                  points="7,1 1,4 7,7"
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </marker>
            )}
            {startMarker === 'dot' && (
              <marker
                id={mid('dot', 'start')}
                markerWidth="8"
                markerHeight="8"
                refX="4"
                refY="4"
                orient="auto"
              >
                <circle cx="4" cy="4" r="3" fill={color} />
              </marker>
            )}
            {startMarker === 'square' && (
              <marker
                id={mid('square', 'start')}
                markerWidth="8"
                markerHeight="8"
                refX="4"
                refY="4"
                orient="auto"
              >
                <rect x="1" y="1" width="6" height="6" fill={color} />
              </marker>
            )}
          </defs>
          <line
            x1="4"
            y1="16"
            x2="72"
            y2="16"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={dashArray}
            markerStart={startMarker !== 'none' ? `url(#${mid(startMarker, 'start')})` : undefined}
            markerEnd={endMarker !== 'none' ? `url(#${mid(endMarker, 'end')})` : undefined}
          />
        </svg>
      </div>
    )
  }

  // ── Highlight ──────────────────────────────────────────────────────────────
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

  // ── Callout ────────────────────────────────────────────────────────────────
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
        onDoubleClick={handleDoubleClick}
      >
        {resizerEl}
        <div style={{ ...calloutAccent, background: color }} />
        <div style={{ ...calloutBody, fontSize, fontWeight, fontStyle, textAlign }}>
          {editableText}
        </div>
      </div>
    )
  }

  // ── Leader ─────────────────────────────────────────────────────────────────
  if (annotationType === 'leader') {
    return (
      <div
        style={{
          ...textStyle,
          fontSize,
          fontWeight,
          fontStyle,
          textAlign,
          color,
          textShadow: selected ? `0 0 8px ${color}55` : 'none',
          position: 'relative',
        }}
        onDoubleClick={handleDoubleClick}
      >
        {editableText}
        <Handle
          type="source"
          position={Position.Right}
          id="leader-out"
          style={leaderHandleStyle(color)}
        />
      </div>
    )
  }

  // ── Shape primitives ───────────────────────────────────────────────────────
  if (
    annotationType === 'rectangle' ||
    annotationType === 'ellipse' ||
    annotationType === 'diamond' ||
    annotationType === 'rounded_rectangle'
  ) {
    const shapeW = w ?? 120
    const shapeH = h ?? 80
    const selBorder = selected ? `0 0 0 2px ${color}44` : 'none'

    return (
      <div
        style={{
          width: shapeW,
          height: shapeH,
          position: 'relative',
          boxShadow: selBorder,
          borderRadius:
            annotationType === 'ellipse' ? '50%' : annotationType === 'rounded_rectangle' ? 12 : 0,
        }}
      >
        {resizerEl}
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${shapeW} ${shapeH}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {annotationType === 'rectangle' && (
            <rect
              x={borderWidth / 2}
              y={borderWidth / 2}
              width={shapeW - borderWidth}
              height={shapeH - borderWidth}
              fill={fillColor}
              stroke={color}
              strokeWidth={borderWidth}
            />
          )}
          {annotationType === 'rounded_rectangle' && (
            <rect
              x={borderWidth / 2}
              y={borderWidth / 2}
              width={shapeW - borderWidth}
              height={shapeH - borderWidth}
              rx={12}
              ry={12}
              fill={fillColor}
              stroke={color}
              strokeWidth={borderWidth}
            />
          )}
          {annotationType === 'ellipse' && (
            <ellipse
              cx={shapeW / 2}
              cy={shapeH / 2}
              rx={shapeW / 2 - borderWidth / 2}
              ry={shapeH / 2 - borderWidth / 2}
              fill={fillColor}
              stroke={color}
              strokeWidth={borderWidth}
            />
          )}
          {annotationType === 'diamond' && (
            <polygon
              points={`${shapeW / 2},${borderWidth} ${shapeW - borderWidth},${shapeH / 2} ${shapeW / 2},${shapeH - borderWidth} ${borderWidth},${shapeH / 2}`}
              fill={fillColor}
              stroke={color}
              strokeWidth={borderWidth}
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
    )
  }

  // ── Default: text label ────────────────────────────────────────────────────
  return (
    <div
      style={{
        ...textStyle,
        fontSize,
        fontWeight,
        fontStyle,
        textAlign,
        color,
        textShadow: selected ? `0 0 8px ${color}55` : 'none',
        width: w,
        height: h,
        minWidth: w ? undefined : 'auto',
      }}
      onDoubleClick={handleDoubleClick}
    >
      {resizerEl}
      {editableText}
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
