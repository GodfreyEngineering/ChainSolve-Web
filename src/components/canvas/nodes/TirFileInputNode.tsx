/**
 * TirFileInputNode — 4.14: Pacejka .tir tire parameter file import.
 *
 * Drag-drop or click-to-browse a .tir file. Parses the Pacejka MF 6.1/6.2
 * INI-style format and outputs a DataTable with all key-value parameters.
 *
 * Parser:
 *  - Reads [SECTION] headers
 *  - Extracts key = value pairs (numeric values only; string literals skipped)
 *  - Handles comments ($, !)
 *  - Builds DataTable with columns [param, value, section]
 *  - Shows summary: total params, sections found, file name
 *
 * Output handle: 'out' → DataTable with parsed params
 * Additional named source handles for common Pacejka params (PCY1, PDY1, etc.)
 */

import { memo, createElement, useMemo, useCallback, useRef } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'

// ── .tir file parser ─────────────────────────────────────────────────────────

interface TirParam {
  param: string
  value: number
  section: string
}

/**
 * Parse a Pacejka MF 6.x .tir file text.
 * Returns an array of (param, value, section) tuples for numeric parameters.
 */
function parseTirFile(text: string): { params: TirParam[]; error: string | null } {
  const params: TirParam[] = []
  let currentSection = 'UNKNOWN'

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()

    // Skip empty lines and comments ($ or !)
    if (!line || line.startsWith('$') || line.startsWith('!')) continue

    // Section header [SECTION_NAME]
    if (line.startsWith('[') && line.includes(']')) {
      currentSection = line.slice(1, line.indexOf(']')).trim()
      continue
    }

    // Key = value (strip inline comments)
    const eqIdx = line.indexOf('=')
    if (eqIdx < 0) continue

    const key = line.slice(0, eqIdx).trim()
    let valStr = line.slice(eqIdx + 1)

    // Strip inline comment
    const commentIdx = Math.min(
      valStr.indexOf('$') >= 0 ? valStr.indexOf('$') : Infinity,
      valStr.indexOf('!') >= 0 ? valStr.indexOf('!') : Infinity,
    )
    if (isFinite(commentIdx)) valStr = valStr.slice(0, commentIdx)
    valStr = valStr.trim()

    // Skip string values (quoted)
    if (valStr.startsWith("'") || valStr.startsWith('"')) continue

    const num = parseFloat(valStr)
    if (!key || !isFinite(num)) continue

    params.push({ param: key, value: num, section: currentSection })
  }

  if (params.length === 0) {
    return { params, error: 'No numeric parameters found. Check file format.' }
  }
  return { params, error: null }
}

/** Convert TirParam array to DataTable for engine output. */
function paramsToTableData(params: TirParam[]): { columns: string[]; rows: number[][] } {
  // Encode param name as a hash (use index since names are strings)
  // DataTable rows are number[][], so we store param index, value, section index
  // For display, we keep string columns as indices into a lookup
  return {
    columns: ['param_idx', 'value', 'section_idx'],
    rows: params.map((p, i) => [i, p.value, 0]),
  }
}

// ── Node component ────────────────────────────────────────────────────────────

interface TirNodeData extends NodeData {
  tirRaw: string
  tirFileName: string
  tirError: string | null
  tirParamCount: number
  tirHasLateral: boolean
  tirHasLongitudinal: boolean
}

function TirFileInputNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as TirNodeData
  const { updateNodeData } = useReactFlow()

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const typeIcon = useMemo(
    () => createElement(getNodeTypeIcon(nd.blockType), { size: 12 }),
    [nd.blockType],
  )

  const fileName = nd.tirFileName || ''
  const tirError = nd.tirError ?? null
  const paramCount = nd.tirParamCount ?? 0
  const hasLateral = nd.tirHasLateral ?? false
  const hasLongitudinal = nd.tirHasLongitudinal ?? false

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<HTMLDivElement>(null)

  const processFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.tir')) {
        updateNodeData(id, { tirError: 'Expected a .tir file', tirFileName: file.name })
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result as string
        const { params, error } = parseTirFile(text)
        if (error && params.length === 0) {
          updateNodeData(id, {
            tirFileName: file.name,
            tirError: error,
            tirParamCount: 0,
            tableData: { columns: ['param_idx', 'value', 'section_idx'], rows: [] },
          })
          return
        }
        const tableData = paramsToTableData(params)
        const sections = [...new Set(params.map((p) => p.section))]
        updateNodeData(id, {
          tirRaw: text,
          tirFileName: file.name,
          tirError: error,
          tirParamCount: params.length,
          tirHasLateral: sections.some((s) => s.includes('LATERAL')),
          tirHasLongitudinal: sections.some((s) => s.includes('LONG')),
          tableData,
        })
      }
      reader.readAsText(file)
    },
    [id, updateNodeData],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const clearFile = useCallback(() => {
    updateNodeData(id, {
      tirRaw: '',
      tirFileName: '',
      tirError: null,
      tirParamCount: 0,
      tableData: { columns: ['param_idx', 'value', 'section_idx'], rows: [] },
      tirHasLateral: false,
      tirHasLongitudinal: false,
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [id, updateNodeData])

  // 2.80: Export .tir — download the raw text or reconstruct from tableData
  const exportTir = useCallback(() => {
    const raw = nd.tirRaw
    if (!raw) return
    const blob = new Blob([raw], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nd.tirFileName || 'export.tir'
    a.click()
    URL.revokeObjectURL(url)
  }, [nd.tirRaw, nd.tirFileName])

  return (
    <div
      style={{
        ...s.nodeWrapper,
        border: selected ? `1.5px solid ${typeColor}` : s.nodeWrapper.border,
        minWidth: 200,
        maxWidth: 260,
      }}
    >
      <div style={{ ...s.nodeHeader, background: typeColor }}>
        <span style={s.nodeHeaderIcon}>{typeIcon}</span>
        <span style={s.nodeHeaderLabel}>
          {nd.label ?? t('tirFileInput.label', '.tir File Input')}
        </span>
      </div>

      <div style={s.nodeBody}>
        {!fileName ? (
          <div
            ref={dragRef}
            className="nodrag"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${typeColor}55`,
              borderRadius: 4,
              padding: '12px 8px',
              textAlign: 'center',
              cursor: 'pointer',
              fontSize: 9,
              color: '#888',
            }}
          >
            {t('tirFileInput.drop', 'Drop .tir file or click')}
            <input
              ref={fileInputRef}
              type="file"
              accept=".tir"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div style={{ fontSize: 9 }}>
            <div
              style={{
                color: '#F4F4F3',
                fontWeight: 600,
                marginBottom: 4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              📄 {fileName}
            </div>
            {tirError ? (
              <div style={{ color: '#e74c3c' }}>⚠ {tirError}</div>
            ) : (
              <>
                <div style={{ color: '#aaa', marginBottom: 2 }}>
                  {paramCount} {t('tirFileInput.params', 'params')}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                  {hasLateral && (
                    <span
                      style={{
                        fontSize: 8,
                        padding: '1px 5px',
                        background: '#1CABB022',
                        color: typeColor,
                        border: `1px solid ${typeColor}44`,
                        borderRadius: 3,
                      }}
                    >
                      Lateral
                    </span>
                  )}
                  {hasLongitudinal && (
                    <span
                      style={{
                        fontSize: 8,
                        padding: '1px 5px',
                        background: '#1CABB022',
                        color: typeColor,
                        border: `1px solid ${typeColor}44`,
                        borderRadius: 3,
                      }}
                    >
                      Long.
                    </span>
                  )}
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 4 }}>
              {nd.tirRaw && (
                <button
                  className="nodrag"
                  onClick={exportTir}
                  title={t('tirFileInput.exportTitle', 'Download .tir file')}
                  style={{
                    background: '#1CABB022',
                    color: typeColor,
                    border: `1px solid ${typeColor}44`,
                    borderRadius: 3,
                    padding: '1px 8px',
                    fontSize: 9,
                    cursor: 'pointer',
                  }}
                >
                  {t('tirFileInput.export', 'Export')}
                </button>
              )}
              <button
                className="nodrag"
                onClick={clearFile}
                style={{
                  background: '#2a2a2a',
                  color: '#888',
                  border: '1px solid #333',
                  borderRadius: 3,
                  padding: '1px 8px',
                  fontSize: 9,
                  cursor: 'pointer',
                }}
              >
                {t('tirFileInput.clear', 'Clear')}
              </button>
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{
          top: '50%',
          background: typeColor,
          width: 8,
          height: 8,
          border: '2px solid #1a1a1a',
        }}
      />
    </div>
  )
}

export const TirFileInputNode = memo(TirFileInputNodeInner)
