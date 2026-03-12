/**
 * TableEditor — spreadsheet-style grid editor for TableInput nodes.
 *
 * TBL-01: Full spreadsheet UX — keyboard navigation, cell selection,
 *   type-to-edit, copy/paste (tab/comma-separated), right-click context menus,
 *   column resize, row/col count, non-numeric validation with red cell + tooltip.
 * TBL-02: @tanstack/react-virtual for > 100 rows (renders only visible rows).
 */

import { useState, useRef, useCallback, useEffect, type ChangeEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  MAX_TABLE_INPUT_ROWS,
  MAX_TABLE_INPUT_COLS,
  enforceTableLimits,
} from '../../../lib/tableConstants'
import { parsePastedText } from './parsePastedText'

// ── Constants ─────────────────────────────────────────────────────────────────

const ROW_H = 24
const ROW_NUM_W = 30
const DEFAULT_COL_W = 80
const MIN_COL_W = 40
const MAX_VISIBLE_ROWS = 12 // rows to show before scrolling

// ── Types ──────────────────────────────────────────────────────────────────────

interface CellId {
  row: number
  col: number
}

interface TableEditorProps {
  columns: string[]
  rows: number[][]
  onChange: (columns: string[], rows: number[][]) => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export function TableEditor({ columns, rows, onChange }: TableEditorProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)

