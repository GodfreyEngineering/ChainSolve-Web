/**
 * DataNode — for data input blocks (csData kind):
 *   Array Input (vectorInput) — single vector output
 *   Table Input (tableInput)  — per-column vector outputs
 *
 * Output handles on the right.
 */

import { memo, useCallback } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useComputedValue } from '../../../contexts/ComputedContext'
import { formatValue } from '../../../engine/value'
import type { NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'
import { VectorEditor } from '../editors/VectorEditor'
import { TableEditor } from '../editors/TableEditor'

function DataNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const { updateNodeData } = useReactFlow()
  const value = useComputedValue(id)
  const isTable = nd.blockType === 'tableInput'

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const onVectorChange = useCallback(
    (vectorData: number[]) => updateNodeData(id, { vectorData }),
    [id, updateNodeData],
  )

  const onTableChange = useCallback(
    (columns: string[], rows: number[][]) => updateNodeData(id, { tableData: { columns, rows } }),
    [id, updateNodeData],
  )

  const tableData = (nd.tableData as { columns: string[]; rows: number[][] } | undefined) ?? {
    columns: ['A', 'B'],
    rows: [[0, 0]],
  }

  const ariaLabel = `${nd.label} data block, output: ${formatValue(value)}`

  return (
    <div
      style={{
        ...s.node,
        minWidth: isTable ? 260 : 200,
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
          <TableEditor columns={tableData.columns} rows={tableData.rows} onChange={onTableChange} />
        ) : (
          <VectorEditor
            values={(nd.vectorData as number[] | undefined) ?? []}
            onChange={onVectorChange}
          />
        )}
      </div>

      {isTable ? (
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
