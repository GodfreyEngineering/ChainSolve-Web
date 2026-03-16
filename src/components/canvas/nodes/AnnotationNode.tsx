/**
 * AnnotationNode -- V3-5.3 non-evaluating visual annotations on the canvas.
 *
 * Supports annotation types via `data.annotationType`:
 *   - text, callout, highlight, arrow, leader
 *   - rectangle, ellipse, diamond, rounded_rectangle (V3-5.2 shapes)
 *
 * V3-5.3: Double-click text/callout/leader to enter inline edit mode.
 * Click outside (blur) commits the edit.
 * V3-5.3: NodeResizer onResize callback for shapes/text.
 * V3-5.3: Arrow length/rotation support.
 * V3-5.3: Inline formatting toolbar (Bold/Italic/Underline).
 */

import { memo, useCallback, useRef, useState } from 'react'
import { Handle, Position, NodeResizer, useReactFlow } from '@xyflow/react'
import type { NodeProps, Node, ResizeParams } from '@xyflow/react'
import type { NodeData } from '../../../blocks/types'
import { KaTeXRenderer } from './KaTeXRenderer'
import { hasMath } from '../../../lib/mathUtils'

const DEFAULT_COLOR = '#facc15'
const DEFAULT_FONT_SIZE = 14

/** Sanitize HTML to allow only safe inline formatting tags. */
function sanitizeHtml(html: string): string {
  // Allowlist approach: parse with DOMParser and only keep safe tags.
  // This avoids regex-based sanitization which can be bypassed with
  // nested multi-character sequences (CWE-20/80/116).
  const SAFE_TAGS = new Set(['B', 'I', 'U', 'BR', 'STRONG', 'EM'])

  const doc = new DOMParser().parseFromString(html, 'text/html')

  function clean(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as Element
    const children = Array.from(el.childNodes).map(clean).join('')
    if (SAFE_TAGS.has(el.tagName)) {
      const tag = el.tagName.toLowerCase()
      return tag === 'br' ? '<br>' : `<${tag}>${children}</${tag}>`
    }
    return children // strip the tag but keep text content
  }

  return Array.from(doc.body.childNodes).map(clean).join('')
}

/** Floating formatting toolbar for text editing. */
function FormattingToolbar({ color }: { color: string }) {
  const exec = (cmd: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    document.execCommand(cmd)
  }

  const btnStyle: React.CSSProperties = {
    width: 24,
    height: 24,
    border: 'none',
    background: 'transparent',
    color: '#eee',
    cursor: 'pointer',
    borderRadius: 3,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: '24px',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: -32,
        left: 0,
        display: 'flex',
        gap: 2,
        background: '#222',
        borderRadius: 4,
        padding: '2px 4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        zIndex: 100,
        border: `1px solid ${color}44`,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button style={btnStyle} onMouseDown={exec('bold')} title="Bold">
        B
      </button>
      <button
        style={{ ...btnStyle, fontStyle: 'italic' }}
        onMouseDown={exec('italic')}
        title="Italic"
      >
        I
      </button>
      <button
        style={{ ...btnStyle, textDecoration: 'underline' }}
        onMouseDown={exec('underline')}
        title="Underline"
      >
        U
      </button>
    </div>
  )
}

