/**
 * Inspector — right panel that shows properties for the inspected node.
 *
 * Opens via onNodeClick (not drag). Closed with ESC, onClose(), or pane click.
 * Uses useNodes() internally so data stays in sync without prop-drilling.
 * Shows per-port manual value + override toggle for operation nodes.
 */

import { lazy, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MousePointer } from 'lucide-react'
import { useNodes, useEdges, useReactFlow } from '@xyflow/react'
import { useComputed } from '../../contexts/ComputedContext'
import { useEngine } from '../../contexts/EngineContext'
import { isError, isScalar, type Value } from '../../engine/value'
import { useFormatValue } from '../../hooks/useFormatValue'
import { BLOCK_REGISTRY, getTaxonomyLabels, type NodeData } from '../../blocks/registry'
import type { InputBinding, PlotConfig } from '../../blocks/types'
import type { TraceEntry } from '../../engine/index.ts'
import { ensureBinding } from '../../lib/migrateBindings'
import { getDocsSectionForCategory } from '../../lib/docsHelpers'
import { HelpLink } from '../ui/HelpLink'
import { ValueEditor } from './editors/ValueEditor'
import { getUnitSymbol } from '../../units/unitSymbols'
import { getDimension } from '../../units/unitCompat'
import { PlotInspector } from './PlotInspector'
import { GroupInspector } from './GroupInspector'
import { AnnotationInspector } from './nodes/AnnotationInspector'
import { buildExpressionTree, renderExpressionText } from '../../lib/expressionExtractor'
import {
  matchHighPrecisionConstant,
  loadFullPrecisionDigits,
} from '../../lib/highPrecisionConstants'

