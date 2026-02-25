/**
 * Inspector — right sidebar showing properties of the selected node.
 * Editable fields: label, value (Number), range (Slider).
 * Always shows the live computed output value.
 */

import { useReactFlow, type Node } from '@xyflow/react'
import { useComputed } from '../../contexts/ComputedContext'
import { formatValue } from '../../engine/evaluate'
import { BLOCK_REGISTRY, type NodeData } from '../../blocks/registry'

interface InspectorProps {
  selectedNode: Node | null
}

const s = {
  panel: {
    width: 240,
    flexShrink: 0,
    borderLeft: '1px solid var(--border)',
    background: 'var(--card-bg)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    padding: '0.6rem 0.75rem',
    borderBottom: '1px solid var(--border)',
    fontWeight: 700,
    fontSize: '0.78rem',
    letterSpacing: '0.04em',
    opacity: 0.5,
    textTransform: 'uppercase' as const,
  },
  body: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0.75rem',
  },
  empty: {
    opacity: 0.4,
    fontSize: '0.82rem',
    textAlign: 'center' as const,
    marginTop: '2rem',
  },
  fieldLabel: {
    fontSize: '0.72rem',
    opacity: 0.55,
    marginBottom: '0.2rem',
    display: 'block',
    userSelect: 'none' as const,
  },
  field: {
    marginBottom: '0.85rem',
  },
  input: {
    width: '100%',
    padding: '0.3rem 0.5rem',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--input-bg)',
    color: 'inherit',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  numInput: {
    width: '100%',
    padding: '0.3rem 0.5rem',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--input-bg)',
    color: 'inherit',
    fontSize: '0.85rem',
    fontFamily: 'monospace',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  outputBox: {
    background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: 8,
    padding: '0.6rem 0.75rem',
    textAlign: 'center' as const,
    marginTop: '0.5rem',
  },
  outputValue: {
    fontFamily: 'monospace',
    fontSize: '1.4rem',
    fontWeight: 700,
    color: '#22c55e',
    display: 'block',
  },
  outputLabel: {
    fontSize: '0.7rem',
    opacity: 0.5,
    marginTop: '0.15rem',
    display: 'block',
  },
  divider: {
    borderTop: '1px solid var(--border)',
    margin: '0.75rem 0',
  },
  portList: {
    marginTop: '0.5rem',
  },
  portRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.78rem',
    padding: '0.15rem 0',
    opacity: 0.7,
  },
}

export function Inspector({ selectedNode }: InspectorProps) {
  const { updateNodeData } = useReactFlow()
  const computed = useComputed()

  if (!selectedNode) {
    return (
      <div style={s.panel}>
        <div style={s.header}>Inspector</div>
        <div style={s.body}>
          <p style={s.empty}>Select a block to inspect</p>
        </div>
      </div>
    )
  }

  const nd = selectedNode.data as NodeData
  const def = BLOCK_REGISTRY.get(nd.blockType)
  const value = computed.get(selectedNode.id)

  const update = (patch: Partial<NodeData>) => {
    updateNodeData(selectedNode.id, patch)
  }

  const isNumber = nd.blockType === 'number'
  const isSlider = nd.blockType === 'slider'

  return (
    <div style={s.panel}>
      <div style={s.header}>Inspector</div>
      <div style={s.body}>
        {/* Block type badge */}
        <div style={s.field}>
          <span style={s.fieldLabel}>Block type</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{def?.label ?? nd.blockType}</span>
        </div>

        {/* Label editor */}
        <div style={s.field}>
          <span style={s.fieldLabel}>Label</span>
          <input
            style={s.input}
            value={nd.label}
            onChange={(e) => update({ label: e.target.value })}
          />
        </div>

        {/* Number value */}
        {isNumber && (
          <div style={s.field}>
            <span style={s.fieldLabel}>Value</span>
            <input
              type="number"
              style={s.numInput}
              value={nd.value ?? 0}
              step="any"
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) update({ value: v })
              }}
            />
          </div>
        )}

        {/* Slider config */}
        {isSlider && (
          <>
            <div style={s.field}>
              <span style={s.fieldLabel}>Value</span>
              <input
                type="range"
                style={{ width: '100%', accentColor: '#646cff' }}
                min={nd.min ?? 0}
                max={nd.max ?? 100}
                step={nd.step ?? 1}
                value={nd.value ?? 0}
                onChange={(e) => update({ value: parseFloat(e.target.value) })}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', opacity: 0.5 }}>
                <span>{nd.min ?? 0}</span>
                <span style={{ fontWeight: 700, opacity: 1 }}>{nd.value ?? 0}</span>
                <span>{nd.max ?? 100}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.85rem' }}>
              {(['min', 'max', 'step'] as const).map((key) => (
                <div key={key}>
                  <span style={s.fieldLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                  <input
                    type="number"
                    style={{ ...s.numInput, fontSize: '0.78rem' }}
                    value={nd[key] ?? (key === 'step' ? 1 : key === 'min' ? 0 : 100)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      if (!isNaN(v)) update({ [key]: v })
                    }}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <div style={s.divider} />

        {/* Input ports (connected / disconnected info) */}
        {def && def.inputs.length > 0 && (
          <div style={s.portList}>
            <span style={s.fieldLabel}>Inputs</span>
            {def.inputs.map((port) => (
              <div key={port.id} style={s.portRow}>
                <span>{port.label}</span>
                <span style={{ fontFamily: 'monospace', opacity: 0.5 }}>—</span>
              </div>
            ))}
          </div>
        )}

        {/* Output value */}
        <div style={s.outputBox}>
          <span style={{
            ...s.outputValue,
            ...(value !== undefined && isNaN(value) ? { color: '#f87171' } : {}),
          }}>
            {formatValue(value)}
          </span>
          <span style={s.outputLabel}>output</span>
        </div>
      </div>
    </div>
  )
}
