/**
 * TableEditor — spreadsheet-style grid editor for TableInput nodes.
 *
 * Features:
 * - Editable column headers
 * - Add/remove columns and rows
 * - CSS-based virtual scroll for 10k+ rows
 * - className="nodrag" on all interactive elements
 */

import { useState, useRef, useCallback } from 'react'

const ROW_H = 26
const MAX_VISIBLE_H = 200
const OVERSCAN = 10
const COL_W = 68

interface TableEditorProps {
  columns: string[]
  rows: number[][]
  onChange: (columns: string[], rows: number[][]) => void
}

export function TableEditor({ columns, rows, onChange }: TableEditorProps) {
  const [scrollTop, setScrollTop] = useState(0)
  const bodyRef = useRef<HTMLDivElement>(null)

  const totalH = rows.length * ROW_H
  const visibleH = Math.min(totalH, MAX_VISIBLE_H)
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const endIdx = Math.min(rows.length, Math.ceil((scrollTop + visibleH) / ROW_H) + OVERSCAN)

  const onScroll = useCallback(() => {
    if (bodyRef.current) setScrollTop(bodyRef.current.scrollTop)
  }, [])

  const renameCol = useCallback(
    (ci: number, name: string) => {
      const next = [...columns]
      next[ci] = name
      onChange(next, rows)
    },
    [columns, rows, onChange],
  )

  const removeCol = useCallback(
    (ci: number) => {
      const nextCols = columns.filter((_, i) => i !== ci)
      const nextRows = rows.map((row) => row.filter((_, i) => i !== ci))
      onChange(nextCols, nextRows)
    },
    [columns, rows, onChange],
  )

  const addCol = useCallback(() => {
    const nextCols = [...columns, `Col${columns.length + 1}`]
    const nextRows = rows.map((row) => [...row, 0])
    onChange(nextCols, nextRows)
  }, [columns, rows, onChange])

  const updateCell = useCallback(
    (ri: number, ci: number, v: number) => {
      const nextRows = rows.map((row, i) =>
        i === ri ? row.map((c, j) => (j === ci ? v : c)) : row,
      )
      onChange(columns, nextRows)
    },
    [columns, rows, onChange],
  )

  const removeRow = useCallback(
    (ri: number) => {
      onChange(
        columns,
        rows.filter((_, i) => i !== ri),
      )
    },
    [columns, rows, onChange],
  )

  const addRow = useCallback(() => {
    onChange(columns, [...rows, new Array(columns.length).fill(0)])
  }, [columns, rows, onChange])

  const cellStyle: React.CSSProperties = {
    width: COL_W,
    flexShrink: 0,
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#F4F4F3',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.65rem',
    padding: '2px 4px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const headerCell: React.CSSProperties = {
    ...cellStyle,
    fontFamily: "'Montserrat', system-ui, sans-serif",
    fontWeight: 600,
    fontSize: '0.62rem',
    color: 'rgba(244,244,243,0.6)',
    background: 'rgba(28,171,176,0.08)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Header */}
      <div
        className="nodrag nowheel"
        style={{ display: 'flex', gap: 1, overflowX: 'auto', paddingBottom: 2 }}
      >
        <div style={{ width: 22, flexShrink: 0 }} />
        {columns.map((col, ci) => (
          <div key={ci} style={{ position: 'relative' }}>
            <input
              className="nodrag"
              style={headerCell}
              value={col}
              onChange={(e) => renameCol(ci, e.target.value)}
            />
            {columns.length > 1 && (
              <button
                className="nodrag"
                onClick={() => removeCol(ci)}
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 12,
                  height: 12,
                  padding: 0,
                  background: '#555',
                  border: 'none',
                  borderRadius: '50%',
                  color: '#F4F4F3',
                  cursor: 'pointer',
                  fontSize: '0.5rem',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Remove column"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          className="nodrag"
          onClick={addCol}
          style={{
            width: 22,
            height: 22,
            padding: 0,
            background: 'rgba(28,171,176,0.12)',
            border: '1px solid rgba(28,171,176,0.2)',
            borderRadius: 3,
            color: '#1CABB0',
            cursor: 'pointer',
            fontSize: '0.65rem',
            flexShrink: 0,
          }}
          title="Add column"
        >
          +
        </button>
      </div>

      {/* Body with virtual scroll */}
      <div
        ref={bodyRef}
        onScroll={onScroll}
        className="nodrag nowheel"
        style={{
          height: visibleH || ROW_H,
          overflowY: 'auto',
          overflowX: 'auto',
          position: 'relative',
        }}
      >
        <div style={{ height: totalH, position: 'relative' }}>
          {Array.from({ length: endIdx - startIdx }, (_, k) => {
            const ri = startIdx + k
            return (
              <div
                key={ri}
                style={{
                  position: 'absolute',
                  top: ri * ROW_H,
                  left: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  height: ROW_H,
                }}
              >
                <span
                  style={{
                    width: 22,
                    flexShrink: 0,
                    fontSize: '0.55rem',
                    color: 'rgba(244,244,243,0.25)',
                    textAlign: 'right',
                    fontFamily: "'JetBrains Mono', monospace",
                    paddingRight: 2,
                  }}
                >
                  {ri}
                </span>
                {columns.map((_, ci) => (
                  <input
                    key={ci}
                    type="number"
                    className="nodrag"
                    step="any"
                    value={rows[ri]?.[ci] ?? 0}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      if (!isNaN(v)) updateCell(ri, ci, v)
                    }}
                    style={cellStyle}
                  />
                ))}
                <button
                  className="nodrag"
                  onClick={() => removeRow(ri)}
                  title="Remove row"
                  style={{
                    width: 16,
                    height: 16,
                    padding: 0,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 3,
                    color: 'rgba(244,244,243,0.25)',
                    cursor: 'pointer',
                    fontSize: '0.5rem',
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

      {/* Add row */}
      <button
        className="nodrag"
        onClick={addRow}
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
        + Add row
      </button>
    </div>
  )
}
