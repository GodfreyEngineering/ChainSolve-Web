/**
 * OperationNode — math/trig/logic blocks with N inputs and 1 output.
 *
 * Features:
 * - Inline number input on unconnected or overridden ports.
 * - Override toggle button when a port is connected (pin icon).
 * - isValidConnection on each Handle: blocks 2nd edge to same input.
 * - useEdges() for live connection state without prop-drilling.
 */

import { memo, useCallback, useMemo } from 'react'
import {
  Handle,
  Position,
  useEdges,
  useReactFlow,
  type NodeProps,
  type IsValidConnection,
} from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { useShowValuePopover } from '../../../contexts/ValuePopoverContext'
import { formatValue } from '../../../engine/value'
import { BLOCK_REGISTRY, type NodeData } from '../../../blocks/registry'
import type { InputBinding } from '../../../blocks/types'
import { ensureBinding } from '../../../lib/migrateBindings'
import { ValueEditor } from '../editors/ValueEditor'
import { getUnitSymbol } from '../../../units/unitSymbols'
import { NODE_STYLES as s } from './nodeStyles'

function OperationNodeInner({ id, data, selected, draggable }: NodeProps) {
  const nd = data as NodeData
  const { updateNodeData } = useReactFlow()
  const allEdges = useEdges()
  const computed = useComputed()
  const showPopover = useShowValuePopover()
  const value = computed.get(id)
  const isLocked = draggable === false

  const def = BLOCK_REGISTRY.get(nd.blockType)
  const inputs = def?.inputs ?? []

  const manualValues = useMemo(
    () => (nd.manualValues ?? {}) as Record<string, number>,
    [nd.manualValues],
  )
  const inputBindings = useMemo(
    () => (nd.inputBindings ?? {}) as Record<string, InputBinding>,
    [nd.inputBindings],
  )
  const portOverrides = useMemo(
    () => (nd.portOverrides ?? {}) as Record<string, boolean>,
    [nd.portOverrides],
  )

  const isPortConnected = useCallback(
    (portId: string) => allEdges.some((e) => e.target === id && e.targetHandle === portId),
    [allEdges, id],
  )

  const updateBinding = useCallback(
    (portId: string, binding: InputBinding) =>
      updateNodeData(id, {
        inputBindings: { ...inputBindings, [portId]: binding },
        // Keep manualValues in sync for backward compat
        ...(binding.kind === 'literal'
          ? { manualValues: { ...manualValues, [portId]: binding.value } }
          : {}),
      }),
    [id, inputBindings, manualValues, updateNodeData],
  )

  const toggleOverride = useCallback(
    (portId: string) =>
      updateNodeData(id, { portOverrides: { ...portOverrides, [portId]: !portOverrides[portId] } }),
    [id, portOverrides, updateNodeData],
  )

  // Allow ≤1 incoming edge per target handle.
  const isValidConnection = useCallback<IsValidConnection>(
    (conn) =>
      !allEdges.some((e) => e.target === conn.target && e.targetHandle === conn.targetHandle),
    [allEdges],
  )

  const ROW_H = 30
  const bodyH = Math.max(inputs.length * ROW_H, 36)

  return (
    <div style={{ ...s.node, ...(selected ? s.nodeSelected : {}) }}>
      <div style={s.header}>
        <span style={s.headerLabel}>{nd.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {isLocked && <span style={{ fontSize: '0.6rem', lineHeight: 1, opacity: 0.7 }}>🔒</span>}
          <span
            className="cs-node-header-value cs-value-badge nodrag"
            style={{ ...s.headerValue, cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              showPopover(id, e.clientX, e.clientY)
            }}
          >
            {formatValue(value)}
            {nd.unit && (
              <span style={{ fontSize: '0.6rem', marginLeft: '0.15rem', opacity: 0.7 }}>
                {getUnitSymbol(nd.unit)}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="cs-node-body" style={{ position: 'relative', height: bodyH }}>
        {inputs.map((port, i) => {
          const connected = isPortConnected(port.id)
          const override = portOverrides[port.id] === true
          const showInput = !connected || override

          const topPx = (i + 0.5) * ROW_H

          return (
            <div
              key={port.id}
              style={{
                position: 'absolute',
                top: topPx,
                transform: 'translateY(-50%)',
                left: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                paddingRight: '0.5rem',
              }}
            >
              <Handle
                type="target"
                position={Position.Left}
                id={port.id}
                isValidConnection={isValidConnection}
                style={{
                  ...(connected ? s.handleLeft : s.handleLeftDisconnected),
                  position: 'relative',
                  transform: 'none',
                  top: 'auto',
                  left: 'auto',
                  marginLeft: -5,
                  flexShrink: 0,
                }}
              />

              <span style={s.portLabel}>{port.label}</span>

              {showInput ? (
                <ValueEditor
                  compact
                  override={override}
                  binding={ensureBinding(inputBindings, manualValues, port.id)}
                  onChange={(b) => updateBinding(port.id, b)}
                />
              ) : (
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: '#1CABB0',
                    opacity: 0.6,
                    fontFamily: 'monospace',
                    flexShrink: 0,
                  }}
                >
                  ▶
                </span>
              )}

              {connected && (
                <button
                  className="nodrag"
                  onClick={() => toggleOverride(port.id)}
                  title={override ? 'Use connected value' : 'Override with manual value'}
                  style={{
                    width: 16,
                    height: 16,
                    padding: 0,
                    marginLeft: 2,
                    flexShrink: 0,
                    background: override ? 'rgba(28,171,176,0.2)' : 'transparent',
                    border: `1px solid ${override ? '#1CABB0' : 'rgba(255,255,255,0.15)'}`,
                    borderRadius: 3,
                    color: override ? '#1CABB0' : 'rgba(255,255,255,0.35)',
                    cursor: 'pointer',
                    fontSize: '0.6rem',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {override ? '↩' : '✎'}
                </button>
              )}
            </div>
          )
        })}

        {/* Output handle — right edge, vertically centred */}
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
