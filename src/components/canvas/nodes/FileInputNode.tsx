/**
 * FileInputNode — 2.9: File drag-and-drop input block.
 *
 * Accepts files via drag-and-drop or file picker and parses them into a
 * tableData structure (same as tableInput) for the Rust engine.
 *
 * Supported formats:
 *   - CSV (comma-delimited, auto-detects header)
 *   - TSV (tab-delimited)
 *   - JSON (array of arrays or array of objects)
 *   - Plain text (whitespace-delimited numbers)
 *
 * Bridge maps blockType='fileInput' → 'tableInput' so the engine treats it
 * like a table input and produces per-column vector outputs.
 */

import { memo, useCallback, useRef, useState } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TableData {
  columns: string[]
  rows: number[][]
}

interface FileInputNodeData extends NodeData {
  tableData: TableData
  fileName?: string
  fileSize?: number
  hasHeader?: boolean
}

// ── File parsers ──────────────────────────────────────────────────────────────

function detectDelimiter(line: string): string {
  const tabs = (line.match(/\t/g) ?? []).length
  const commas = (line.match(/,/g) ?? []).length
  const semis = (line.match(/;/g) ?? []).length
  if (tabs > commas && tabs > semis) return '\t'
  if (semis > commas) return ';'
  return ','
}

function parseCsv(text: string, hasHeader: boolean): TableData {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
  if (lines.length === 0) return { columns: [], rows: [] }

  const delim = detectDelimiter(lines[0])
  const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, '')

  let columns: string[]
  let dataLines: string[]

  if (hasHeader) {
    columns = lines[0].split(delim).map(unquote)
    dataLines = lines.slice(1)
  } else {
    const firstRow = lines[0].split(delim)
    columns = firstRow.map((_, i) => `Col${i + 1}`)
    dataLines = lines
  }

  const rows: number[][] = []
  for (const line of dataLines) {
    const cells = line.split(delim).map((c) => {
      const n = parseFloat(unquote(c))
      return isNaN(n) ? 0 : n
    })
    if (cells.length > 0) rows.push(cells)
  }

  return { columns, rows }
}

function parseJson(text: string): TableData {
  const parsed: unknown = JSON.parse(text)

  // Array of arrays [[1,2],[3,4]]
  if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
    const ncols = Math.max(...(parsed as number[][]).map((r) => r.length))
    const columns = Array.from({ length: ncols }, (_, i) => `Col${i + 1}`)
    const rows = (parsed as number[][]).map((row) =>
      Array.from({ length: ncols }, (_, i) => {
        const v = row[i]
        return typeof v === 'number' ? v : 0
      }),
    )
    return { columns, rows }
  }

  // Array of objects [{a:1,b:2},{a:3,b:4}]
  if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
    const keys = Object.keys(parsed[0] as Record<string, unknown>)
    const rows = (parsed as Record<string, unknown>[]).map((obj) =>
      keys.map((k) => {
        const v = obj[k]
        return typeof v === 'number' ? v : parseFloat(String(v)) || 0
      }),
    )
    return { columns: keys, rows }
  }

  // Single flat array [1,2,3,4]
  if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'number')) {
    return { columns: ['Value'], rows: (parsed as number[]).map((v) => [v]) }
  }

  return { columns: [], rows: [] }
}

function parsePlainText(text: string): TableData {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
  if (lines.length === 0) return { columns: [], rows: [] }

  const rows = lines.map((line) =>
    line
      .trim()
      .split(/\s+/)
      .map((v) => parseFloat(v) || 0),
  )
  const ncols = Math.max(...rows.map((r) => r.length))
  const columns = Array.from({ length: ncols }, (_, i) => `Col${i + 1}`)

  return { columns, rows }
}

async function parseFile(file: File, hasHeader: boolean): Promise<TableData> {
  const text = await file.text()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'json') return parseJson(text)
  if (ext === 'tsv') return parseCsv(text, hasHeader)
  if (ext === 'csv' || ext === 'txt') return parseCsv(text, hasHeader)

  // Try CSV first, then plain text
  try {
    return parseCsv(text, hasHeader)
  } catch {
    return parsePlainText(text)
  }
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

// ── Preview ───────────────────────────────────────────────────────────────────

const PREVIEW_ROWS = 4
const PREVIEW_COLS = 4

