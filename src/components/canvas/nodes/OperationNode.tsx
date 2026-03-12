/**
 * OperationNode — math/trig/logic blocks with N inputs and 1 output.
 *
 * Features:
 * - Inline number input on unconnected or overridden ports.
 * - Override toggle button when a port is connected (pin icon).
 * - isValidConnection on each Handle: blocks 2nd edge to same input.
 * - useEdges() for live connection state without prop-drilling.
 */

import type { CSSProperties } from 'react'
import { memo, useCallback, useMemo, lazy, Suspense } from 'react'
import {
  Handle,
  Position,
  useEdges,
  useReactFlow,
  type NodeProps,
  type IsValidConnection,
} from '@xyflow/react'
import { useComputedValue } from '../../../contexts/ComputedContext'
import { useShowValuePopover } from '../../../contexts/ValuePopoverContext'
import { formatValue, isError } from '../../../engine/value'
import { BLOCK_REGISTRY, type NodeData } from '../../../blocks/registry'
import type { InputBinding } from '../../../blocks/types'
import { useTranslation } from 'react-i18next'
import { ensureBinding } from '../../../lib/migrateBindings'
import { ValueEditor } from '../editors/ValueEditor'
import { getUnitSymbol } from '../../../units/unitSymbols'
import { getConversionFactor, areSameDimension } from '../../../units/unitCompat'
import { NODE_STYLES as s, userColorBg } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'
import { useValueFlash } from '../../../hooks/useValueFlash'
import { getPortUnitHint } from '../../../blocks/portUnitHints'
import { usePreferencesStore } from '../../../stores/preferencesStore'

// SCI-06: Trig ops that are affected by the angle unit preference.
// Forward trig (sin/cos/tan): input is an angle.
// Inverse trig (asin/acos/atan/atan2): output is an angle.
const FORWARD_TRIG_OPS = new Set(['sin', 'cos', 'tan'])
const INVERSE_TRIG_OPS = new Set(['asin', 'acos', 'atan', 'atan2'])
const ANGLE_UNIT_OPS = new Set([...FORWARD_TRIG_OPS, ...INVERSE_TRIG_OPS])

const LazyUnitPicker = lazy(() =>
  import('../editors/UnitPicker').then((m) => ({ default: m.UnitPicker })),
)

