/**
 * DataNode — for data input blocks (csData kind):
 *   List Input (vectorInput)
 *
 * Single output handle on the right.
 */

import { memo, useCallback } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { formatValue } from '../../../engine/value'
import type { NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s } from './nodeStyles'
import { VectorEditor } from '../editors/VectorEditor'

function DataNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const { updateNodeData } = useReactFlow()
  const computed = useComputed()
  const value = computed.get(id)

  const onVectorChange = useCallback(
    (vectorData: number[]) => updateNodeData(id, { vectorData }),
    [id, updateNodeData],
  )

  return (
    <div
      style={{
        ...s.node,
        minWidth: 200,
        maxWidth: 320,
        ...(selected ? s.nodeSelected : {}),
      }}
    >
      <div style={s.header}>
        <span style={s.headerLabel}>{nd.label}</span>
        <span className="cs-node-header-value" style={s.headerValue}>
          {formatValue(value)}
        </span>
      </div>

      <div className="cs-node-body" style={s.body}>
        <VectorEditor
          values={(nd.vectorData as number[] | undefined) ?? []}
          onChange={onVectorChange}
        />
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
