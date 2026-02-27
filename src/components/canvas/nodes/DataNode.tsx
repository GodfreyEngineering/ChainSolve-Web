/**
 * DataNode — for data input blocks (csData kind):
 *   VectorInput, TableInput, CSVImport
 *
 * Dispatches to the appropriate editor based on blockType.
 * Single output handle on the right.
 */

import { memo, useCallback } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { formatValue } from '../../../engine/value'
import type { NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s } from './nodeStyles'
import { VectorEditor } from '../editors/VectorEditor'
import { TableEditor } from '../editors/TableEditor'
import { CsvPicker } from '../editors/CsvPicker'

function DataNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const { updateNodeData } = useReactFlow()
  const computed = useComputed()
  const value = computed.get(id)

  const onVectorChange = useCallback(
    (vectorData: number[]) => updateNodeData(id, { vectorData }),
    [id, updateNodeData],
  )

  const onTableChange = useCallback(
    (columns: string[], rows: number[][]) => updateNodeData(id, { tableData: { columns, rows } }),
    [id, updateNodeData],
  )

  const renderEditor = () => {
    switch (nd.blockType) {
      case 'vectorInput':
        return (
          <VectorEditor
            values={(nd.vectorData as number[] | undefined) ?? []}
            onChange={onVectorChange}
          />
        )
      case 'tableInput': {
        const td = nd.tableData as { columns: string[]; rows: number[][] } | undefined
        return (
          <TableEditor
            columns={td?.columns ?? ['A']}
            rows={td?.rows ?? []}
            onChange={onTableChange}
          />
        )
      }
      case 'csvImport':
        return <CsvPicker nodeId={id} data={nd} />
      default:
        return null
    }
  }

  return (
    <div
      style={{
        ...s.node,
        minWidth: nd.blockType === 'tableInput' ? 280 : 200,
        maxWidth: nd.blockType === 'tableInput' ? 500 : 320,
      }}
    >
      <div style={{ ...s.header, ...(selected ? {} : {}) }}>
        <span style={s.headerLabel}>{nd.label}</span>
        <span className="cs-node-header-value" style={s.headerValue}>
          {formatValue(value)}
        </span>
      </div>

      <div className="cs-node-body" style={s.body}>
        {renderEditor()}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{ ...s.handleRight, top: '50%', transform: 'translateY(-50%)' }}
      />
    </div>
  )
}

export const DataNode = memo(DataNodeInner)
