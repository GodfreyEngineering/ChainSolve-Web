/**
 * Inspector — right panel that shows properties for the inspected node.
 *
 * Opens via onNodeClick (not drag). Closed with ESC, onClose(), or pane click.
 * Uses useNodes() internally so data stays in sync without prop-drilling.
 * Shows per-port manual value + override toggle for operation nodes.
 */

import { useEffect, useState } from 'react'
import { useNodes, useEdges, useReactFlow } from '@xyflow/react'
import { useComputed } from '../../contexts/ComputedContext'
import { useEngine } from '../../contexts/EngineContext'
import { isError, isScalar, type Value } from '../../engine/value'
import { useFormatValue } from '../../hooks/useFormatValue'
import { BLOCK_REGISTRY, getTaxonomyLabels, type NodeData } from '../../blocks/registry'
import type { InputBinding, PlotConfig } from '../../blocks/types'
import type { TraceEntry } from '../../engine/index.ts'
import { ensureBinding } from '../../lib/migrateBindings'
import { ValueEditor } from './editors/ValueEditor'
import { PlotInspector } from './PlotInspector'
import { GroupInspector } from './GroupInspector'

interface InspectorProps {
  nodeId: string | null
  width: number
  onClose: () => void
  onResizeStart: (e: React.MouseEvent) => void
  onToggleCollapse?: (groupId: string) => void
  onUngroupNode?: (groupId: string) => void
  canUseGroups?: boolean
  /** When true, hides own chrome (header/resize handle) — AppWindow provides those. */
  floating?: boolean
}

const inp: React.CSSProperties = {
  width: '100%',
  padding: '0.28rem 0.45rem',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(0,0,0,0.2)',
  color: '#F4F4F3',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const monoInp: React.CSSProperties = {
  ...inp,
  fontFamily: "'JetBrains Mono', monospace",
}

const fieldLabel: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
  color: 'rgba(244,244,243,0.4)',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: '0.2rem',
  userSelect: 'none',
}

/** Extract a human-readable error message from a Value (G4-1 validation). */
function extractErrorMessage(v: Value | undefined): string | null {
  if (!v) return null
  if (isError(v)) return v.message
  if (isScalar(v) && isNaN(v.value)) return 'Result is NaN (not a number)'
  return null
}