function AnnotationNodeInner({ id, data, selected }: NodeProps<Node<NodeData>>) {
  const nd = data as NodeData
  const annotationType = nd.annotationType ?? 'text'
  const text = nd.annotationText ?? nd.label ?? ''
  const html = nd.annotationHtml
  const color = nd.annotationColor ?? DEFAULT_COLOR
  const fontSize = nd.annotationFontSize ?? DEFAULT_FONT_SIZE
  const bold = nd.annotationBold ?? false
  const italic = nd.annotationItalic ?? false
  const textAlign = nd.annotationTextAlign ?? 'left'
  const w = nd.annotationWidth
  const h = nd.annotationHeight
  const borderWidth = nd.annotationBorderWidth ?? 2
  const fillColor = nd.annotationFillColor ?? `${color}20`
  const monospace = nd.annotationMonospace ?? false

  const fontWeight = bold ? 700 : 600
  const fontStyle = italic ? ('italic' as const) : ('normal' as const)
  const fontFamily = monospace ? "ui-monospace, 'Cascadia Code', 'Fira Code', monospace" : undefined

  const [editing, setEditing] = useState(false)
  const editRef = useRef<HTMLDivElement>(null)
  const { updateNodeData } = useReactFlow()

  const hasText =
    annotationType === 'text' ||
    annotationType === 'callout' ||
    annotationType === 'leader' ||
    annotationType === 'sticky_note'

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
    const el = editRef.current
    if (!el) {
      setEditing(false)
      return
    }
    const newHtml = el.innerHTML
    const newText = el.innerText ?? text
    setEditing(false)
    // Check if HTML contains any formatting tags
    const hasFormatting = /<(b|i|u|strong|em)\b/i.test(newHtml)
    updateNodeData(id, {
      annotationText: newText,
      annotationHtml: hasFormatting ? newHtml : undefined,
    })
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

  /** Handle NodeResizer resize — update annotationWidth/Height in node data. */
  const handleResize = useCallback(
    (_event: unknown, params: ResizeParams) => {
      updateNodeData(id, {
        annotationWidth: Math.round(params.width),
        annotationHeight: Math.round(params.height),
      })
    },
    [id, updateNodeData],
  )

  const isResizable =
    annotationType === 'highlight' ||
    annotationType === 'callout' ||
    annotationType === 'text' ||
    annotationType === 'rectangle' ||
    annotationType === 'ellipse' ||
    annotationType === 'diamond' ||
    annotationType === 'rounded_rectangle' ||
    annotationType === 'sticky_note'

  const resizerEl = isResizable && selected && (
    <NodeResizer
      minWidth={40}
      minHeight={24}
      isVisible={selected}
      onResize={handleResize}
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

  /** Render text with bullet list and optional KaTeX math support. */
  const renderText = (t: string) => {
    // Bullet list: lines starting with "- " become bullet points
    const lines = t.split('\n')
    const hasBullets = lines.some((l) => l.startsWith('- ') || l.startsWith('* '))

    if (hasBullets) {
      return (
        <ul style={{ margin: 0, paddingLeft: '1.2em', listStyle: 'disc' }}>
          {lines.map((line, i) => {
            const content = line.startsWith('- ') || line.startsWith('* ') ? line.slice(2) : line
            const isBullet = line.startsWith('- ') || line.startsWith('* ')
            return isBullet ? (
              <li key={i}>{hasMath(content) ? <KaTeXRenderer text={content} /> : content}</li>
            ) : (
              <span key={i} style={{ display: 'block' }}>
                {hasMath(line) ? <KaTeXRenderer text={line} /> : line}
              </span>
            )
          })}
        </ul>
      )
    }

    if (hasMath(t)) return <KaTeXRenderer text={t} />
    return <>{t}</>
  }

  /** Render content — use rich HTML if available, otherwise plain text with KaTeX. */
  const renderContent = () => {
    if (html) {
      return (
        <span style={{ fontFamily }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
      )
    }
    return <span style={{ fontFamily }}>{renderText(text)}</span>
  }

  /** Inline-editable text element. */
  const editableText = editing ? (
    <div
      ref={editRef}
      contentEditable
      suppressContentEditableWarning
      onBlur={commitEdit}
      onKeyDown={handleKeyDown}
      dangerouslySetInnerHTML={{ __html: html ? sanitizeHtml(html) : text }}
      style={{
        outline: 'none',
        minWidth: 20,
        cursor: 'text',
        userSelect: 'text',
        borderBottom: `1px solid ${color}88`,
        fontFamily,
      }}
    />
  ) : (
    renderContent()
  )

  // ── Arrow ──────────────────────────────────────────────────────────────────
  if (annotationType === 'arrow') {
    const thickness = nd.annotationArrowThickness ?? 3
    const dash = nd.annotationArrowDash ?? 'solid'
    const startMarker = nd.annotationArrowStart ?? 'none'
    const endMarker = nd.annotationArrowEnd ?? 'arrowhead'
    const arrowLength = nd.annotationArrowLength ?? 120
    const rotation = nd.annotationRotation ?? 0
    const dashArray =
      dash === 'dashed'
        ? `${thickness * 3} ${thickness * 2}`
        : dash === 'dotted'
          ? `${thickness} ${thickness * 1.5}`
          : undefined

    const mid = (type: string, pos: 'start' | 'end') =>
      `arrow-${type}-${pos}-${color.replace('#', '')}-${id}`

    return (
      <div
        style={{
          ...arrowStyle,
          color,
          textShadow: selected ? `0 0 8px ${color}55` : 'none',
          width: arrowLength,
          height: 32,
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
          transformOrigin: 'center center',
        }}
      >
        <svg
          width="100%"
          height="32"
          viewBox={`0 0 ${arrowLength} 32`}
          fill="none"
          overflow="visible"
          preserveAspectRatio="none"
        >
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
            x2={arrowLength - 8}
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
          width: w ?? 120,
          height: h ?? 60,
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
          position: 'relative',
        }}
        onDoubleClick={handleDoubleClick}
      >
        {resizerEl}
        {editing && <FormattingToolbar color={color} />}
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
          userSelect: editing ? 'text' : 'none',
          cursor: editing ? 'text' : 'grab',
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

  // ── Sticky note ────────────────────────────────────────────────────────────
  if (annotationType === 'sticky_note') {
    const stickyW = w ?? 160
    const stickyH = h ?? 120
    return (
      <div
        style={{
          width: stickyW,
          height: stickyH,
          background: color,
          borderRadius: '2px 10px 10px 10px',
          boxShadow: selected
            ? `2px 4px 16px rgba(0,0,0,0.35), 0 0 0 2px ${color}`
            : '2px 4px 12px rgba(0,0,0,0.25)',
          padding: '0.5rem 0.6rem',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          cursor: editing ? 'text' : 'grab',
          overflow: 'hidden',
        }}
        onDoubleClick={handleDoubleClick}
      >
        {resizerEl}
        {editing && <FormattingToolbar color={color} />}
        {/* Folded corner */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: '12px 12px 0 0',
            borderColor: `rgba(0,0,0,0.15) transparent transparent transparent`,
          }}
        />
        <div
          style={{
            flex: 1,
            color: 'rgba(0,0,0,0.8)',
            fontSize,
            fontWeight,
            fontStyle,
            fontFamily: fontFamily ?? "'Montserrat', system-ui, sans-serif",
            textAlign,
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            overflowY: 'auto',
            userSelect: editing ? 'text' : 'none',
          }}
        >
          {editableText}
        </div>
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
        width: w ?? 'auto',
        height: h ?? 'auto',
        minWidth: w ? undefined : 'auto',
        position: 'relative',
        userSelect: editing ? 'text' : 'none',
        cursor: editing ? 'text' : 'grab',
      }}
      onDoubleClick={handleDoubleClick}
    >
      {resizerEl}
      {editing && <FormattingToolbar color={color} />}
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