function OperationNodeInner({ id, data, selected, draggable }: NodeProps) {
  const nd = data as NodeData
  const { updateNodeData } = useReactFlow()
  const allEdges = useEdges()
  const value = useComputedValue(id)
  const showPopover = useShowValuePopover()
  const { t } = useTranslation()
  const flashing = useValueFlash(value)
  const isLocked = draggable === false
  // SCI-06: Angle unit preference for trig block badge display.
  const angleUnit = usePreferencesStore((s) => s.angleUnit)

  const def = BLOCK_REGISTRY.get(nd.blockType)
  const inputs = def?.inputs ?? []

  // SCI-06: Whether this block is angle-unit-sensitive.
  const isTrigBlock = ANGLE_UNIT_OPS.has(nd.blockType)
  const isForwardTrig = FORWARD_TRIG_OPS.has(nd.blockType)
  // Badge label: show current angle unit indicator when trig block.
  const angleUnitBadge = isTrigBlock ? (angleUnit === 'deg' ? '°' : 'rad') : null

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

  const isConvert = nd.blockType === 'unit_convert'
  const fromUnit = (nd.fromUnit as string | undefined) ?? undefined
  const toUnit = (nd.toUnit as string | undefined) ?? undefined

  const handleFromUnitChange = useCallback(
    (unitId: string | undefined) => {
      const factor = unitId && toUnit ? getConversionFactor(unitId, toUnit) : undefined
      const label =
        unitId && toUnit ? `${getUnitSymbol(unitId)} -> ${getUnitSymbol(toUnit)}` : 'Unit Convert'
      updateNodeData(id, {
        fromUnit: unitId,
        convFactor: factor ?? 1,
        label,
      })
    },
    [id, toUnit, updateNodeData],
  )

  const handleToUnitChange = useCallback(
    (unitId: string | undefined) => {
      const factor = fromUnit && unitId ? getConversionFactor(fromUnit, unitId) : undefined
      const label =
        fromUnit && unitId
          ? `${getUnitSymbol(fromUnit)} -> ${getUnitSymbol(unitId)}`
          : 'Unit Convert'
      updateNodeData(id, {
        toUnit: unitId,
        unit: unitId,
        convFactor: factor ?? 1,
        label,
      })
    },
    [id, fromUnit, updateNodeData],
  )

  const ROW_H = 30
  const CONVERT_EXTRA = isConvert ? 58 : 0
  const bodyH = Math.max(inputs.length * ROW_H, 36) + CONVERT_EXTRA

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)
  const isErr = value !== undefined && isError(value)
  const errorMsg = isErr ? value.message : ''

  const borderOverride = isErr
    ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 1px var(--danger)' }
    : selected
      ? { ...s.nodeSelected, borderColor: typeColor }
      : {}

  const ariaLabel = `${nd.label} block, output: ${formatValue(value)}`

  return (
    <div
      style={{ ...s.node, ...userColorBg(nd.userColor), ...borderOverride }}
      role="group"
      aria-label={ariaLabel}
    >
      <div
        style={{
          ...s.header,
          borderBottom: `2px solid color-mix(in srgb, ${typeColor} 30%, transparent)`,
          background: `linear-gradient(to right, color-mix(in srgb, ${typeColor} 6%, transparent), transparent)`,
        }}
      >
        <div className="cs-node-header-left" style={s.headerLeft}>
          <Icon icon={TypeIcon} size={14} style={{ ...s.headerIcon, color: typeColor }} />
          <span style={s.headerLabel}>{nd.label}</span>
          {/* SCI-06: Angle unit badge on trig blocks */}
          {angleUnitBadge && (
            <span
              title={
                isForwardTrig
                  ? angleUnit === 'deg'
                    ? 'Input in degrees (auto-converted to radians)'
                    : 'Input in radians'
                  : angleUnit === 'deg'
                    ? 'Output in degrees (auto-converted from radians)'
                    : 'Output in radians'
              }
              style={{
                fontSize: '0.58rem',
                fontWeight: 700,
                padding: '0.05rem 0.3rem',
                borderRadius: 3,
                background: angleUnit === 'deg' ? 'rgba(251,191,36,0.2)' : 'rgba(99,179,237,0.15)',
                color: angleUnit === 'deg' ? 'rgb(251,191,36)' : 'rgb(99,179,237)',
                border:
                  angleUnit === 'deg'
                    ? '1px solid rgba(251,191,36,0.4)'
                    : '1px solid rgba(99,179,237,0.3)',
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {angleUnitBadge}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {isLocked && <span style={{ fontSize: '0.6rem', lineHeight: 1, opacity: 0.7 }}>🔒</span>}
          {isErr && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--danger)',
                flexShrink: 0,
              }}
            />
          )}
          <span
            className={`cs-node-header-value cs-value-badge nodrag${flashing ? ' cs-flashing' : ''}`}
            style={{ ...s.headerValue, color: typeColor, cursor: 'pointer' }}
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

              <span style={s.portLabel}>
                {port.label}
                {(() => {
                  const hint = getPortUnitHint(nd.blockType, port.id)
                  return hint ? (
                    <span
                      style={{
                        fontSize: '0.58rem',
                        color: 'var(--text-faint)',
                        marginLeft: '0.2rem',
                      }}
                    >
                      {hint}
                    </span>
                  ) : null
                })()}
              </span>

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
                    color: 'var(--primary)',
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
                  title={override ? t('canvas.useConnectedValue') : t('canvas.overrideWithManual')}
                  style={{
                    width: 16,
                    height: 16,
                    padding: 0,
                    marginLeft: 2,
                    flexShrink: 0,
                    background: override ? 'rgba(28,171,176,0.2)' : 'transparent',
                    border: `1px solid ${override ? 'var(--primary)' : 'rgba(255,255,255,0.15)'}`,
                    borderRadius: 3,
                    color: override ? 'var(--primary)' : 'rgba(255,255,255,0.35)',
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

        {/* H1-3: Dual unit pickers for unit_convert block */}
        {isConvert && (
          <div
            className="nodrag"
            style={{
              position: 'absolute',
              bottom: 4,
              left: 8,
              right: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={convertLabelStyle}>{t('unitConvert.from')}</span>
              <Suspense fallback={null}>
                <LazyUnitPicker compact value={fromUnit} onChange={handleFromUnitChange} />
              </Suspense>
              {fromUnit && toUnit && !areSameDimension(fromUnit, toUnit) && (
                <span style={{ fontSize: '0.55rem', color: 'var(--danger-text)' }}>!</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={convertLabelStyle}>{t('unitConvert.to')}</span>
              <Suspense fallback={null}>
                <LazyUnitPicker compact value={toUnit} onChange={handleToUnitChange} />
              </Suspense>
            </div>
          </div>
        )}

        {/* Output handle — right edge, vertically centred */}
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          style={{ ...s.handleRight, top: '50%', transform: 'translateY(-50%)' }}
        />
      </div>
      {isErr && errorMsg && (
        <div style={s.errorFooter} title={errorMsg}>
          {errorMsg}
        </div>
      )}
    </div>
  )
}

const convertLabelStyle: CSSProperties = {
  fontSize: '0.58rem',
  color: 'rgba(244,244,243,0.45)',
  minWidth: 26,
  textAlign: 'right',
}

export const OperationNode = memo(OperationNodeInner)
