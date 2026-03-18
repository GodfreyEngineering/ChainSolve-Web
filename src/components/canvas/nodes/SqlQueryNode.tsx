/**
 * SqlQueryNode — 4.20: SQL query block.
 *
 * Lets users write parameterised PostgreSQL queries against their Supabase
 * database. Results are stored as tableData (same shape as tableInput) and
 * bridge-remapped to 'tableInput' for the Rust engine.
 *
 * Features:
 *  - SQL textarea editor with monospace font
 *  - Parameter list ($1, $2, … placeholders → string values)
 *  - Run button (manual) + optional auto-run toggle
 *  - 4×4 results preview table
 *  - Per-column output handles (col_0, col_1, …) when data is loaded
 *  - Error display
 *  - Execution time badge
 */

import { memo, useCallback, useState } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { runSqlQuery } from '../../../lib/sqlQueryService'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TableData {
  columns: string[]
  rows: number[][]
}

interface SqlQueryNodeData extends NodeData {
  sql: string
  params: string[]
  tableData: TableData
  autoRun: boolean
  rowCount: number
  executionMs: number
  queryError: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// ── Component ──────────────────────────────────────────────────────────────────

function SqlQueryNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as SqlQueryNodeData
  const { updateNodeData } = useReactFlow()

  const [running, setRunning] = useState(false)

  const sql = nd.sql ?? ''
  const params = nd.params ?? []
  const tableData: TableData = (nd.tableData as TableData | undefined) ?? {
    columns: [],
    rows: [],
  }
  const autoRun = nd.autoRun ?? false
  const queryError = nd.queryError ?? ''
  const executionMs = nd.executionMs ?? 0
  const rowCount = nd.rowCount ?? 0

  const hasData = tableData.columns.length > 0

  const executeQuery = useCallback(async () => {
    if (!sql.trim() || running) return
    setRunning(true)
    try {
      const parsed = params.map((p) => {
        const n = Number(p)
        return Number.isFinite(n) ? n : p
      })
      const result = await runSqlQuery(sql, parsed)
      updateNodeData(id, {
        tableData: { columns: result.columns, rows: result.rows },
        rowCount: result.rowCount,
        executionMs: result.executionMs,
        queryError: result.error ?? '',
      })
    } finally {
      setRunning(false)
    }
  }, [id, sql, params, running, updateNodeData])

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  // Preview: up to 4 rows × 4 cols
  const previewCols = tableData.columns.slice(0, 4)
  const previewRows = tableData.rows.slice(0, 4)

