/**
 * VectorEditor — inline array editor for VectorInput nodes.
 *
 * Features:
 * - Scrollable list of number inputs with add/remove
 * - CSS-based virtual scroll for 10k+ items
 * - className="nodrag" on all interactive elements
 */

import { useState, useRef, useCallback } from 'react'

const ROW_H = 28
const MAX_VISIBLE_H = 200
const OVERSCAN = 10

interface VectorEditorProps {
  values: number[]
  onChange: (values: number[]) => void
}

export function VectorEditor({ values, onChange }: VectorEditorProps) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

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
                <span
                  style={{
                    fontSize: '0.6rem',
                    color: 'rgba(244,244,243,0.3)',
                    width: 22,
                    textAlign: 'right',
                    flexShrink: 0,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {i}
                </span>
                <input
                  type="number"
                  className="nodrag"
                  step="any"
                  value={values[i]}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v)) updateAt(i, v)
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 3,
                    color: '#F4F4F3',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.7rem',
                    padding: '2px 4px',
                    outline: 'none',
                    minWidth: 0,
                  }}
                />
                <button
                  className="nodrag"
                  onClick={() => removeAt(i)}
                  title="Remove"
                  style={{
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
                  }}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <button
        className="nodrag"
        onClick={addItem}
        style={{
          padding: '3px 8px',
          background: 'rgba(28,171,176,0.12)',
          border: '1px solid rgba(28,171,176,0.25)',
          borderRadius: 4,
          color: '#1CABB0',
          cursor: 'pointer',
          fontSize: '0.68rem',
          fontWeight: 600,
          fontFamily: 'inherit',
        }}
      >
        + Add item
      </button>
    </div>
  )
}
