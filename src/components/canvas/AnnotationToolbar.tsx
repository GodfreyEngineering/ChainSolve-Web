/**
 * AnnotationToolbar — V3-5.3 floating toolbar that appears when an annotation
 * node is selected. Provides quick access to color, bold/italic, font size,
 * and z-order controls without opening the full inspector.
 *
 * Rendered inside the ReactFlow canvas wrapper so it can be positioned
 * relative to the selected annotation node.
 */

import { memo, useCallback } from 'react'
import { useReactFlow, useViewport } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../blocks/types'

const COLOR_PRESETS = ['#facc15', '#60a5fa', '#f87171', '#34d399', '#a78bfa', '#fb923c']

interface Props {
  nodeId: string
  onZOrder?: (nodeId: string, op: 'front' | 'back' | 'forward' | 'backward') => void
}

function AnnotationToolbarInner({ nodeId, onZOrder }: Props) {
  const { t } = useTranslation()
  const { getNode, updateNodeData } = useReactFlow()
  const { x: vx, y: vy, zoom } = useViewport()

  const update = useCallback(
    (patch: Partial<NodeData>) => updateNodeData(nodeId, patch),
    [nodeId, updateNodeData],
  )

  const node = getNode(nodeId)
  if (!node || node.type !== 'csAnnotation') return null

  const data = node.data as NodeData
  const annotationType = data.annotationType ?? 'text'
  const hasText =
    annotationType === 'text' || annotationType === 'callout' || annotationType === 'leader'

  // Position toolbar above the node in screen coordinates
  const screenX = node.position.x * zoom + vx
  const screenY = node.position.y * zoom + vy - 44

  return (
    <div
      style={{
        position: 'absolute',
        left: screenX,
        top: Math.max(4, screenY),
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '3px 5px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Color presets */}
      {COLOR_PRESETS.map((c) => (
        <button
          key={c}
          style={{
            ...swatchBtn,
            background: c,
            outline: data.annotationColor === c ? '2px solid var(--text)' : 'none',
            outlineOffset: 1,
          }}
          onClick={() => update({ annotationColor: c })}
          aria-label={c}
        />
      ))}

      <Sep />

      {/* Bold / Italic */}
      {hasText && (
        <>
          <button
            style={{
              ...toolBtn,
              fontWeight: 700,
              background: data.annotationBold ? 'var(--primary)' : undefined,
            }}
            onClick={() => update({ annotationBold: !data.annotationBold })}
            title={t('annotation.bold')}
          >
            B
          </button>
          <button
            style={{
              ...toolBtn,
              fontStyle: 'italic',
              background: data.annotationItalic ? 'var(--primary)' : undefined,
            }}
            onClick={() => update({ annotationItalic: !data.annotationItalic })}
            title={t('annotation.italic')}
          >
            I
          </button>

          <Sep />

          {/* Font size -/+ */}
          <button
            style={toolBtn}
            onClick={() => {
              const cur = data.annotationFontSize ?? 14
              if (cur > 8) update({ annotationFontSize: cur - 2 })
            }}
            title={t('annotationToolbar.decreaseFont')}
          >
            A-
          </button>
          <span
            style={{
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              minWidth: 18,
              textAlign: 'center',
            }}
          >
            {data.annotationFontSize ?? 14}
          </span>
          <button
            style={toolBtn}
            onClick={() => {
              const cur = data.annotationFontSize ?? 14
              if (cur < 72) update({ annotationFontSize: cur + 2 })
            }}
            title={t('annotationToolbar.increaseFont')}
          >
            A+
          </button>

          <Sep />
        </>
      )}

      {/* Z-order */}
      {onZOrder && (
        <>
          <button
            style={toolBtn}
            onClick={() => onZOrder(nodeId, 'front')}
            title={t('contextMenu.bringToFront')}
          >
            {'\u21c8'}
          </button>
          <button
            style={toolBtn}
            onClick={() => onZOrder(nodeId, 'back')}
            title={t('contextMenu.sendToBack')}
          >
            {'\u21ca'}
          </button>
        </>
      )}
    </div>
  )
}

export const AnnotationToolbar = memo(AnnotationToolbarInner)

// ── Helpers ──────────────────────────────────────────────────────────────────

function Sep() {
  return <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px' }} />
}

// ── Styles ───────────────────────────────────────────────────────────────────

const swatchBtn: React.CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 3,
  border: '1px solid rgba(255,255,255,0.15)',
  cursor: 'pointer',
  padding: 0,
}

const toolBtn: React.CSSProperties = {
  width: 26,
  height: 24,
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--surface-hover)',
  color: 'var(--text)',
  fontSize: '0.7rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
}