  // Selection + edit state
  const [selected, setSelected] = useState<CellId | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editErrors, setEditErrors] = useState<Set<string>>(new Set())
  const editInputRef = useRef<HTMLInputElement>(null)

  // Column widths (px)
  const [colWidths, setColWidths] = useState<number[]>(() =>
    columns.map(() => DEFAULT_COL_W),
  )

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    row: number
    col: number
  } | null>(null)

  // CSV import
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvTruncated, setCsvTruncated] = useState(false)

  // Keep colWidths in sync when columns change
  useEffect(() => {
    setColWidths((prev) => {
      if (prev.length === columns.length) return prev
      const next = [...prev]
      while (next.length < columns.length) next.push(DEFAULT_COL_W)
      return next.slice(0, columns.length)
    })
  }, [columns.length])

  // ── Virtualizer ─────────────────────────────────────────────────────────────

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_H,
    overscan: 5,
  })

  const visibleHeight = Math.min(rows.length, MAX_VISIBLE_ROWS) * ROW_H

  // ── Cell editing ──────────────────────────────────────────────────────────────

  const startEdit = useCallback(
    (row: number, col: number, initial?: string) => {
      setSelected({ row, col })
      setIsEditing(true)
      const v = initial ?? String(rows[row]?.[col] ?? '')
      setEditValue(v)
      requestAnimationFrame(() => editInputRef.current?.select())
    },
    [rows],
  )

  const commitEdit = useCallback(
    (row: number, col: number, raw: string) => {
      const trimmed = raw.trim()
      const n = parseFloat(trimmed)
      if (trimmed === '' || isNaN(n)) {
        const key = `${row}:${col}`
        setEditErrors((prev) => new Set([...prev, key]))
        // Keep old value
      } else {
        setEditErrors((prev) => {
          const next = new Set(prev)
          next.delete(`${row}:${col}`)
          return next
        })
        const nextRows = rows.map((r, ri) =>
          ri === row ? r.map((c, ci) => (ci === col ? n : c)) : r,
        )
        onChange(columns, nextRows)
      }
      setIsEditing(false)
    },
    [rows, columns, onChange],
  )

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
  }, [])

  // ── Keyboard navigation ────────────────────────────────────────────────────

  const moveTo = useCallback(
    (row: number, col: number) => {
      const r = Math.max(0, Math.min(rows.length - 1, row))
      const c = Math.max(0, Math.min(columns.length - 1, col))
      setSelected({ row: r, col: c })
      setIsEditing(false)
    },
    [rows.length, columns.length],
  )

  const handleCellKeyDown = useCallback(
    (e: KeyboardEvent, row: number, col: number) => {
      if (!isEditing) {
        if (e.key === 'Enter' || e.key === 'F2') {
          e.preventDefault()
          startEdit(row, col)
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          const nextRows = rows.map((r, ri) =>
            ri === row ? r.map((c, ci) => (ci === col ? 0 : c)) : r,
          )
          onChange(columns, nextRows)
        } else if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
          e.preventDefault()
          moveTo(row, col + 1 < columns.length ? col + 1 : col)
        } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
          e.preventDefault()
          moveTo(row, col > 0 ? col - 1 : 0)
        } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
          e.preventDefault()
          moveTo(row + 1, col)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          moveTo(row > 0 ? row - 1 : 0, col)
        } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
          // Start editing with typed character
          startEdit(row, col, e.key)
        }
      } else {
        // Editing mode
        if (e.key === 'Enter') {
          e.preventDefault()
          commitEdit(row, col, editValue)
          moveTo(row + 1, col)
        } else if (e.key === 'Tab') {
          e.preventDefault()
          commitEdit(row, col, editValue)
          moveTo(row, e.shiftKey ? col - 1 : col + 1)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancelEdit()
        } else if (e.key === 'ArrowDown' && !e.shiftKey) {
          e.preventDefault()
          commitEdit(row, col, editValue)
          moveTo(row + 1, col)
        } else if (e.key === 'ArrowUp' && !e.shiftKey) {
          e.preventDefault()
          commitEdit(row, col, editValue)
          moveTo(row > 0 ? row - 1 : 0, col)
        }
      }
    },
    [isEditing, editValue, rows, columns, onChange, startEdit, commitEdit, cancelEdit, moveTo],
  )

  // ── Copy/paste ─────────────────────────────────────────────────────────────

  const handlePaste = useCallback(
    (e: React.ClipboardEvent, startRow: number, startCol: number) => {
      const text = e.clipboardData.getData('text')
      if (!text) return
      e.preventDefault()
      const parsed = parsePastedText(text)
      if (parsed.length === 0) return

      const nextRows = rows.map((r) => [...r])
      // Extend rows if needed
      while (nextRows.length < startRow + parsed.length) {
        if (nextRows.length >= MAX_TABLE_INPUT_ROWS) break
        nextRows.push(new Array(columns.length).fill(0))
      }

      for (let ri = 0; ri < parsed.length; ri++) {
        const row = nextRows[startRow + ri]
        if (!row) break
        for (let ci = 0; ci < parsed[ri].length; ci++) {
          const tCol = startCol + ci
          if (tCol >= columns.length) break
          const v = parsed[ri][ci]
          if (v !== null) row[tCol] = v
        }
      }
      const { columns: c, rows: r } = enforceTableLimits(columns, nextRows)
      onChange(c, r)
    },
    [rows, columns, onChange],
  )

  // ── Column operations ──────────────────────────────────────────────────────

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
      if (columns.length <= 1) return
      const nextCols = columns.filter((_, i) => i !== ci)
      const nextRows = rows.map((row) => row.filter((_, i) => i !== ci))
      onChange(nextCols, nextRows)
    },
    [columns, rows, onChange],
  )

  const addCol = useCallback(
    (afterIndex?: number) => {
      if (columns.length >= MAX_TABLE_INPUT_COLS) return
      const insertAt = afterIndex !== undefined ? afterIndex + 1 : columns.length
      const nextCols = [...columns]
      nextCols.splice(insertAt, 0, `Col${columns.length + 1}`)
      const nextRows = rows.map((row) => {
        const r = [...row]
        r.splice(insertAt, 0, 0)
        return r
      })
      onChange(nextCols, nextRows)
    },
    [columns, rows, onChange],
  )

  // ── Row operations ─────────────────────────────────────────────────────────

  const removeRow = useCallback(
    (ri: number) => {
      onChange(columns, rows.filter((_, i) => i !== ri))
    },
    [columns, rows, onChange],
  )

  const addRow = useCallback(() => {
    if (rows.length >= MAX_TABLE_INPUT_ROWS) return
    onChange(columns, [...rows, new Array(columns.length).fill(0)])
  }, [columns, rows, onChange])

  // ── Column resize ──────────────────────────────────────────────────────────

  const resizeDrag = useRef<{ ci: number; startX: number; startW: number } | null>(null)

  const onResizeMouseDown = useCallback((ci: number, e: React.MouseEvent) => {
    e.preventDefault()
    resizeDrag.current = { ci, startX: e.clientX, startW: colWidths[ci] ?? DEFAULT_COL_W }
    const onMove = (me: MouseEvent) => {
      if (!resizeDrag.current) return
      const { ci: c, startX, startW } = resizeDrag.current
      const w = Math.max(MIN_COL_W, startW + (me.clientX - startX))
      setColWidths((prev) => prev.map((cw, i) => (i === c ? w : cw)))
    }
    const onUp = () => {
      resizeDrag.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [colWidths])

  // ── CSV import ─────────────────────────────────────────────────────────────

  const handleCsvImport = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const text = reader.result as string
        const lines = text.split(/\r?\n/).filter((l) => l.trim())
        if (lines.length === 0) return
        // Auto-detect delimiter
        const firstLine = lines[0]
        const delim = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ','
        const header = firstLine.split(delim).map((h) => h.trim().replace(/^"|"$/g, ''))
        const dataRows: number[][] = []
        // Auto-detect header row: if first row is all non-numeric, use as header
        const isHeader = header.every((h) => isNaN(parseFloat(h)))
        const startLine = isHeader ? 1 : 0
        const effectiveHeader = isHeader ? header : header.map((_, i) => `Col${i + 1}`)
        for (let i = startLine; i < lines.length; i++) {
          const cells = lines[i].split(delim).map((c) => {
            const v = parseFloat(c.trim().replace(/^"|"$/g, ''))
            return isNaN(v) ? 0 : v
          })
          while (cells.length < effectiveHeader.length) cells.push(0)
          dataRows.push(cells.slice(0, effectiveHeader.length))
        }
        const { columns: c, rows: r, truncated } = enforceTableLimits(effectiveHeader, dataRows)
        setCsvTruncated(truncated)
        onChange(c, r)
      }
      reader.readAsText(file)
      e.target.value = ''
    },
    [onChange],
  )

  // ── Context menu ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  // ── Total width ────────────────────────────────────────────────────────────

  const totalColW = colWidths.slice(0, columns.length).reduce((a, b) => a + b, 0)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="nodrag"
      style={{ display: 'flex', flexDirection: 'column', gap: 4, userSelect: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Row × Col count */}
      <div style={{ fontSize: '0.6rem', color: 'var(--text-faint)', textAlign: 'right' }}>
        {rows.length} × {columns.length}
      </div>

      {/* Header row */}
      <div
        className="nowheel"
        style={{
          display: 'flex',
          gap: 0,
          overflowX: 'hidden',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: 'var(--surface-1)',
        }}
      >
        <div style={{ width: ROW_NUM_W, flexShrink: 0 }} />
        {columns.map((col, ci) => (
          <div
            key={ci}
            style={{
              width: colWidths[ci] ?? DEFAULT_COL_W,
              flexShrink: 0,
              position: 'relative',
              boxSizing: 'border-box',
              borderRight: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <input
              className="nodrag"
              style={headerCellStyle}
              value={col}
              onChange={(e) => renameCol(ci, e.target.value)}
              title={t('canvas.renameColumn', 'Rename column')}
            />
            {/* Resize handle */}
            <div
              onMouseDown={(e) => onResizeMouseDown(ci, e)}
              style={resizeHandleStyle}
              title="Resize column"
            />
          </div>
        ))}
        <button
          className="nodrag"
          onClick={() => addCol()}
          style={addBtnStyle}
          title={t('canvas.addColumn', 'Add column')}
        >
          +
        </button>
      </div>

      {/* Body — virtualized */}
      <div
        ref={containerRef}
        className="nowheel"
        style={{
          height: visibleHeight || ROW_H,
          overflowY: 'auto',
          overflowX: 'auto',
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 3,
        }}
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: ROW_NUM_W + totalColW + 20,
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((vRow) => {
            const ri = vRow.index
            return (
              <div
                key={ri}
                data-index={ri}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: vRow.start,
                  left: 0,
                  display: 'flex',
                  alignItems: 'center',
                  height: ROW_H,
                  width: '100%',
                }}
              >
                {/* Row number */}
                <div style={rowNumStyle}>{ri + 1}</div>

                {/* Cells */}
                {columns.map((_, ci) => {
                  const cellKey = `${ri}:${ci}`
                  const isSelected = selected?.row === ri && selected?.col === ci
                  const isEditingCell = isSelected && isEditing
                  const hasError = editErrors.has(cellKey)
                  const colW = colWidths[ci] ?? DEFAULT_COL_W

                  return (
                    <div
                      key={ci}
                      style={{
                        width: colW,
                        flexShrink: 0,
                        height: '100%',
                        position: 'relative',
                        boxSizing: 'border-box',
                        border: isSelected
                          ? '1px solid var(--primary)'
                          : hasError
                            ? '1px solid var(--danger-text, #f87171)'
                            : '1px solid rgba(255,255,255,0.06)',
                        background: isSelected
                          ? 'rgba(28,171,176,0.08)'
                          : ri % 2 === 0
                            ? 'rgba(0,0,0,0.2)'
                            : 'rgba(0,0,0,0.12)',
                      }}
                      onClick={() => {
                        setSelected({ row: ri, col: ci })
                        setIsEditing(false)
                      }}
                      onDoubleClick={() => startEdit(ri, ci)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setContextMenu({ x: e.clientX, y: e.clientY, row: ri, col: ci })
                      }}
                      onPaste={(e) => handlePaste(e, ri, ci)}
                      tabIndex={isSelected ? 0 : -1}
                      onKeyDown={(e) => handleCellKeyDown(e, ri, ci)}
                      onFocus={() => setSelected({ row: ri, col: ci })}
                      title={hasError ? t('table.invalidNumber', 'Invalid number') : undefined}
                    >
                      {isEditingCell ? (
                        <input
                          ref={editInputRef}
                          autoFocus
                          className="nodrag"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(ri, ci, editValue)}
                          onKeyDown={(e) => handleCellKeyDown(e, ri, ci)}
                          onPaste={(e) => {
                            // If pasting multi-cell content, defer to cell paste handler
                            const text = e.clipboardData.getData('text')
                            if (text.includes('\t') || text.includes('\n')) {
                              cancelEdit()
                              handlePaste(e, ri, ci)
                            }
                          }}
                          style={editCellStyle}
                        />
                      ) : (
                        <span style={cellTextStyle}>
                          {String(rows[ri]?.[ci] ?? '')}
                        </span>
                      )}
                    </div>
                  )
                })}

                {/* Delete row button */}
                <button
                  className="nodrag"
                  onClick={() => removeRow(ri)}
                  title={t('canvas.removeRow', 'Delete row')}
                  style={deleteRowBtnStyle}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer: add row + CSV import */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button className="nodrag" onClick={addRow} style={addRowBtnStyle}>
          + {t('canvas.addRow', 'Add row')}
        </button>
        <button
          className="nodrag"
          onClick={() => fileRef.current?.click()}
          style={csvBtnStyle}
          title={t('canvas.importCsv', 'Import CSV')}
        >
          CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleCsvImport}
        />
        {rows.length > 0 && (
          <span style={{ fontSize: '0.6rem', color: 'var(--text-faint)', marginLeft: 'auto' }}>
            {t('table.rowCount', '{{count}} rows', { count: rows.length })}
          </span>
        )}
      </div>

      {/* Warnings */}
      {(csvTruncated || rows.length >= MAX_TABLE_INPUT_ROWS || columns.length >= MAX_TABLE_INPUT_COLS) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {csvTruncated && (
            <div style={warningStyle}>
              <span>
                {t('table.csvTruncated', 'CSV truncated to {{cols}} cols × {{rows}} rows', {
                  cols: MAX_TABLE_INPUT_COLS,
                  rows: MAX_TABLE_INPUT_ROWS.toLocaleString(),
                })}
              </span>
              <button
                className="nodrag"
                onClick={() => setCsvTruncated(false)}
                style={{ background: 'none', border: 'none', color: 'var(--warning)', cursor: 'pointer', fontSize: '0.6rem' }}
              >
                ✕
              </button>
            </div>
          )}
          {rows.length >= MAX_TABLE_INPUT_ROWS && (
            <span style={{ fontSize: '0.62rem', color: 'var(--warning)' }}>
              {t('table.rowLimitReached', 'Row limit reached ({{max}})', { max: MAX_TABLE_INPUT_ROWS.toLocaleString() })}
            </span>
          )}
          {columns.length >= MAX_TABLE_INPUT_COLS && (
            <span style={{ fontSize: '0.62rem', color: 'var(--warning)' }}>
              {t('table.colLimitReached', 'Column limit reached ({{max}})', { max: MAX_TABLE_INPUT_COLS })}
            </span>
          )}
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 0',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            minWidth: 160,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {[
            { label: t('canvas.addRow', 'Add row below'), action: () => { addRow(); setContextMenu(null) } },
            { label: t('canvas.removeRow', 'Delete row'), action: () => { removeRow(contextMenu.row); setContextMenu(null) } },
            null,
            { label: t('canvas.addColumnRight', 'Add column right'), action: () => { addCol(contextMenu.col); setContextMenu(null) } },
            { label: columns.length > 1 ? t('canvas.removeColumn', 'Delete column') : t('canvas.removeColumn', 'Delete column') + ' (last)', action: () => { if (columns.length > 1) { removeCol(contextMenu.col); setContextMenu(null) } } },
          ].map((item, i) =>
            item === null ? (
              <div key={i} style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
            ) : (
              <button
                key={i}
                onClick={item.action}
                style={contextMenuItemStyle}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const headerCellStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(28,171,176,0.08)',
  border: 'none',
  borderRight: '1px solid rgba(255,255,255,0.07)',
  color: 'rgba(244,244,243,0.7)',
  fontFamily: "'Montserrat', system-ui, sans-serif",
  fontWeight: 600,
  fontSize: '0.62rem',
  padding: '3px 6px',
  outline: 'none',
  boxSizing: 'border-box',
  height: ROW_H,
}

const resizeHandleStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: 5,
  cursor: 'col-resize',
  zIndex: 1,
}

const addBtnStyle: React.CSSProperties = {
  width: 22,
  height: ROW_H,
  padding: 0,
  background: 'rgba(28,171,176,0.12)',
  border: '1px solid rgba(28,171,176,0.2)',
  borderRadius: 3,
  color: 'var(--primary)',
  cursor: 'pointer',
  fontSize: '0.65rem',
  flexShrink: 0,
}

const rowNumStyle: React.CSSProperties = {
  width: ROW_NUM_W,
  flexShrink: 0,
  fontSize: '0.55rem',
  color: 'rgba(244,244,243,0.2)',
  textAlign: 'right',
  paddingRight: 4,
  fontFamily: "'JetBrains Mono', monospace",
}

const cellTextStyle: React.CSSProperties = {
  display: 'block',
  padding: '0 4px',
  fontSize: '0.65rem',
  fontFamily: "'JetBrains Mono', monospace",
  color: 'var(--text)',
  lineHeight: `${ROW_H}px`,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const editCellStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  background: 'rgba(28,171,176,0.15)',
  border: 'none',
  outline: 'none',
  color: 'var(--text)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '0.65rem',
  padding: '0 4px',
  boxSizing: 'border-box',
}

const deleteRowBtnStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  padding: 0,
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 3,
  color: 'rgba(244,244,243,0.25)',
  cursor: 'pointer',
  fontSize: '0.5rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  marginLeft: 2,
}

const addRowBtnStyle: React.CSSProperties = {
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

const csvBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  background: 'rgba(168,85,247,0.12)',
  border: '1px solid rgba(168,85,247,0.25)',
  borderRadius: 4,
  color: '#c084fc',
  cursor: 'pointer',
  fontSize: '0.68rem',
  fontWeight: 600,
  fontFamily: 'inherit',
}

const warningStyle: React.CSSProperties = {
  fontSize: '0.62rem',
  color: 'var(--warning)',
  background: 'rgba(245,158,11,0.08)',
  border: '1px solid rgba(245,158,11,0.2)',
  borderRadius: 3,
  padding: '2px 6px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const contextMenuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '5px 12px',
  background: 'none',
  border: 'none',
  color: 'var(--text)',
  fontSize: '0.78rem',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
