/**
 * DisplayNode — output block that shows the computed value prominently.
 * Has one target handle (left) and no source handle.
 */

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { formatValue } from '../../../engine/evaluate'
import type { NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s } from './nodeStyles'

function DisplayNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const computed = useComputed()
  const value = computed.get(id)

  const isNaNVal = value !== undefined && isNaN(value)
  const displayStyle: React.CSSProperties = {
    ...s.displayValue,
    ...(isNaNVal ? { color: '#f87171', opacity: 0.7 } : {}),
  }

  return (
    <div style={{ ...s.node, minWidth: 140, ...(selected ? s.nodeSelected : {}) }}>
      <div style={s.header}>
        <span style={s.headerLabel}>{nd.label}</span>
      </div>

      <div style={{ ...s.body, textAlign: 'center', position: 'relative', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Handle
          type="target"
          position={Position.Left}
          id="value"
          style={{ ...s.handleLeft, top: '50%', transform: 'translateY(-50%)' }}
        />
        <span style={displayStyle}>{formatValue(value)}</span>
      </div>
    </div>
  )
}

export const DisplayNode = memo(DisplayNodeInner)
