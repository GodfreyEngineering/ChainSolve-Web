/**
 * SourceNode — for blocks with 0 inputs and 1 output:
 *   Number, Slider, Pi, E, Tau, Phi
 *
 * Shows an editable value or slider in the node body.
 * The single output handle sits on the right edge.
 */

import { memo, useCallback } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { formatValue } from '../../../engine/value'
import type { NodeData } from '../../../blocks/registry'
import { NODE_STYLES as s } from './nodeStyles'

function SourceNodeInner({ id, data, selected, draggable }: NodeProps) {
  const nd = data as NodeData
  const { updateNodeData } = useReactFlow()
  const computed = useComputed()
  const value = computed.get(id)
  const isLocked = draggable === false

  const updateValue = useCallback(
    (v: number) => updateNodeData(id, { value: v }),
    [id, updateNodeData],
  )

  const isSlider = nd.blockType === 'slider'
  const isNumber = nd.blockType === 'number'
  const isEditable = isSlider || isNumber

  return (
    <div style={{ ...s.node, ...(selected ? s.nodeSelected : {}) }}>
      <div style={s.header}>
        <span style={s.headerLabel}>{nd.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {isLocked && <span style={{ fontSize: '0.6rem', lineHeight: 1, opacity: 0.7 }}>🔒</span>}
          <span className="cs-node-header-value" style={s.headerValue}>{formatValue(value)}</span>
        </div>
      </div>

      {isNumber && (
        <div className="cs-node-body" style={s.body}>
          <input
            type="number"
            style={s.numInput}
            value={nd.value ?? 0}
            step="any"
            className="nodrag"
            onChange={(e) => {
              const n = parseFloat(e.target.value)
              if (!isNaN(n)) updateValue(n)
            }}
          />
        </div>
      )}

      {isSlider && (
        <div className="cs-node-body" style={s.body}>
          <input
            type="range"
            className="nodrag"
            style={{ width: '100%', accentColor: 'var(--primary)' }}
            min={nd.min ?? 0}
            max={nd.max ?? 100}
            step={nd.step ?? 1}
            value={nd.value ?? 0}
            onChange={(e) => updateValue(parseFloat(e.target.value))}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.7rem',
              opacity: 0.5,
            }}
          >
            <span>{nd.min ?? 0}</span>
            <span style={{ fontWeight: 600, opacity: 1 }}>{nd.value ?? 0}</span>
            <span>{nd.max ?? 100}</span>
          </div>
        </div>
      )}

      {!isEditable && (
        <div className="cs-node-body" style={s.body}>
          <span style={s.constValue}>{formatValue(value)}</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} id="out" style={s.handleRight} />
    </div>
  )
}

export const SourceNode = memo(SourceNodeInner)
