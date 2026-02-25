/**
 * OperationNode — for blocks that transform inputs into one output:
 *   Add, Subtract, Multiply, Divide, Sin, Cos, …
 *
 * Left side: one Handle per input port with a label.
 * Right side: one source Handle for the output.
 * Header shows the live computed value.
 */

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { formatValue } from '../../../engine/evaluate'
import { BLOCK_REGISTRY, type NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s } from './nodeStyles'

function OperationNodeInner({ id, data, selected }: NodeProps) {
  const nd = data as NodeData
  const computed = useComputed()
  const value = computed.get(id)

  const def = BLOCK_REGISTRY.get(nd.blockType)
  const inputs = def?.inputs ?? []

  // Space handles evenly. Each port row is ~22px.
  const portHeight = Math.max(inputs.length * 28, 36)

  return (
    <div style={{ ...s.node, ...(selected ? s.nodeSelected : {}) }}>
      <div style={s.header}>
        <span style={s.headerLabel}>{nd.label}</span>
        <span style={s.headerValue}>{formatValue(value)}</span>
      </div>

      <div style={{ ...s.body, padding: 0, position: 'relative', height: portHeight }}>
        {/* Input handles on the left */}
        {inputs.map((port, i) => {
          const topPct = ((i + 0.5) / inputs.length) * 100
          return (
            <div
              key={port.id}
              style={{
                position: 'absolute',
                top: `${topPct}%`,
                transform: 'translateY(-50%)',
                left: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Handle
                type="target"
                position={Position.Left}
                id={port.id}
                style={{ ...s.handleLeft, top: 'auto', position: 'relative', transform: 'none', marginRight: 6 }}
              />
              <span style={s.portLabel}>{port.label}</span>
            </div>
          )
        })}

        {/* Output handle on the right — vertically centred */}
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={{ ...s.handleRight, top: '50%', transform: 'translateY(-50%)' }}
        />
      </div>
    </div>
  )
}

export const OperationNode = memo(OperationNodeInner)
