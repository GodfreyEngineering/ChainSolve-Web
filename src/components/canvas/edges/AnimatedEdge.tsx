/**
 * AnimatedEdge — custom edge that colours by source value kind
 * and optionally animates a flowing dash pattern.
 *
 * Colour map (when animated edges enabled):
 *   scalar → teal, vector → purple, table → orange, error → red, unknown → grey
 *
 * H1-2: Shows a warning badge when source/target nodes have units in the
 * same dimension but different unit ids (unit mismatch).
 *
 * Animation is controlled via the `data-edges-animated` attribute on the
 * canvas wrapper — CSS handles the dash-offset keyframes.
 */

import { memo, useMemo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useNodes, type EdgeProps } from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { useCanvasSettings } from '../../../contexts/CanvasSettingsContext'
import { formatValue } from '../../../engine/value'
import type { Value } from '../../../engine/value'
import { getUnitMismatch, type UnitMismatch } from '../../../units/unitCompat'
import { getUnitSymbol } from '../../../units/unitSymbols'
import type { NodeData } from '../../../blocks/types'

const KIND_COLORS: Record<string, string> = {
  scalar: '#14b8a6',
  vector: '#a78bfa',
  table: '#f59e0b',
  error: '#ef4444',
}

function edgeStroke(v: Value | undefined, animated: boolean): string {
  if (!animated) return 'var(--primary)'
  if (!v) return 'var(--text-muted)'
  return KIND_COLORS[v.kind] ?? 'var(--text-muted)'
}

/** H1-2: Resolve unit mismatch between source and target nodes. */
function useEdgeUnitMismatch(sourceId: string, targetId: string): UnitMismatch | null {
  const nodes = useNodes()
  return useMemo(() => {
    const srcNode = nodes.find((n) => n.id === sourceId)
    const tgtNode = nodes.find((n) => n.id === targetId)
    const srcUnit = (srcNode?.data as NodeData | undefined)?.unit
    const tgtUnit = (tgtNode?.data as NodeData | undefined)?.unit
    return getUnitMismatch(srcUnit, tgtUnit)
  }, [nodes, sourceId, targetId])
}

function AnimatedEdgeInner({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  source,
  target,
  selected,
}: EdgeProps) {
  const computed = useComputed()
  const { edgesAnimated, edgeBadgesEnabled } = useCanvasSettings()
  const sourceValue = computed.get(source)
  const mismatch = useEdgeUnitMismatch(source, target)
  const stroke = edgeStroke(sourceValue, edgesAnimated)

  // H1-2: Override stroke colour when there is a unit mismatch
  const effectiveStroke = mismatch
    ? mismatch.sameDimension
      ? '#fbbf24' // amber — same dimension, convertible
      : '#f87171' // red — different dimensions, incompatible
    : selected
      ? 'var(--primary)'
      : stroke

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  return (
    <>
      {/* Invisible wider hit area for easier clicking (G6-2) */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={16} />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: effectiveStroke,
          strokeWidth: selected ? 3 : mismatch ? 2 : (style?.strokeWidth ?? 1.5),
          strokeDasharray: mismatch ? '6 3' : undefined,
          filter: selected ? `drop-shadow(0 0 4px ${effectiveStroke})` : undefined,
        }}
      />
      {/* H1-2: Unit mismatch warning badge */}
      {mismatch && mismatch.sameDimension && (
        <EdgeLabelRenderer>
          <div
            className="cs-edge-mismatch nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -120%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.55rem',
              color: '#fbbf24',
              background: 'rgba(30,30,50,0.95)',
              border: '1px solid rgba(251,191,36,0.4)',
              borderRadius: 4,
              padding: '0.1rem 0.35rem',
              whiteSpace: 'nowrap',
              cursor: 'default',
              lineHeight: 1.3,
            }}
            title={`${getUnitSymbol(mismatch.sourceUnit)} \u2260 ${getUnitSymbol(mismatch.targetUnit)}`}
          >
            {getUnitSymbol(mismatch.sourceUnit)} {'!='} {getUnitSymbol(mismatch.targetUnit)}
          </div>
        </EdgeLabelRenderer>
      )}
      {edgeBadgesEnabled && sourceValue !== undefined && (
        <EdgeLabelRenderer>
          <div
            className="cs-edge-badge"
            style={{
              position: 'absolute',
              transform: `translate(-50%, ${mismatch ? '10%' : '-50%'}) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.6rem',
              color: 'var(--text)',
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '0.05rem 0.3rem',
              whiteSpace: 'nowrap',
              opacity: 0.85,
            }}
          >
            {formatValue(sourceValue)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const AnimatedEdge = memo(AnimatedEdgeInner)