export function Inspector({
  nodeId,
  width,
  onClose,
  onResizeStart,
  onToggleCollapse,
  onUngroupNode,
  canUseGroups,
  floating,
}: InspectorProps) {
  const allNodes = useNodes()
  const allEdges = useEdges()
  const { updateNodeData } = useReactFlow()
  const computed = useComputed()
  const engine = useEngine()

  const formatValue = useFormatValue()
  const node = nodeId ? (allNodes.find((n) => n.id === nodeId) ?? null) : null
  const nd = node?.data as NodeData | undefined

  // G4-1: Lazy-load block descriptions to avoid bloating the initial bundle
  const [descriptions, setDescriptions] = useState<Record<string, string>>({})
  useEffect(() => {
    import('../../blocks/blockDescriptions').then((m) => setDescriptions(m.BLOCK_DESCRIPTIONS))
  }, [])

  // ESC closes inspector (only when not floating — AppWindow handles ESC)
  useEffect(() => {
    if (floating) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, floating])

  const panelStyle: React.CSSProperties = floating
    ? {
        flex: 1,
        background: 'var(--card-bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }
    : {
        width,
        flexShrink: 0,
        borderLeft: '1px solid var(--border)',
        background: 'var(--card-bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
        position: 'relative',
        transition: 'width 0.2s ease',
      }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0.7rem',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  }

  if (!node || !nd) {
    return (
      <div style={panelStyle}>
        {!floating && (
          <div style={{ ...headerStyle, justifyContent: 'flex-start', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'rgba(244,244,243,0.4)',
                textTransform: 'uppercase',
              }}
            >
              Inspector
            </span>
          </div>
        )}
        <div
          style={{
            padding: '2rem 1rem',
            textAlign: 'center',
            color: 'var(--text-faint)',
            fontSize: 'var(--font-sm)',
          }}
        >
          Click a block to inspect
        </div>
        {!floating && (
          <div
            style={{
              position: 'absolute',
              left: -3,
              top: 0,
              bottom: 0,
              width: 6,
              cursor: 'ew-resize',
            }}
            onMouseDown={onResizeStart}
          />
        )}
      </div>
    )
  }

  const isGroup = nd.blockType === '__group__'
  const def = BLOCK_REGISTRY.get(nd.blockType)
  const value = computed.get(node.id)
  const manualValues = (nd.manualValues ?? {}) as Record<string, number>
  const inputBindings = (nd.inputBindings ?? {}) as Record<string, InputBinding>
  const portOverrides = (nd.portOverrides ?? {}) as Record<string, boolean>

  const isPortConnected = (portId: string) =>
    allEdges.some((e) => e.target === node.id && e.targetHandle === portId)

  const update = (patch: Partial<NodeData>) => updateNodeData(node.id, patch)

  const updateBinding = (portId: string, binding: InputBinding) =>
    update({
      inputBindings: { ...inputBindings, [portId]: binding },
      ...(binding.kind === 'literal'
        ? { manualValues: { ...manualValues, [portId]: binding.value } }
        : {}),
    })

  const toggleOverride = (portId: string) =>
    update({ portOverrides: { ...portOverrides, [portId]: !portOverrides[portId] } })

  const isErrVal =
    value !== undefined && (isError(value) || (isScalar(value) && isNaN(value.value)))
  const isInfVal =
    value !== undefined && isScalar(value) && !isNaN(value.value) && !isFinite(value.value)

  const field = (label: string, children: React.ReactNode) => (
    <div style={{ marginBottom: '0.7rem' }}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </div>
  )

  return (
    <div style={panelStyle}>
      {/* Resize handle (sidebar mode only) */}
      {!floating && (
        <div
          style={{
            position: 'absolute',
            left: -3,
            top: 0,
            bottom: 0,
            width: 6,
            cursor: 'ew-resize',
            zIndex: 10,
          }}
          onMouseDown={onResizeStart}
        />
      )}

      {/* Header (sidebar mode only — floating mode uses AppWindow chrome) */}
      {!floating && (
        <div style={headerStyle}>
          <div>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'rgba(244,244,243,0.4)',
                textTransform: 'uppercase' as const,
              }}
            >
              Inspector
            </span>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, marginTop: 2 }}>
              {def?.label ?? nd.blockType}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(244,244,243,0.4)',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '0 0.2rem',
              lineHeight: 1,
            }}
            title="Close (ESC)"
          >
            ✕
          </button>
        </div>
      )}

      {/* Node label summary (floating mode only) */}
      {floating && (
        <div
          style={{
            padding: '0.4rem 0.75rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.82rem',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {def?.label ?? nd.blockType}
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
        {/* Group inspector */}
        {isGroup ? (
          <GroupInspector
            groupId={node.id}
            data={nd}
            onUpdate={(patch) => update(patch)}
            onCollapse={() => onToggleCollapse?.(node.id)}
            onUngroup={() => onUngroupNode?.(node.id)}
            readOnly={!canUseGroups}
          />
        ) : (
          <>
            {/* Category breadcrumb (G4-1) */}
            {def &&
              (() => {
                const taxLabels = getTaxonomyLabels().get(def.type)
                if (!taxLabels) return null
                return (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        color: 'rgba(244,244,243,0.3)',
                        letterSpacing: '0.04em',
                        userSelect: 'none',
                      }}
                    >
                      {taxLabels.main}
                      {' \u203A '}
                      {taxLabels.sub}
                    </span>
                  </div>
                )
              })()}

            {/* Label */}
            {field(
              'Label',
              <input
                style={inp}
                value={nd.label}
                onChange={(e) => update({ label: e.target.value })}
              />,
            )}

            {/* Description (G4-1) */}
            {descriptions[nd.blockType] && (
              <div
                style={{
                  marginBottom: '0.7rem',
                  fontSize: '0.72rem',
                  lineHeight: 1.45,
                  color: 'rgba(244,244,243,0.5)',
                }}
              >
                {descriptions[nd.blockType]}
              </div>
            )}

            {/* Number source */}
            {nd.blockType === 'number' &&
              field(
                'Value',
                <input
                  type="number"
                  style={monoInp}
                  value={nd.value ?? 0}
                  step="any"
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v)) update({ value: v })
                  }}
                />,
              )}

            {/* Slider source */}
            {nd.blockType === 'slider' && (
              <>
                {field(
                  'Value',
                  <>
                    <input
                      type="range"
                      style={{ width: '100%', accentColor: 'var(--primary)', margin: '0.2rem 0' }}
                      min={nd.min ?? 0}
                      max={nd.max ?? 100}
                      step={nd.step ?? 1}
                      value={nd.value ?? 0}
                      onChange={(e) => update({ value: parseFloat(e.target.value) })}
                    />
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.7rem',
                        color: 'rgba(244,244,243,0.4)',
                      }}
                    >
                      <span>{nd.min ?? 0}</span>
                      <span style={{ fontFamily: 'monospace', color: '#1CABB0', fontWeight: 700 }}>
                        {nd.value ?? 0}
                      </span>
                      <span>{nd.max ?? 100}</span>
                    </div>
                  </>,
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '0.4rem',
                    marginBottom: '0.7rem',
                  }}
                >
                  {(['min', 'max', 'step'] as const).map((k) => (
                    <div key={k}>
                      <span style={fieldLabel}>{k.charAt(0).toUpperCase() + k.slice(1)}</span>
                      <input
                        type="number"
                        style={{ ...monoInp, fontSize: '0.72rem' }}
                        value={nd[k] ?? (k === 'step' ? 1 : k === 'min' ? 0 : 100)}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value)
                          if (!isNaN(v)) update({ [k]: v })
                        }}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Per-port inputs (operation nodes) */}
            {def && def.inputs.length > 0 && (
              <div style={{ marginBottom: '0.7rem' }}>
                <span style={fieldLabel}>Inputs</span>
                {def.inputs.map((port) => {
                  const connected = isPortConnected(port.id)
                  const override = portOverrides[port.id] === true
                  const showInput = !connected || override

                  return (
                    <div
                      key={port.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        marginBottom: '0.4rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'rgba(244,244,243,0.6)',
                          width: 40,
                          flexShrink: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {port.label}
                      </span>
                      {showInput ? (
                        <div style={{ flex: 1 }}>
                          <ValueEditor
                            binding={ensureBinding(inputBindings, manualValues, port.id)}
                            onChange={(b) => updateBinding(port.id, b)}
                            override={override}
                          />
                        </div>
                      ) : (
                        <span
                          style={{
                            flex: 1,
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            color: '#1CABB0',
                            padding: '0.28rem 0.45rem',
                          }}
                        >
                          ▶ connected
                        </span>
                      )}
                      {connected && (
                        <button
                          onClick={() => toggleOverride(port.id)}
                          title={override ? 'Use connected value' : 'Override with manual value'}
                          style={{
                            width: 22,
                            height: 22,
                            padding: 0,
                            flexShrink: 0,
                            background: override ? 'rgba(28,171,176,0.15)' : 'transparent',
                            border: `1px solid ${override ? '#1CABB0' : 'rgba(255,255,255,0.15)'}`,
                            borderRadius: 4,
                            color: override ? '#1CABB0' : 'rgba(255,255,255,0.35)',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                            fontFamily: 'inherit',
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
              </div>
            )}

            {/* Explain this value — P037 ─────────────────────────────── */}
            {/* Show connected input values (upstream sources + resolved value) */}
            {def &&
              def.inputs.length > 0 &&
              (() => {
                const connectedPorts = def.inputs.filter((port) =>
                  allEdges.some((e) => e.target === node.id && e.targetHandle === port.id),
                )
                if (connectedPorts.length === 0) return null
                return (
                  <div style={{ marginBottom: '0.7rem' }}>
                    <span style={fieldLabel}>Input values</span>
                    {connectedPorts.map((port) => {
                      const edge = allEdges.find(
                        (e) => e.target === node.id && e.targetHandle === port.id,
                      )
                      if (!edge) return null
                      const srcNode = allNodes.find((n) => n.id === edge.source)
                      const srcLabel =
                        (srcNode?.data as NodeData | undefined)?.label ??
                        (srcNode?.data as NodeData | undefined)?.blockType ??
                        edge.source
                      const srcValue = computed.get(edge.source)
                      return (
                        <div
                          key={port.id}
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: '0.35rem',
                            marginBottom: '0.25rem',
                            fontSize: '0.72rem',
                          }}
                        >
                          <span
                            style={{
                              color: 'rgba(244,244,243,0.5)',
                              width: 40,
                              flexShrink: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {port.label}
                          </span>
                          <span
                            style={{
                              color: 'rgba(244,244,243,0.4)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                            }}
                            title={String(srcLabel)}
                          >
                            ← {srcLabel}
                          </span>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              color: '#1CABB0',
                              flexShrink: 0,
                            }}
                          >
                            {srcValue !== undefined ? formatValue(srcValue) : '—'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

            {/* Trace timing — show if trace mode captured data for this node */}
            {(() => {
              const traceData: TraceEntry[] | null = engine.getLastTrace()
              const entry = traceData?.find((t) => t.nodeId === node.id) ?? null
              if (!entry) return null

              function summariseValue(v: TraceEntry['output']): string {
                if (v.kind === 'scalar')
                  return String(isFinite(v.value) ? v.value : v.value > 0 ? '+∞' : '−∞')
                if (v.kind === 'vector') return `vector[${v.length}]`
                if (v.kind === 'table') return `table(${v.rows}×${v.columns})`
                return v.message.slice(0, 40)
              }

              return (
                <div style={{ marginBottom: '0.7rem' }}>
                  <span style={fieldLabel}>Trace</span>
                  {Object.entries(entry.inputs).map(([portId, summary]) => (
                    <div
                      key={portId}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '0.35rem',
                        marginBottom: '0.2rem',
                        fontSize: '0.72rem',
                      }}
                    >
                      <span
                        style={{
                          color: 'rgba(244,244,243,0.5)',
                          width: 40,
                          flexShrink: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {portId}
                      </span>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          color: 'rgba(244,244,243,0.55)',
                          flex: 1,
                        }}
                      >
                        {summariseValue(summary)}
                      </span>
                    </div>
                  ))}
                  <div
                    style={{
                      marginTop: '0.25rem',
                      fontSize: '0.68rem',
                      display: 'flex',
                      gap: '0.35rem',
                    }}
                  >
                    <span style={{ color: 'rgba(244,244,243,0.35)' }}>out</span>
                    <span style={{ fontFamily: 'monospace', color: '#1CABB0' }}>
                      {summariseValue(entry.output)}
                    </span>
                  </div>
                </div>
              )
            })()}
            {/* ───────────────────────────────────────────────────────────── */}

            {/* Plot inspector (csPlot nodes) */}
            {def?.nodeKind === 'csPlot' &&
              (() => {
                const dataEdge = allEdges.find(
                  (e) => e.target === node.id && e.targetHandle === 'data',
                )
                const inputValue = dataEdge ? computed.get(dataEdge.source) : undefined
                const plotConfig: PlotConfig = (nd.plotConfig as PlotConfig) ?? {
                  chartType: 'xyLine',
                }
                return (
                  <PlotInspector
                    config={plotConfig}
                    inputValue={inputValue}
                    onUpdate={(patch) => update({ plotConfig: { ...plotConfig, ...patch } })}
                  />
                )
              })()}

            {/* Validation warning (G4-1) */}
            {isErrVal &&
              (() => {
                const errMsg = extractErrorMessage(value)
                if (!errMsg) return null
                return (
                  <div
                    style={{
                      marginBottom: '0.5rem',
                      padding: '0.35rem 0.5rem',
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 6,
                      fontSize: '0.7rem',
                      color: '#f87171',
                      lineHeight: 1.4,
                    }}
                  >
                    {errMsg}
                  </div>
                )
              })()}

            {/* Output value */}
            <div
              style={{
                background: isErrVal || isInfVal ? 'rgba(239,68,68,0.08)' : 'rgba(28,171,176,0.08)',
                border: `1px solid ${isErrVal || isInfVal ? 'rgba(239,68,68,0.25)' : 'rgba(28,171,176,0.25)'}`,
                borderRadius: 8,
                padding: '0.6rem',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: isErrVal || isInfVal ? '#f87171' : '#1CABB0',
                }}
              >
                {formatValue(value)}
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  color: 'rgba(244,244,243,0.35)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                output
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
