/**
 * AssertionNode — 2.130: Runtime assertion / validation block.
 *
 * Reads its `value` input and checks:
 *   - Not NaN (unless allowNan is true)
 *   - Not ±Infinity (unless allowInf is true)
 *   - value ≥ min (if min is set)
 *   - value ≤ max (if max is set)
 *
 * Displays ✓ PASS (green) or ✗ FAIL (red) with the failure reason.
 * The engine receives this block as a `display` pass-through (bridge.ts remap).
 */

import { memo, useCallback, useMemo } from 'react'
import { Handle, Position, useEdges, useReactFlow, type NodeProps } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { useComputedValue } from '../../../contexts/ComputedContext'
import { isScalar } from '../../../engine/value'
import type { NodeData } from '../../../blocks/types'
import { NODE_STYLES as s } from './nodeStyles'
import { getNodeTypeColor, getNodeTypeIcon } from './nodeTypeColors'
import { Icon } from '../../ui/Icon'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssertionNodeData extends NodeData {
  min?: number | null
  max?: number | null
  allowNan?: boolean
  allowInf?: boolean
  message?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (!isFinite(n)) return String(n)
  if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-3 && n !== 0)) return n.toExponential(4)
  return n.toPrecision(6).replace(/\.?0+$/, '')
}

interface AssertResult {
  pass: boolean
  value: number
  reason: string
}

function runAssertion(
  value: number,
  min: number | null | undefined,
  max: number | null | undefined,
  allowNan: boolean,
  allowInf: boolean,
): { pass: true } | { pass: false; reason: string } {
  if (isNaN(value)) {
    return allowNan ? { pass: true } : { pass: false, reason: 'value is NaN' }
  }
  if (!isFinite(value)) {
    return allowInf ? { pass: true } : { pass: false, reason: `value is ${value > 0 ? '+' : '-'}Infinity` }
  }
  if (min != null && value < min) {
    return { pass: false, reason: `${fmtNum(value)} < min ${fmtNum(min)}` }
  }
  if (max != null && value > max) {
    return { pass: false, reason: `${fmtNum(value)} > max ${fmtNum(max)}` }
  }
  return { pass: true }
}

// ── Component ─────────────────────────────────────────────────────────────────

function AssertionNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as AssertionNodeData
  const edges = useEdges()
  const { updateNodeData } = useReactFlow()

  const min: number | null = nd.min ?? null
  const max: number | null = nd.max ?? null
  const allowNan = nd.allowNan ?? false
  const allowInf = nd.allowInf ?? false

  // Read the computed value from upstream block
  const inputEdge = edges.find((e) => e.target === id && e.targetHandle === 'value')
  const sourceId = inputEdge?.source ?? ''
  const computedValue = useComputedValue(sourceId)

  const assertResult = useMemo((): AssertResult | null => {
    if (!computedValue || !isScalar(computedValue)) return null
    const val = computedValue.value
    const result = runAssertion(val, min, max, allowNan, allowInf)
    return result.pass
      ? { pass: true, value: val, reason: '' }
      : { pass: false, value: val, reason: result.reason }
  }, [computedValue, min, max, allowNan, allowInf])

  const updateField = useCallback(
    (patch: Partial<AssertionNodeData>) => updateNodeData(id, patch),
    [id, updateNodeData],
  )

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const passColor = '#22c55e'
  const failColor = '#ef4444'
  const statusColor =
    assertResult === null ? 'var(--muted)' : assertResult.pass ? passColor : failColor
  const statusIcon = assertResult === null ? '—' : assertResult.pass ? '✓' : '✗'
  const statusLabel =
    assertResult === null
      ? t('assertion.noValue', 'No value')
      : assertResult.pass
        ? t('assertion.pass', 'PASS')
        : t('assertion.fail', 'FAIL')

  return (
    <div
      style={{
        ...s.node,
        minWidth: 180,
        ...(selected ? { ...s.nodeSelected, borderColor: typeColor } : {}),
        borderColor: assertResult !== null ? statusColor + '88' : undefined,
        boxShadow: assertResult !== null ? `0 0 0 1px ${statusColor}33` : undefined,
      }}
      role="group"
      aria-label={`${nd.label} assertion, ${statusLabel}`}
    >
      <div
        style={{
          ...s.header,
          borderBottom: `2px solid ${statusColor}44`,
          background: `linear-gradient(to right, ${statusColor}0a, transparent)`,
        }}
      >
        <div className="cs-node-header-left" style={s.headerLeft}>
          <Icon icon={TypeIcon} size={14} style={{ ...s.headerIcon, color: typeColor }} />
          <span style={s.headerLabel}>{nd.label}</span>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: statusColor,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.05em',
          }}
        >
          {statusIcon} {statusLabel}
        </span>
      </div>

      <div className="cs-node-body" style={{ ...s.body, padding: '0.5rem 0.6rem' }}>
        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="value"
          style={{ ...s.handleLeft, top: '50%', transform: 'translateY(-50%)' }}
        />

        {/* Current value display */}
        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: 4 }}>
          {t('assertion.value', 'Value')}:{' '}
          <span style={{ color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
            {assertResult !== null ? fmtNum(assertResult.value) : '—'}
          </span>
        </div>

        {/* Min bound */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)', width: 28, flexShrink: 0 }}>
            {t('assertion.min', 'Min')}:
          </span>
          <input
            type="number"
            value={min ?? ''}
            placeholder="—"
            onChange={(e) =>
              updateField({ min: e.target.value === '' ? null : parseFloat(e.target.value) })
            }
            className="nodrag"
            style={{
              flex: 1,
              fontSize: '0.65rem',
              padding: '1px 4px',
              borderRadius: 3,
              border: '1px solid var(--border)',
              background: 'var(--input-bg, var(--card))',
              color: 'var(--text)',
              fontFamily: "'JetBrains Mono', monospace",
              minWidth: 0,
            }}
          />
        </div>

        {/* Max bound */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)', width: 28, flexShrink: 0 }}>
            {t('assertion.max', 'Max')}:
          </span>
          <input
            type="number"
            value={max ?? ''}
            placeholder="—"
            onChange={(e) =>
              updateField({ max: e.target.value === '' ? null : parseFloat(e.target.value) })
            }
            className="nodrag"
            style={{
              flex: 1,
              fontSize: '0.65rem',
              padding: '1px 4px',
              borderRadius: 3,
              border: '1px solid var(--border)',
              background: 'var(--input-bg, var(--card))',
              color: 'var(--text)',
              fontFamily: "'JetBrains Mono', monospace",
              minWidth: 0,
            }}
          />
        </div>

        {/* allowNan / allowInf toggles */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.6rem', color: 'var(--muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={allowNan}
              onChange={(e) => updateField({ allowNan: e.target.checked })}
              className="nodrag"
              style={{ width: 10, height: 10 }}
            />
            {t('assertion.allowNan', 'NaN ok')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.6rem', color: 'var(--muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={allowInf}
              onChange={(e) => updateField({ allowInf: e.target.checked })}
              className="nodrag"
              style={{ width: 10, height: 10 }}
            />
            {t('assertion.allowInf', '±Inf ok')}
          </label>
        </div>

        {/* Failure reason */}
        {assertResult !== null && !assertResult.pass && (
          <div
            style={{
              fontSize: '0.6rem',
              color: failColor,
              fontFamily: "'JetBrains Mono', monospace",
              textAlign: 'center',
              marginTop: 2,
              opacity: 0.85,
              wordBreak: 'break-all',
            }}
          >
            {nd.message || assertResult.reason}
          </div>
        )}
      </div>
    </div>
  )
}

export const AssertionNode = memo(AssertionNodeInner)