const LazyUnitPicker = lazy(() =>
  import('./editors/UnitPicker').then((m) => ({ default: m.UnitPicker })),
)

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
  color: 'var(--text)',
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
  const { t } = useTranslation()
  const allNodes = useNodes()
  const allEdges = useEdges()
  const { updateNodeData } = useReactFlow()
  const computed = useComputed()
  const engine = useEngine()

  const formatValue = useFormatValue()
  const node = nodeId ? (allNodes.find((n) => n.id === nodeId) ?? null) : null
  const nd = node?.data as NodeData | undefined

  // 4.04: Derive suggested unit dimension from connected upstream nodes
  const suggestedDimension = (() => {
    if (!nodeId) return undefined
    for (const edge of allEdges) {
      if (edge.target !== nodeId) continue
      const srcNode = allNodes.find((n) => n.id === edge.source)
      const srcData = srcNode?.data as NodeData | undefined
      const srcUnit = srcData?.unit as string | undefined
      if (srcUnit) {
        const dim = getDimension(srcUnit)
        if (dim) return dim
      }
    }
    return undefined
  })()

  // G4-1: Lazy-load block descriptions to avoid bloating the initial bundle
  const [descriptions, setDescriptions] = useState<Record<string, string>>({})
  useEffect(() => {
    import('../../blocks/blockDescriptions').then((m) => setDescriptions(m.BLOCK_DESCRIPTIONS))
  }, [])

  // UX-08: What-if explorer state — tracks active temporary override per node
  const [whatIfState, setWhatIfState] = useState<{
    nodeId: string
    portId: string
    value: number
  } | null>(null)
  // Derived: only active when the current node matches
  const whatIfActive = whatIfState?.nodeId === nodeId ? whatIfState : null

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
        background: 'var(--surface-1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }
    : {
        width,
        flexShrink: 0,
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface-1)',
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
          <MousePointer size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
          <div>{t('inspector.empty')}</div>
          <div
            style={{
              marginTop: '0.35rem',
              fontSize: '0.72rem',
              opacity: 0.6,
            }}
          >
            {t('inspector.emptyHint')}
          </div>
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
  const isAnnotation = nd.annotationType !== undefined
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
          {def && <HelpLink section={getDocsSectionForCategory(def.category)} />}
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
            title={`${t('ui.close')} (ESC)`}
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
        ) : isAnnotation ? (
          <AnnotationInspector data={nd} onUpdate={update} />
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

            {/* PREC-02: Per-node display precision override (Display nodes only) */}
            {def?.nodeKind === 'csDisplay' &&
              field(
                'Display precision',
                <select
                  style={{ ...inp, cursor: 'pointer' }}
                  value={nd.displayPrecision ?? 'global'}
                  onChange={(e) => update({ displayPrecision: e.target.value })}
                >
                  <option value="global">Global (use settings)</option>
                  <option value="integer">Integer (0 dp)</option>
                  <option value="2dp">2 decimal places</option>
                  <option value="4dp">4 decimal places</option>
                  <option value="8dp">8 decimal places</option>
                  <option value="15dp">15 decimal places</option>
                  <option value="scientific">Scientific notation</option>
                  <option value="sig_figs_3">3 significant figures</option>
                  <option value="sig_figs_6">6 significant figures</option>
                </select>,
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

            {/* UX-08: Formula expression — symbolic form for operation nodes */}
            {def?.nodeKind === 'csOperation' &&
              (() => {
                try {
                  const tree = buildExpressionTree(
                    node.id,
                    allNodes as Parameters<typeof buildExpressionTree>[1],
                    allEdges,
                    computed,
                  )
                  if (!tree) return null
                  const exprText = renderExpressionText(tree)
                  if (!exprText || exprText === nd.blockType || exprText === nd.label) return null
                  return (
                    <div style={{ marginBottom: '0.7rem' }}>
                      <span style={fieldLabel}>Formula</span>
                      <div
                        style={{
                          padding: '0.35rem 0.5rem',
                          background: 'rgba(28,171,176,0.06)',
                          border: '1px solid rgba(28,171,176,0.15)',
                          borderRadius: 6,
                          fontFamily: 'ui-monospace, "Cascadia Code", monospace',
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          lineHeight: 1.5,
                          wordBreak: 'break-all',
                        }}
                      >
                        = {exprText}
                      </div>
                    </div>
                  )
                } catch {
                  return null
                }
              })()}

            {/* H1-1: Unit picker — available for source, operation, display, and data nodes */}
            {def?.nodeKind !== 'csPlot' &&
              field(
                t('units.unit'),
                <Suspense fallback={null}>
                  <LazyUnitPicker
                    value={nd.unit as string | undefined}
                    onChange={(unitId) => update({ unit: unitId })}
                    suggestedDimension={suggestedDimension}
                  />
                </Suspense>,
              )}

            {/* 4.09: Accent color picker */}
            {field(
              t('inspector.accentColor', 'Accent Color'),
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="color"
                  style={{ width: 28, height: 22, padding: 0, border: 'none', cursor: 'pointer', background: 'none' }}
                  value={(nd.userColor as string) ?? '#1cabb0'}
                  onChange={(e) => update({ userColor: e.target.value })}
                  title={t('inspector.accentColor', 'Accent Color')}
                />
                {nd.userColor && (
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.65rem' }}
                    onClick={() => update({ userColor: undefined })}
                  >
                    {t('inspector.resetColor', 'Reset')}
                  </button>
                )}
              </div>,
            )}

            {/* 4.09: Node notes field */}
            {field(
              t('inspector.notes', 'Notes'),
              <textarea
                style={{
                  ...inp,
                  width: '100%',
                  minHeight: 40,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  fontSize: '0.72rem',
                }}
                value={(nd.nodeNotes as string) ?? ''}
                onChange={(e) => update({ nodeNotes: e.target.value || undefined })}
                placeholder={t('inspector.notesPlaceholder', 'Add notes about this block...')}
              />,
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
                      <span
                        style={{
                          fontFamily: 'monospace',
                          color: 'var(--primary)',
                          fontWeight: 700,
                        }}
                      >
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

            {/* 4.08: Table output mode selector */}
            {nd.blockType === 'tableInput' && (
              <div style={{ marginBottom: '0.7rem' }}>
                <span style={fieldLabel}>{t('inspector.tableOutputMode', 'Output Mode')}</span>
                <select
                  style={{ ...inp, width: '100%' }}
                  value={(nd.tableOutputMode as string) ?? 'columns'}
                  onChange={(e) => update({ tableOutputMode: e.target.value })}
                  title={t('inspector.tableOutputMode', 'Output Mode')}
                >
                  <option value="columns">{t('inspector.tableMode.columns', 'All Columns (one port each)')}</option>
                  <option value="table">{t('inspector.tableMode.table', 'Entire Table')}</option>
                  <option value="column">{t('inspector.tableMode.column', 'Single Column')}</option>
                  <option value="row">{t('inspector.tableMode.row', 'Single Row')}</option>
                </select>
                {(nd.tableOutputMode as string) === 'column' && (() => {
                  const td = (nd.tableData as { columns: string[] } | undefined)
                  return (
                    <select
                      style={{ ...inp, width: '100%', marginTop: 4 }}
                      value={nd.tableOutputCol ?? 0}
                      onChange={(e) => update({ tableOutputCol: parseInt(e.target.value, 10) })}
                      title={t('inspector.tableOutputCol', 'Select column')}
                    >
                      {(td?.columns ?? []).map((col, ci) => (
                        <option key={ci} value={ci}>{col}</option>
                      ))}
                    </select>
                  )
                })()}
                {(nd.tableOutputMode as string) === 'row' && (
                  <input
                    type="number"
                    style={{ ...monoInp, width: '100%', marginTop: 4 }}
                    min={0}
                    value={nd.tableOutputRow ?? 0}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      if (!isNaN(v) && v >= 0) update({ tableOutputRow: v })
                    }}
                    placeholder="Row index (0-based)"
                  />
                )}
              </div>
            )}

            {/* Per-port inputs (operation nodes) */}
            {def && def.inputs.length > 0 && (
              <div style={{ marginBottom: '0.7rem' }}>
                <span style={fieldLabel}>{t('inspector.inputsLabel')}</span>
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
                            color: 'var(--primary)',
                            padding: '0.28rem 0.45rem',
                          }}
                        >
                          ▶ connected
                        </span>
                      )}
                      {connected && (
                        <button
                          onClick={() => toggleOverride(port.id)}
                          title={
                            override
                              ? t('canvas.useConnectedValue')
                              : t('canvas.overrideWithManual')
                          }
                          style={{
                            width: 22,
                            height: 22,
                            padding: 0,
                            flexShrink: 0,
                            background: override ? 'rgba(28,171,176,0.15)' : 'transparent',
                            border: `1px solid ${override ? 'var(--primary)' : 'rgba(255,255,255,0.15)'}`,
                            borderRadius: 4,
                            color: override ? 'var(--primary)' : 'rgba(255,255,255,0.35)',
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
                    <span style={fieldLabel}>{t('canvas.inputValues')}</span>
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
                              color: 'var(--primary)',
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

            {/* UX-08: Downstream chain — which nodes consume this output */}
            {(() => {
              const downEdges = allEdges.filter((e) => e.source === node.id)
              if (downEdges.length === 0) return null
              const seen = new Set<string>()
              const downstream = downEdges
                .map((e) => allNodes.find((n) => n.id === e.target))
                .filter((n): n is NonNullable<typeof n> => {
                  if (!n || seen.has(n.id)) return false
                  seen.add(n.id)
                  return true
                })
              if (downstream.length === 0) return null
              return (
                <div style={{ marginBottom: '0.7rem' }}>
                  <span style={fieldLabel}>Feeding into</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {downstream.map((n) => (
                      <span
                        key={n.id}
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.45rem',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 4,
                          color: 'var(--text-muted)',
                        }}
                      >
                        → {(n.data as NodeData).label || (n.data as NodeData).blockType}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* UX-08: What-if explorer — slider to temporarily override a connected input */}
            {def &&
              def.inputs.length > 0 &&
              nodeId &&
              (() => {
                const scalarConnected = def.inputs.filter((port) => {
                  if (!allEdges.some((e) => e.target === node.id && e.targetHandle === port.id))
                    return false
                  const edge = allEdges.find(
                    (e) => e.target === node.id && e.targetHandle === port.id,
                  )
                  const val = edge ? computed.get(edge.source) : undefined
                  return val !== undefined && isScalar(val) && isFinite(val.value)
                })
                if (scalarConnected.length === 0) return null
                return (
                  <div style={{ marginBottom: '0.7rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <span style={fieldLabel}>What-if</span>
                      {whatIfActive && (
                        <button
                          onClick={() => {
                            if (portOverrides[whatIfActive.portId]) {
                              toggleOverride(whatIfActive.portId)
                            }
                            setWhatIfState(null)
                          }}
                          style={{
                            fontSize: '0.6rem',
                            padding: '1px 6px',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: 3,
                            color: 'rgba(244,244,243,0.5)',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    {scalarConnected.map((port) => {
                      const edge = allEdges.find(
                        (e) => e.target === node.id && e.targetHandle === port.id,
                      )!
                      const srcVal = computed.get(edge.source)!
                      const connectedNum = isScalar(srcVal) ? srcVal.value : 0
                      const isActive = whatIfActive?.portId === port.id
                      const absVal = Math.abs(connectedNum) || 1
                      const sliderMin = connectedNum - absVal * 2
                      const sliderMax = connectedNum + absVal * 2
                      return (
                        <div key={port.id} style={{ marginBottom: '0.35rem' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.72rem',
                              marginBottom: isActive ? '0.2rem' : 0,
                            }}
                          >
                            <span style={{ color: 'rgba(244,244,243,0.5)', flexShrink: 0 }}>
                              {port.label}
                            </span>
                            {!isActive ? (
                              <button
                                onClick={() => {
                                  setWhatIfState({
                                    nodeId: nodeId,
                                    portId: port.id,
                                    value: connectedNum,
                                  })
                                  if (!portOverrides[port.id]) toggleOverride(port.id)
                                  updateBinding(port.id, { kind: 'literal', value: connectedNum })
                                }}
                                style={{
                                  fontSize: '0.6rem',
                                  padding: '1px 6px',
                                  background: 'transparent',
                                  border: '1px solid rgba(28,171,176,0.4)',
                                  borderRadius: 3,
                                  color: 'var(--primary)',
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                }}
                              >
                                Try →
                              </button>
                            ) : (
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  color: 'var(--primary)',
                                  marginLeft: 'auto',
                                }}
                              >
                                {whatIfActive.value.toPrecision(5)}
                              </span>
                            )}
                          </div>
                          {isActive && (
                            <input
                              type="range"
                              min={sliderMin}
                              max={sliderMax}
                              step={(sliderMax - sliderMin) / 200}
                              value={whatIfActive.value}
                              style={{ width: '100%', accentColor: 'var(--primary)' }}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value)
                                setWhatIfState({ nodeId: nodeId, portId: port.id, value: v })
                                updateBinding(port.id, { kind: 'literal', value: v })
                              }}
                            />
                          )}
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
                if (v.kind === 'text') return `"${v.value.slice(0, 40)}"`
                return v.message.slice(0, 40)
              }

              return (
                <div style={{ marginBottom: '0.7rem' }}>
                  <span style={fieldLabel}>{t('canvas.traceLabel')}</span>
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
                    <span style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>
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

            {/* UX-08: Predictive warnings based on current input values */}
            {def &&
              (() => {
                const warnings: string[] = []
                // Division by zero
                if (nd.blockType === 'divide' || nd.blockType === 'modulo') {
                  const denomEdge = allEdges.find(
                    (e) => e.target === node.id && e.targetHandle === 'B',
                  )
                  const denomVal = denomEdge ? computed.get(denomEdge.source) : undefined
                  if (denomVal && isScalar(denomVal) && Math.abs(denomVal.value) < 1e-10) {
                    warnings.push('Divisor is near zero — result may be ±Infinity')
                  }
                }
                // Log of non-positive
                if (['log', 'log10', 'ln'].includes(nd.blockType)) {
                  const inEdge = allEdges.find(
                    (e) =>
                      e.target === node.id &&
                      (e.targetHandle === 'A' || e.targetHandle === 'x' || e.targetHandle === 'in'),
                  )
                  const inVal = inEdge ? computed.get(inEdge.source) : undefined
                  if (inVal && isScalar(inVal) && inVal.value <= 0) {
                    warnings.push(
                      `Log input is ${inVal.value < 0 ? 'negative' : 'zero'} — result is NaN`,
                    )
                  }
                }
                // Sqrt of negative
                if (nd.blockType === 'sqrt') {
                  const inEdge = allEdges.find((e) => e.target === node.id)
                  const inVal = inEdge ? computed.get(inEdge.source) : undefined
                  if (inVal && isScalar(inVal) && inVal.value < 0) {
                    warnings.push('Input is negative — sqrt returns NaN for real inputs')
                  }
                }
                // Infinity in output
                if (isInfVal) {
                  warnings.push('Output is Infinity — check for unbounded computation')
                }
                if (warnings.length === 0) return null
                return (
                  <>
                    {warnings.map((w, i) => (
                      <div
                        key={i}
                        style={{
                          marginBottom: '0.35rem',
                          padding: '0.3rem 0.5rem',
                          background: 'rgba(251,191,36,0.07)',
                          border: '1px solid rgba(251,191,36,0.25)',
                          borderRadius: 6,
                          fontSize: '0.7rem',
                          color: '#fbbf24',
                          lineHeight: 1.4,
                        }}
                      >
                        ⚠ {w}
                      </div>
                    ))}
                  </>
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
                      color: 'var(--danger-text)',
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
                  color: isErrVal || isInfVal ? 'var(--danger-text)' : 'var(--primary)',
                }}
              >
                {formatValue(value)}
                {nd.unit && (
                  <span style={{ fontSize: '0.8rem', marginLeft: '0.2rem', opacity: 0.7 }}>
                    {getUnitSymbol(nd.unit)}
                  </span>
                )}
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
            {/* 4.01: Copy full precision for matched constants */}
            {value !== undefined &&
              isScalar(value) &&
              matchHighPrecisionConstant(value.value) !== null && (
                <button
                  type="button"
                  style={{
                    marginTop: 6,
                    width: '100%',
                    padding: '0.35rem 0.6rem',
                    fontSize: '0.7rem',
                    fontFamily: 'inherit',
                    fontWeight: 500,
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                  onClick={async () => {
                    if (!isScalar(value)) return
                    await loadFullPrecisionDigits()
                    const c = matchHighPrecisionConstant(value.value)
                    if (c) {
                      navigator.clipboard.writeText(c.digits).catch(() => {})
                    }
                  }}
                  title={`Copy ${matchHighPrecisionConstant(isScalar(value) ? value.value : 0)?.name ?? 'constant'} to full precision`}
                >
                  {t('inspector.copyFullPrecision', 'Copy full precision (10,000 digits)')}
                </button>
              )}
          </>
        )}
      </div>
    </div>
  )
}
