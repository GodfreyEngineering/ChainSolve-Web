/**
 * DataNode — for data input blocks (csData kind):
 *   Array Input (vectorInput) — single vector output
 *   Table Input (tableInput)  — per-column vector outputs
 *
 * 4.4: Table Input shows a compact 3×3 preview on-canvas with an
 *      expand toggle to show the full spreadsheet editor.
 *
 * Output handles on the right.
 */

import { memo, useCallback, useState } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useComputedValue } from '../../../contexts/ComputedContext'
import { formatValue } from '../../../engine/value'
import type { NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'
import { VectorEditor } from '../editors/VectorEditor'
import { TableEditor } from '../editors/TableEditor'

/** 4.4: Compact preview — first 3 rows × first 3 columns */
const PREVIEW_ROWS = 3
const PREVIEW_COLS = 3

function TablePreview({
  columns,
  rows,
  onExpand,
}: {
  columns: string[]
  rows: number[][]
  onExpand: () => void
}) {
  const previewCols = columns.slice(0, PREVIEW_COLS)
  const previewRows = rows.slice(0, PREVIEW_ROWS)
  const hasMoreCols = columns.length > PREVIEW_COLS
  const hasMoreRows = rows.length > PREVIEW_ROWS

  return (
    <div className="nodrag" style={{ userSelect: 'none' }}>
      {/* Mini table */}
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: '0.62rem',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <thead>
          <tr>
            {previewCols.map((col, ci) => (
              <th
                key={ci}
                style={{
                  padding: '2px 6px',
                  background: 'rgba(28,171,176,0.08)',
                  color: 'rgba(244,244,243,0.7)',
                  fontWeight: 600,
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 64,
                }}
              >
                {col}
              </th>
            ))}
            {hasMoreCols && (
              <th
                style={{
                  padding: '2px 4px',
                  color: 'rgba(244,244,243,0.3)',
                  fontWeight: 400,
                  fontSize: '0.55rem',
                  textAlign: 'center',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                +{columns.length - PREVIEW_COLS}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {previewRows.map((row, ri) => (
            <tr key={ri}>
              {previewCols.map((_, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: '1px 6px',
                    color: 'var(--text)',
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  {row[ci] ?? 0}
                </td>
              ))}
              {hasMoreCols && (
                <td
                  style={{
                    padding: '1px 4px',
                    color: 'rgba(244,244,243,0.2)',
                    textAlign: 'center',
                    fontSize: '0.55rem',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  ...
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {hasMoreRows && (
        <div
          style={{
            fontSize: '0.55rem',
            color: 'rgba(244,244,243,0.3)',
            textAlign: 'center',
            padding: '1px 0',
          }}
        >
          +{rows.length - PREVIEW_ROWS} more row{rows.length - PREVIEW_ROWS !== 1 ? 's' : ''}
        </div>
      )}

      {/* Expand button */}
      <button
        className="nodrag"
        onClick={onExpand}
        style={{
          width: '100%',
          marginTop: 4,
          padding: '3px 0',
          background: 'rgba(28,171,176,0.1)',
          border: '1px solid rgba(28,171,176,0.2)',
          borderRadius: 4,
          color: 'var(--primary)',
          cursor: 'pointer',
          fontSize: '0.62rem',
          fontWeight: 600,
          fontFamily: 'inherit',
        }}
      >
        Edit table
      </button>
    </div>
  )
}

function DataNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const { updateNodeData } = useReactFlow()
  const value = useComputedValue(id)
  const isTable = nd.blockType === 'tableInput' || nd.blockType === 'matrixInput'
  /** 2.7: MatrixInput columns are auto-named numerically (read-only headers). */
  const isMatrix = nd.blockType === 'matrixInput'
  const tableOutputMode = (nd.tableOutputMode as string | undefined) ?? 'columns'

  // 4.4: Collapse / expand state for the table editor
  const [tableExpanded, setTableExpanded] = useState(false)

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const onVectorChange = useCallback(
    (vectorData: number[]) => updateNodeData(id, { vectorData }),
    [id, updateNodeData],
  )

  const onTableChange = useCallback(
    (columns: string[], rows: number[][]) => {
      // 2.7: MatrixInput auto-generates "1", "2", ... column names (immutable headers)
      const finalColumns = isMatrix ? columns.map((_, ci) => String(ci + 1)) : columns
      updateNodeData(id, { tableData: { columns: finalColumns, rows } })
    },
    [id, isMatrix, updateNodeData],
  )

  const tableData = (nd.tableData as { columns: string[]; rows: number[][] } | undefined) ?? {
    columns: ['A', 'B'],
    rows: [[0, 0]],
  }

  // 4.4: Show compact preview when table is small enough OR collapsed
  const isSmallTable =
    tableData.rows.length <= PREVIEW_ROWS && tableData.columns.length <= PREVIEW_COLS
  const showFullEditor = isTable && (tableExpanded || isSmallTable)

  const ariaLabel = `${nd.label} data block, output: ${formatValue(value)}`

  return (
    <div
      style={{
        ...s.node,
        minWidth: isTable ? (showFullEditor ? 260 : 180) : 200,
        maxWidth: isTable ? 480 : 320,
        ...(selected ? { ...s.nodeSelected, borderColor: typeColor } : {}),
      }}
      role="group"
      aria-label={ariaLabel}
    >
      <div
        style={{
          ...s.header,
          borderBottom: `2px solid color-mix(in srgb, ${typeColor} 30%, transparent)`,
          background: `linear-gradient(to right, color-mix(in srgb, ${typeColor} 6%, transparent), transparent)`,
        }}
      >
        <div className="cs-node-header-left" style={s.headerLeft}>
          <Icon icon={TypeIcon} size={14} style={{ ...s.headerIcon, color: typeColor }} />
          <span style={s.headerLabel}>{nd.label}</span>
        </div>
        <span className="cs-node-header-value" style={s.headerValue}>
          {isTable
            ? `${tableData.rows.length.toLocaleString()} × ${tableData.columns.length}`
            : formatValue(value)}
        </span>
      </div>

      <div className="cs-node-body" style={s.body}>
        {isTable ? (
          showFullEditor ? (
            <>
              <TableEditor
                columns={tableData.columns}
                rows={tableData.rows}
                onChange={onTableChange}
              />
              {/* 4.4: Collapse button when expanded and table is large */}
              {!isSmallTable && (
                <button
                  className="nodrag"
                  onClick={() => setTableExpanded(false)}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    padding: '3px 0',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 4,
                    color: 'var(--text-faint)',
                    cursor: 'pointer',
                    fontSize: '0.6rem',
                    fontFamily: 'inherit',
                  }}
                >
                  Collapse
                </button>
              )}
            </>
          ) : (
            <TablePreview
              columns={tableData.columns}
              rows={tableData.rows}
              onExpand={() => setTableExpanded(true)}
            />
          )
        ) : (
          <VectorEditor
            values={(nd.vectorData as number[] | undefined) ?? []}
            onChange={onVectorChange}
          />
        )}
      </div>

      {isTable ? (
        // 2.7: MatrixInput always uses a single "out" handle (whole table output)
        isMatrix || tableOutputMode !== 'columns' ? (
          <Handle
            type="source"
            position={Position.Right}
            id="out"
            style={{ ...s.handleRight, top: '50%', transform: 'translateY(-50%)' }}
            title={
              isMatrix
                ? `${tableData.rows.length}\u00d7${tableData.columns.length} matrix`
                : tableOutputMode === 'table'
                  ? 'Entire table'
                  : tableOutputMode === 'row'
                    ? `Row ${(nd.tableOutputRow ?? 0) + 1}`
                    : `Column ${tableData.columns[nd.tableOutputCol ?? 0] ?? 'A'}`
            }
          />
        ) : (
          tableData.columns.map((col, ci) => (
            <Handle
              key={col}
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
        )
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

export const DataNode = memo(DataNodeInner)
