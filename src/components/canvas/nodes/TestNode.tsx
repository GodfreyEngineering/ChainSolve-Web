/**
 * TestNode — 11.14: assertion block for graph validation / unit testing.
 *
 * Compares the computed `actual` input value against a user-specified
 * `expected` value with a configurable `tolerance` (absolute or relative).
 * Displays ✓ PASS (green) or ✗ FAIL (red) inline, with the numeric delta.
 *
 * The engine receives this block as a `display` pass-through (see bridge.ts
 * 11.14 remap). The test comparison is computed entirely in the UI using
 * the already-computed source value from ComputedContext.
 *
 * TestSuite (future 11.14b): aggregates multiple TestBlock results — not
 * yet implemented; each TestBlock is self-contained for now.
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

type ToleranceMode = 'absolute' | 'relative'

interface TestNodeData extends NodeData {
  /** Expected value to compare against. */
  expected?: number
  /** Tolerance (absolute or relative). Default: 1e-9 absolute. */
  tolerance?: number
  /** Whether tolerance is absolute or relative (as fraction). Default: 'absolute'. */
  toleranceMode?: ToleranceMode
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function checkPass(actual: number, expected: number, tolerance: number, mode: ToleranceMode): boolean {
  const diff = Math.abs(actual - expected)
  if (mode === 'relative') {
    const base = Math.max(Math.abs(expected), 1e-300)
    return diff / base <= tolerance
  }
  return diff <= tolerance
}

function fmtNum(n: number): string {
  if (!isFinite(n)) return String(n)
  if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-3 && n !== 0)) return n.toExponential(4)
  return n.toPrecision(6).replace(/\.?0+$/, '')
}

// ── Component ─────────────────────────────────────────────────────────────────

function TestNodeInner({ id, data, selected }: NodeProps) {
  const { t } = useTranslation()
  const nd = data as TestNodeData
  const edges = useEdges()
  const { updateNodeData } = useReactFlow()

  const expected = typeof nd.expected === 'number' ? nd.expected : 0
  const tolerance = typeof nd.tolerance === 'number' ? nd.tolerance : 1e-9
  const toleranceMode: ToleranceMode = nd.toleranceMode ?? 'absolute'

  // Read the actual value from the upstream source connected to 'actual' handle
  const inputEdge = edges.find((e) => e.target === id && e.targetHandle === 'actual')
  const actualSourceId = inputEdge?.source ?? ''
  const actualValue = useComputedValue(actualSourceId)

  const testResult = useMemo(() => {
    if (!actualValue || !isScalar(actualValue) || !isFinite(actualValue.value)) {
      return null
    }
    const actual = actualValue.value
    const pass = checkPass(actual, expected, tolerance, toleranceMode)
    const diff = actual - expected
    return { actual, pass, diff }
  }, [actualValue, expected, tolerance, toleranceMode])

  const updateField = useCallback(
    (patch: Partial<TestNodeData>) => updateNodeData(id, patch),
    [id, updateNodeData],
  )

  const typeColor = `var(${getNodeTypeColor(nd.blockType)})`
  const TypeIcon = getNodeTypeIcon(nd.blockType)

  const passColor = '#22c55e'
  const failColor = '#ef4444'
  const statusColor = testResult === null ? 'var(--muted)' : testResult.pass ? passColor : failColor
  const statusIcon = testResult === null ? '—' : testResult.pass ? '✓' : '✗'
  const statusLabel = testResult === null
    ? t('test.noValue', 'No value')
    : testResult.pass
      ? t('test.pass', 'PASS')
      : t('test.fail', 'FAIL')

  return (
    <div
      style={{
        ...s.node,
        minWidth: 180,
        ...(selected ? { ...s.nodeSelected, borderColor: typeColor } : {}),
        borderColor: testResult !== null ? statusColor + '88' : undefined,
        boxShadow: testResult !== null ? `0 0 0 1px ${statusColor}33` : undefined,
      }}
      role="group"
      aria-label={`${nd.label} test block, ${statusLabel}`}
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
        {/* Actual input handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="actual"
          style={{ ...s.handleLeft, top: '50%', transform: 'translateY(-50%)' }}
        />

        {/* Actual value display */}
        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginBottom: 4 }}>
          {t('test.actual', 'Actual')}:{' '}
          <span style={{ color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
            {testResult !== null ? fmtNum(testResult.actual) : '—'}
          </span>
        </div>

        {/* Expected value (editable) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)', flexShrink: 0 }}>
            {t('test.expected', 'Expected')}:
          </span>
          <input
            type="number"
            value={expected}
            onChange={(e) => updateField({ expected: parseFloat(e.target.value) || 0 })}
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

        {/* Tolerance row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)', flexShrink: 0 }}>
            ±
          </span>
          <input
            type="number"
            value={tolerance}
            step="any"
            min={0}
            onChange={(e) => updateField({ tolerance: parseFloat(e.target.value) || 0 })}
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
          <select
            value={toleranceMode}
            onChange={(e) =>
              updateField({ toleranceMode: e.target.value as ToleranceMode })
            }
            className="nodrag"
            style={{
              fontSize: '0.6rem',
              padding: '1px 2px',
              borderRadius: 3,
              border: '1px solid var(--border)',
              background: 'var(--input-bg, var(--card))',
              color: 'var(--text)',
              flexShrink: 0,
            }}
          >
            <option value="absolute">{t('test.absolute', 'abs')}</option>
            <option value="relative">{t('test.relative', 'rel')}</option>
          </select>
        </div>

        {/* Delta display */}
        {testResult !== null && (
          <div
            style={{
              fontSize: '0.6rem',
              color: statusColor,
              fontFamily: "'JetBrains Mono', monospace",
              textAlign: 'center',
              marginTop: 2,
              opacity: 0.85,
            }}
          >
            Δ = {fmtNum(testResult.diff)}
          </div>
        )}
      </div>
    </div>
  )
}

export const TestNode = memo(TestNodeInner)
