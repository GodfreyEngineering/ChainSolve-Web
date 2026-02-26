/**
 * SourceNode — for blocks with 0 inputs and 1 output:
 *   Number, Slider, Pi, E, Tau, Phi
 *
 * Shows an editable value or slider in the node body.
 * The single output handle sits on the right edge.
 */

import { memo, useCallback, useEffect } from 'react'
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { formatValue } from '../../../engine/value'
import type { NodeData } from '../../../blocks/registry'
import { useVariablesStore } from '../../../stores/variablesStore'
import { NODE_STYLES as s } from './nodeStyles'

function SourceNodeInner({ id, data, selected, draggable }: NodeProps) {
  const nd = data as NodeData
  const { updateNodeData } = useReactFlow()
  const computed = useComputed()
  const value = computed.get(id)
  const isLocked = draggable === false

  const updateVarValue = useVariablesStore((s) => s.updateValue)
  const updateValue = useCallback(
    (v: number) => {
      updateNodeData(id, { value: v })
      // W12.2: Two-way slider→variable binding
      const nodeData = data as NodeData
      if (nodeData.varId) updateVarValue(nodeData.varId, v)
    },
    [id, data, updateNodeData, updateVarValue],
  )

  const isSlider = nd.blockType === 'slider'
  const isNumber = nd.blockType === 'number'
  const isVariableSource = nd.blockType === 'variableSource'
  const isEditable = isSlider || isNumber || isVariableSource

  // W12.2: variableSource — sync variable value → node value
  const variables = useVariablesStore((s) => s.variables)
  const varId = nd.varId
  const boundVar = varId ? variables[varId] : undefined

  useEffect(() => {
    if (isVariableSource && boundVar !== undefined && boundVar.value !== nd.value) {
      updateNodeData(id, { value: boundVar.value })
    }
  }, [isVariableSource, boundVar, nd.value, id, updateNodeData])

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

      {isVariableSource && (
        <div className="cs-node-body" style={s.body}>
          <select
            className="nodrag"
            style={{
              width: '100%',
              padding: '0.2rem 0.3rem',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(0,0,0,0.2)',
              color: varId ? '#93c5fd' : 'rgba(244,244,243,0.4)',
              fontSize: '0.7rem',
              fontFamily: 'inherit',
              outline: 'none',
              cursor: 'pointer',
            }}
            value={varId ?? ''}
            onChange={(e) => {
              const selectedVarId = e.target.value || undefined
              const selectedVar = selectedVarId ? variables[selectedVarId] : undefined
              updateNodeData(id, {
                varId: selectedVarId,
                value: selectedVar?.value ?? 0,
                label: selectedVar?.name ?? 'Variable',
              })
            }}
          >
            <option value="">Select variable...</option>
            {Object.values(variables).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} = {v.value}
              </option>
            ))}
          </select>
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