function TablePreview({ columns, rows }: { columns: string[]; rows: number[][] }) {
  const pc = columns.slice(0, PREVIEW_COLS)
  const pr = rows.slice(0, PREVIEW_ROWS)
  const moreC = columns.length > PREVIEW_COLS
  const moreR = rows.length > PREVIEW_ROWS

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: '0.58rem',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <thead>
          <tr>
            {pc.map((col, ci) => (
              <th
                key={ci}
                style={{
                  padding: '1px 5px',
                  background: 'rgba(28,171,176,0.1)',
                  color: 'rgba(244,244,243,0.7)',
                  fontWeight: 600,
                  textAlign: 'right',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  whiteSpace: 'nowrap',
                  maxWidth: 60,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {col}
              </th>
            ))}
            {moreC && (
              <th
                style={{
                  padding: '1px 4px',
                  color: 'rgba(244,244,243,0.3)',
                  fontSize: '0.52rem',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                +{columns.length - PREVIEW_COLS}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {pr.map((row, ri) => (
            <tr key={ri}>
              {pc.map((_, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: '1px 5px',
                    color: 'var(--text)',
                    textAlign: 'right',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row[ci] ?? ''}
                </td>
              ))}
              {moreC && (
                <td
                  style={{
                    padding: '1px 4px',
                    color: 'rgba(244,244,243,0.2)',
                    textAlign: 'center',
                  }}
                >
                  …
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {moreR && (
        <div
          style={{
            fontSize: '0.52rem',
            color: 'rgba(244,244,243,0.3)',
            textAlign: 'center',
            padding: '1px 0',
          }}
        >
          +{rows.length - PREVIEW_ROWS} more row{rows.length - PREVIEW_ROWS !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

function FileInputNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as FileInputNodeData
  const { updateNodeData } = useReactFlow()

  const tableData: TableData = (nd.tableData as TableData | undefined) ?? { columns: [], rows: [] }
  const hasHeader = nd.hasHeader ?? true
  const fileName = nd.fileName ?? ''
  const fileSize = nd.fileSize ?? 0

  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const hasData = tableData.columns.length > 0 && tableData.rows.length > 0

  const loadFile = useCallback(
    async (file: File) => {
      setLoading(true)
      setError('')
      try {
        const parsed = await parseFile(file, hasHeader)
        if (parsed.columns.length === 0) {
          setError(t('fileInput.parseError', 'Could not parse file'))
        } else {
          updateNodeData(id, {
            tableData: parsed,
            fileName: file.name,
            fileSize: file.size,
          })
        }
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    },
    [id, hasHeader, t, updateNodeData],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setIsDragging(false), [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) void loadFile(file)
    },
    [loadFile],
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void loadFile(file)
      // Reset input so same file can be re-loaded
      e.target.value = ''
    },
    [loadFile],
  )

  const clearFile = useCallback(() => {
    updateNodeData(id, { tableData: { columns: [], rows: [] }, fileName: '', fileSize: 0 })
    setError('')
  }, [id, updateNodeData])

  return (
    <div
      style={{
        ...s.node,
        minWidth: 220,
        maxWidth: 320,
        ...(selected ? { ...s.nodeSelected, borderColor: typeColor } : {}),
      }}
      role="group"
      aria-label={nd.label}
    >
      {/* Header */}
      <div
        style={{
          ...s.header,
          borderBottom: `2px solid color-mix(in srgb, ${typeColor} 30%, transparent)`,
        }}
      >
        <div className="cs-node-header-left" style={s.headerLeft}>
          <Icon icon={TypeIcon} size={14} style={{ ...s.headerIcon, color: typeColor }} />
          <span style={s.headerLabel}>{nd.label}</span>
        </div>
        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>
          {hasData
            ? `${tableData.rows.length.toLocaleString()} × ${tableData.columns.length}`
            : t('fileInput.empty', 'No file')}
        </span>
      </div>

      <div className="cs-node-body" style={{ ...s.body, padding: '0.4rem 0.5rem' }}>
        {!hasData ? (
          /* Drop zone */
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className="nodrag"
            style={{
              border: `2px dashed ${isDragging ? typeColor : 'var(--border)'}`,
              borderRadius: 6,
              padding: '14px 10px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragging ? `${typeColor}10` : 'transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ fontSize: '0.65rem', color: isDragging ? typeColor : 'var(--muted)' }}>
              {loading
                ? t('fileInput.loading', 'Parsing…')
                : t('fileInput.drop', 'Drop file or click to browse')}
            </div>
            <div style={{ fontSize: '0.58rem', color: 'var(--muted)', marginTop: 2, opacity: 0.6 }}>
              CSV · TSV · JSON · TXT
            </div>
            {error && (
              <div style={{ fontSize: '0.6rem', color: '#ef4444', marginTop: 4 }}>{error}</div>
            )}
          </div>
        ) : (
          /* Loaded state */
          <div>
            {/* File info bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 4,
                fontSize: '0.6rem',
              }}
            >
              <span
                style={{
                  flex: 1,
                  color: typeColor,
                  fontFamily: "'JetBrains Mono', monospace",
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={fileName}
              >
                {fileName || t('fileInput.loaded', 'Data loaded')}
              </span>
              {fileSize > 0 && (
                <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{fmtBytes(fileSize)}</span>
              )}
              <button
                onClick={clearFile}
                className="nodrag"
                title={t('fileInput.clear', 'Clear')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: '0 2px',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            {/* Table preview */}
            <TablePreview columns={tableData.columns} rows={tableData.rows} />

            {/* Re-load button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="nodrag"
              style={{
                width: '100%',
                marginTop: 4,
                padding: '2px 0',
                background: 'rgba(28,171,176,0.08)',
                border: '1px solid rgba(28,171,176,0.2)',
                borderRadius: 4,
                color: 'var(--primary)',
                cursor: 'pointer',
                fontSize: '0.6rem',
                fontFamily: 'inherit',
              }}
            >
              {t('fileInput.reload', 'Load different file')}
            </button>
          </div>
        )}

        {/* hasHeader toggle */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
            fontSize: '0.6rem',
            color: 'var(--muted)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={hasHeader}
            onChange={(e) => updateNodeData(id, { hasHeader: e.target.checked })}
            className="nodrag"
            style={{ width: 10, height: 10 }}
          />
          {t('fileInput.hasHeader', 'First row is header')}
        </label>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt,.json"
          onChange={onFileChange}
          className="nodrag"
          style={{ display: 'none' }}
        />
      </div>

      {/* Output handles: one per column (matching tableInput behavior) */}
      {hasData ? (
        tableData.columns.map((col, ci) => (
          <Handle
            key={`col_${ci}`}
            type="source"
            position={Position.Right}
            id={`col_${ci}`}
            style={{
              ...s.handleRight,
              top: `${((ci + 1) / (tableData.columns.length + 1)) * 100}%`,
            }}
            title={col}
          />
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={{ ...s.handleRight, top: '50%', transform: 'translateY(-50%)' }}
        />
      )}
    </div>
  )
}

export const FileInputNode = memo(FileInputNodeInner)
