/**
 * AnnotationInspector -- V3-5.1 property panel for annotation nodes.
 *
 * Shown inside the Inspector when the selected node has an annotationType.
 * Provides controls for text, color, font size, bold/italic, text alignment,
 * explicit width/height, and z-order buttons.
 */

import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../../blocks/types'

const COLOR_PRESETS = [
  '#facc15', // yellow
  '#60a5fa', // blue
  '#f87171', // red
  '#34d399', // green
  '#a78bfa', // purple
  '#fb923c', // orange
  '#f472b6', // pink
  '#94a3b8', // slate
]

interface Props {
  data: NodeData
  onUpdate: (patch: Partial<NodeData>) => void
  onZOrder?: (op: 'front' | 'back' | 'forward' | 'backward') => void
}

export function AnnotationInspector({ data, onUpdate, onZOrder }: Props) {
  const { t } = useTranslation()
  const hasText =
    data.annotationType === 'text' ||
    data.annotationType === 'callout' ||
    data.annotationType === 'leader'

  const isResizable =
    data.annotationType === 'highlight' ||
    data.annotationType === 'callout' ||
    data.annotationType === 'text'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {/* Text */}
      {hasText && (
        <Field label={t('annotation.text')}>
          <textarea
            style={textareaStyle}
            rows={3}
            value={data.annotationText ?? ''}
            onChange={(e) => onUpdate({ annotationText: e.target.value })}
          />
        </Field>
      )}

      {/* Color */}
      <Field label={t('annotation.color')}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              style={{
                ...swatchStyle,
                background: c,
                outline: data.annotationColor === c ? '2px solid var(--text)' : 'none',
                outlineOffset: 1,
              }}
              onClick={() => onUpdate({ annotationColor: c })}
              aria-label={c}
            />
          ))}
          <input
            type="color"
            style={colorInputStyle}
            value={data.annotationColor ?? '#facc15'}
            onChange={(e) => onUpdate({ annotationColor: e.target.value })}
          />
        </div>
      </Field>

      {/* Font size */}
      {hasText && (
        <Field label={t('annotation.fontSize')}>
          <input
            type="number"
            style={numInputStyle}
            min={8}
            max={72}
            step={1}
            value={data.annotationFontSize ?? 14}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              if (!isNaN(v) && v >= 8 && v <= 72) onUpdate({ annotationFontSize: v })
            }}
          />
        </Field>
      )}

      {/* Bold / Italic / Alignment toggles */}
      {hasText && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={{
              ...toggleStyle,
              fontWeight: 700,
              background: data.annotationBold ? 'var(--primary)' : 'var(--surface-hover)',
            }}
            onClick={() => onUpdate({ annotationBold: !data.annotationBold })}
            title={t('annotation.bold')}
            aria-label={t('annotation.bold')}
            aria-pressed={!!data.annotationBold}
          >
            B
          </button>
          <button
            style={{
              ...toggleStyle,
              fontStyle: 'italic',
              background: data.annotationItalic ? 'var(--primary)' : 'var(--surface-hover)',
            }}
            onClick={() => onUpdate({ annotationItalic: !data.annotationItalic })}
            title={t('annotation.italic')}
            aria-label={t('annotation.italic')}
            aria-pressed={!!data.annotationItalic}
          >
            I
          </button>
          <div style={{ width: 1, background: 'var(--border)', margin: '0 2px' }} />
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              style={{
                ...toggleStyle,
                background:
                  (data.annotationTextAlign ?? 'left') === align
                    ? 'var(--primary)'
                    : 'var(--surface-hover)',
              }}
              onClick={() => onUpdate({ annotationTextAlign: align })}
              title={t(`annotation.align${align.charAt(0).toUpperCase() + align.slice(1)}`)}
              aria-label={align}
              aria-pressed={(data.annotationTextAlign ?? 'left') === align}
            >
              {align === 'left' ? '\u2190' : align === 'center' ? '\u2194' : '\u2192'}
            </button>
          ))}
        </div>
      )}

      {/* Width / Height */}
      {isResizable && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Field label={t('annotation.width')}>
            <input
              type="number"
              style={numInputStyle}
              min={40}
              max={2000}
              step={10}
              value={data.annotationWidth ?? ''}
              placeholder="auto"
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                onUpdate({ annotationWidth: isNaN(v) ? undefined : Math.max(40, v) })
              }}
            />
          </Field>
          <Field label={t('annotation.height')}>
            <input
              type="number"
              style={numInputStyle}
              min={24}
              max={2000}
              step={10}
              value={data.annotationHeight ?? ''}
              placeholder="auto"
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                onUpdate({ annotationHeight: isNaN(v) ? undefined : Math.max(24, v) })
              }}
            />
          </Field>
        </div>
      )}

      {/* Z-order */}
      {onZOrder && (
        <Field label={t('annotation.zOrder')}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              style={toggleStyle}
              onClick={() => onZOrder('front')}
              title={t('contextMenu.bringToFront')}
            >
              {'\u21c8'}
            </button>
            <button
              style={toggleStyle}
              onClick={() => onZOrder('forward')}
              title={t('contextMenu.bringForward')}
            >
              {'\u2191'}
            </button>
            <button
              style={toggleStyle}
              onClick={() => onZOrder('backward')}
              title={t('contextMenu.sendBackward')}
            >
              {'\u2193'}
            </button>
            <button
              style={toggleStyle}
              onClick={() => onZOrder('back')}
              title={t('contextMenu.sendToBack')}
            >
              {'\u21ca'}
            </button>
          </div>
        </Field>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'rgba(244,244,243,0.5)',
  marginBottom: 3,
  userSelect: 'none',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface-hover)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: '0.8rem',
  fontFamily: "'Montserrat', system-ui, sans-serif",
  padding: '0.4rem 0.5rem',
  resize: 'vertical',
  boxSizing: 'border-box',
}

const swatchStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.15)',
  cursor: 'pointer',
  padding: 0,
}

const colorInputStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
}

const numInputStyle: React.CSSProperties = {
  width: 60,
  background: 'var(--surface-hover)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: '0.8rem',
  padding: '0.3rem 0.4rem',
  boxSizing: 'border-box',
}

const toggleStyle: React.CSSProperties = {
  width: 30,
  height: 28,
  borderRadius: 5,
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: '0.82rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
}
