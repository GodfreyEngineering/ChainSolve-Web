/**
 * VectorEditor — inline list editor for List Input nodes.
 *
 * Features:
 * - Scrollable list of number inputs with add/remove
 * - Paste from Excel/CSV/web with smart parsing (H2-1)
 * - Clear/reset button
 * - CSS-based virtual scroll for 10k+ items
 * - className="nodrag" on all interactive elements
 */

import { useState, useRef, useCallback, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { parsePastedText } from './parsePastedText'

const ROW_H = 28
const MAX_VISIBLE_H = 200
const OVERSCAN = 10

interface VectorEditorProps {
  values: number[]
  onChange: (values: number[]) => void
}

/**
 * Parse a pasted string into an array of numbers.
 * Handles: newline-separated, comma-separated, tab-separated,
 * mixed whitespace, Excel columns, and JSON arrays.
 */
export function VectorEditor({ values, onChange }: VectorEditorProps) {
  const { t } = useTranslation()
  const [scrollTop, setScrollTop] = useState(0)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // 2.09: Per-cell raw-string editing state — only commit on blur/Enter.
  // Stores { index, raw } for the cell currently being edited.
  const [editingCell, setEditingCell] = useState<{ index: number; raw: string } | null>(null)

  const totalH = values.length * ROW_H
  const visibleH = Math.min(totalH, MAX_VISIBLE_H)
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const endIdx = Math.min(values.length, Math.ceil((scrollTop + visibleH) / ROW_H) + OVERSCAN)

  const onScroll = useCallback(() => {
    if (containerRef.current) setScrollTop(containerRef.current.scrollTop)
  }, [])

  const updateAt = useCallback(
    (i: number, v: number) => {
      const next = [...values]
      next[i] = v
      onChange(next)
    },
    [values, onChange],
  )

  const commitCell = useCallback(
    (index: number, raw: string) => {
      const v = parseFloat(raw)
      if (!isNaN(v)) {
        updateAt(index, v)
      } else if (raw.trim() === '' || raw === '-') {
        updateAt(index, 0)
      }
      setEditingCell(null)
    },
    [updateAt],
  )

  const handleCellKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, index: number, raw: string) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitCell(index, raw)
        ;(e.target as HTMLInputElement).blur()
      } else if (e.key === 'Escape') {
        setEditingCell(null)
        ;(e.target as HTMLInputElement).blur()
      }
    },
    [commitCell],
  )

  const removeAt = useCallback(
    (i: number) => {
      const next = values.filter((_, idx) => idx !== i)
      onChange(next)
    },
    [values, onChange],
  )

  const addItem = useCallback(() => {
    onChange([...values, 0])
  }, [values, onChange])

  const clearAll = useCallback(() => {
    onChange([])
  }, [onChange])

  const applyPaste = useCallback(() => {
    const result = parsePastedText(pasteText)
    if (result.values.length === 0 && result.errors > 0) {
      setPasteError(t('listEditor.pasteNoValid'))
      return
    }
    onChange(result.values)
    setPasteMode(false)
    setPasteText('')
    setPasteError('')
  }, [pasteText, onChange, t])

  // Paste mode: show a textarea for bulk input
  if (pasteMode) {
    return (
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <textarea
          className="nodrag nowheel"
          autoFocus
          placeholder={t('listEditor.pastePlaceholder')}
          value={pasteText}
          onChange={(e) => {
            setPasteText(e.target.value)
            setPasteError('')
          }}
          style={{
            width: '100%',
            height: 100,
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4,
            color: 'var(--text)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.68rem',
            padding: '4px 6px',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        {pasteError && (
          <span style={{ fontSize: '0.6rem', color: 'var(--danger-text)' }}>{pasteError}</span>
        )}
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="nodrag" onClick={applyPaste} style={actionBtnStyle}>
            {t('listEditor.apply')}
          </button>
          <button
            className="nodrag"
            onClick={() => {
              setPasteMode(false)
              setPasteText('')
              setPasteError('')
            }}
            style={{ ...actionBtnStyle, background: 'transparent', color: 'rgba(244,244,243,0.5)' }}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="nodrag nowheel"
        style={{
          height: visibleH || 28,
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        <div style={{ height: totalH, position: 'relative' }}>
          {Array.from({ length: endIdx - startIdx }, (_, k) => {
            const i = startIdx + k
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: i * ROW_H,
                  left: 0,
                  right: 0,
                  height: ROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '0 4px',
                }}
              >
                <span style={idxStyle}>{i}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="nodrag"
                  value={editingCell?.index === i ? editingCell.raw : String(values[i])}
                  onChange={(e) => setEditingCell({ index: i, raw: e.target.value })}
                  onFocus={() => setEditingCell({ index: i, raw: String(values[i]) })}
                  onBlur={() => {
                    if (editingCell?.index === i) commitCell(i, editingCell.raw)
                  }}
                  onKeyDown={(e) => {
                    if (editingCell?.index === i) handleCellKeyDown(e, i, editingCell.raw)
                  }}
                  style={inputStyle}
                />
                <button
                  className="nodrag"
                  onClick={() => removeAt(i)}
                  title={t('listEditor.removeItem')}
                  style={removeBtnStyle}
                >
                  x
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <button className="nodrag" onClick={addItem} style={actionBtnStyle}>
          + {t('listEditor.addItem')}
        </button>
        <button
          className="nodrag"
          onClick={() => setPasteMode(true)}
          style={{
            ...actionBtnStyle,
            background: 'rgba(147,197,253,0.1)',
            borderColor: 'rgba(147,197,253,0.25)',
            color: '#93c5fd',
          }}
        >
          {t('listEditor.paste')}
        </button>
        {values.length > 0 && (
          <button
            className="nodrag"
            onClick={clearAll}
            style={{
              ...actionBtnStyle,
              background: 'transparent',
              borderColor: 'rgba(248,113,113,0.2)',
              color: 'var(--danger-text)',
            }}
          >
            {t('listEditor.clear')}
          </button>
        )}
      </div>
    </div>
  )
}

const idxStyle: React.CSSProperties = {
  fontSize: '0.6rem',
  color: 'rgba(244,244,243,0.3)',
  width: 22,
  textAlign: 'right',
  flexShrink: 0,
  fontFamily: "'JetBrains Mono', monospace",
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 3,
  color: 'var(--text)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.7rem',
  padding: '2px 4px',
  outline: 'none',
  minWidth: 0,
}

const removeBtnStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  padding: 0,
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 3,
  color: 'rgba(244,244,243,0.35)',
  cursor: 'pointer',
  fontSize: '0.6rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const actionBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  background: 'rgba(28,171,176,0.12)',
  border: '1px solid rgba(28,171,176,0.25)',
  borderRadius: 4,
  color: 'var(--primary)',
  cursor: 'pointer',
  fontSize: '0.68rem',
  fontWeight: 600,
  fontFamily: 'inherit',
}
