/**
 * DisplayNode — output block that shows the computed value prominently.
 * Has one target handle (left) and no source handle.
 */

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { isError, isScalar } from '../../../engine/value'
import { useFormatValue } from '../../../hooks/useFormatValue'
import type { NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s } from './nodeStyles'

function DisplayNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const computed = useComputed()
  const value = computed.get(id)
  const formatValue = useFormatValue()

  const isErrVal =
    value !== undefined && (isError(value) || (isScalar(value) && isNaN(value.value)))
  const displayStyle: React.CSSProperties = {
    ...s.displayValue,
    ...(isErrVal ? { color: '#f87171', opacity: 0.7 } : {}),
  }

  return (
    <div style={{ ...s.node, minWidth: 140, ...(selected ? s.nodeSelected : {}) }}>
      <div style={s.header}>
        <span style={s.headerLabel}>{nd.label}</span>
      </div>

      <div
        className="cs-node-body"
        style={{
          ...s.body,
          textAlign: 'center',
          position: 'relative',
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
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