  return (
    <div
      style={{
        ...s.nodeWrapper,
        border: selected ? `1.5px solid ${typeColor}` : s.nodeWrapper.border,
        minWidth: 280,
        maxWidth: 340,
      }}
    >
      {/* Header */}
      <div style={{ ...s.nodeHeader, background: typeColor }}>
        <span style={s.nodeHeaderIcon}>{TypeIcon && <TypeIcon size={12} />}</span>
        <span style={s.nodeHeaderLabel}>{nd.label ?? t('sqlQuery.label', 'SQL Query')}</span>
        {executionMs > 0 && !queryError && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 9,
              opacity: 0.8,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {fmtMs(executionMs)}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={s.nodeBody}>
        {/* SQL editor */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, color: '#aaa', marginBottom: 2 }}>
            {t('sqlQuery.sql', 'SQL')}
          </div>
          <textarea
            className="nodrag"
            value={sql}
            onChange={(e) => updateNodeData(id, { sql: e.target.value })}
            rows={4}
            spellCheck={false}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#1a1a1a',
              color: '#F4F4F3',
              border: '1px solid #555',
              borderRadius: 4,
              padding: '4px 6px',
              fontSize: 10,
              fontFamily: 'JetBrains Mono, monospace',
              resize: 'vertical',
              outline: 'none',
            }}
          />
        </div>

        {/* Parameters */}
        {params.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: '#aaa', marginBottom: 2 }}>
              {t('sqlQuery.params', 'Parameters')}
            </div>
            {params.map((p, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color: '#888',
                    fontFamily: 'JetBrains Mono, monospace',
                    minWidth: 18,
                  }}
                >
                  ${i + 1}
                </span>
                <input
                  className="nodrag"
                  type="text"
                  value={p}
                  onChange={(e) => {
                    const next = [...params]
                    next[i] = e.target.value
                    updateNodeData(id, { params: next })
                  }}
                  style={{
                    flex: 1,
                    background: '#1a1a1a',
                    color: '#F4F4F3',
                    border: '1px solid #444',
                    borderRadius: 3,
                    padding: '2px 5px',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono, monospace',
                    outline: 'none',
                  }}
                />
                <button
                  className="nodrag"
                  onClick={() => {
                    const next = params.filter((_, j) => j !== i)
                    updateNodeData(id, { params: next })
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontSize: 11,
                    lineHeight: 1,
                    padding: '0 2px',
                  }}
                  title={t('sqlQuery.removeParam', 'Remove parameter')}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Controls row */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, alignItems: 'center' }}>
          <button
            className="nodrag"
            onClick={executeQuery}
            disabled={running || !sql.trim()}
            style={{
              flex: 1,
              background: typeColor,
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 10,
              fontWeight: 600,
              cursor: running || !sql.trim() ? 'not-allowed' : 'pointer',
              opacity: running || !sql.trim() ? 0.6 : 1,
            }}
          >
            {running ? t('sqlQuery.running', 'Running…') : t('sqlQuery.run', 'Run Query')}
          </button>
          <button
            className="nodrag"
            onClick={() => updateNodeData(id, { params: [...params, ''] })}
            style={{
              background: '#383838',
              color: '#ccc',
              border: '1px solid #555',
              borderRadius: 4,
              padding: '4px 6px',
              fontSize: 10,
              cursor: 'pointer',
            }}
            title={t('sqlQuery.addParam', 'Add parameter')}
          >
            +$
          </button>
          <label
            className="nodrag"
            style={{ fontSize: 9, color: '#888', display: 'flex', alignItems: 'center', gap: 3 }}
          >
            <input
              type="checkbox"
              checked={autoRun}
              onChange={(e) => updateNodeData(id, { autoRun: e.target.checked })}
              style={{ width: 10, height: 10 }}
            />
            {t('sqlQuery.auto', 'Auto')}
          </label>
        </div>

        {/* Error */}
        {queryError && (
          <div
            style={{
              background: '#3f1010',
              border: '1px solid #f87171',
              borderRadius: 4,
              padding: '4px 6px',
              fontSize: 9,
              color: '#f87171',
              marginBottom: 6,
              fontFamily: 'JetBrains Mono, monospace',
              wordBreak: 'break-all',
            }}
          >
            {queryError}
          </div>
        )}

        {/* Results preview */}
        {hasData && !queryError && (
          <div>
            <div
              style={{
                fontSize: 9,
                color: '#aaa',
                marginBottom: 2,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{t('sqlQuery.results', 'Results')}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {rowCount} {t('sqlQuery.rows', 'rows')} × {tableData.columns.length}{' '}
                {t('sqlQuery.cols', 'cols')}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  borderCollapse: 'collapse',
                  fontSize: 9,
                  width: '100%',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                <thead>
                  <tr>
                    {previewCols.map((col, ci) => (
                      <th
                        key={ci}
                        style={{
                          padding: '2px 4px',
                          textAlign: 'left',
                          color: '#aaa',
                          borderBottom: '1px solid #555',
                          fontWeight: 600,
                          maxWidth: 60,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={col}
                      >
                        {col}
                      </th>
                    ))}
                    {tableData.columns.length > 4 && (
                      <th style={{ padding: '2px 4px', color: '#666' }}>…</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri}>
                      {row.slice(0, 4).map((cell, ci) => (
                        <td
                          key={ci}
                          style={{
                            padding: '2px 4px',
                            color: '#F4F4F3',
                            borderBottom: '1px solid #333',
                            maxWidth: 60,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {Number.isNaN(cell) ? 'NaN' : cell}
                        </td>
                      ))}
                      {tableData.columns.length > 4 && (
                        <td style={{ padding: '2px 4px', color: '#666' }}>…</td>
                      )}
                    </tr>
                  ))}
                  {rowCount > 4 && (
                    <tr>
                      <td
                        colSpan={
                          Math.min(previewCols.length, 4) + (tableData.columns.length > 4 ? 1 : 0)
                        }
                        style={{ padding: '2px 4px', color: '#666', fontSize: 8 }}
                      >
                        +{rowCount - 4} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasData && !queryError && !running && (
          <div style={{ fontSize: 9, color: '#666', textAlign: 'center', padding: '4px 0' }}>
            {t('sqlQuery.empty', 'Run query to see results')}
          </div>
        )}
      </div>

      {/* Output handles — one per column when data loaded, else single 'out' */}
      {hasData ? (
        tableData.columns.map((col, i) => (
          <Handle
            key={`col_${i}`}
            type="source"
            position={Position.Right}
            id={`col_${i}`}
            style={{
              top: `${((i + 0.5) / tableData.columns.length) * 100}%`,
              background: typeColor,
              width: 8,
              height: 8,
              border: '2px solid #1a1a1a',
            }}
            title={col}
          />
        ))
      ) : (
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
      )}
    </div>
  )
}

export const SqlQueryNode = memo(SqlQueryNodeInner)
