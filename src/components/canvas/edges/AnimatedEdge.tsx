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
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  useNodes,
  type EdgeProps,
} from '@xyflow/react'
import { useComputedValue } from '../../../contexts/ComputedContext'
import { useCanvasSettings } from '../../../contexts/CanvasSettingsContext'
import { usePreferencesStore } from '../../../stores/preferencesStore'
import { formatValue } from '../../../engine/value'
import type { Value } from '../../../engine/value'
import { getUnitMismatch, type UnitMismatch } from '../../../units/unitCompat'
import { getUnitSymbol } from '../../../units/unitSymbols'
import { useInferredUnits } from '../../../hooks/useInferredUnits'
import type { NodeData } from '../../../blocks/types'

function edgeStroke(v: Value | undefined): string {
  if (!v) return 'var(--text)'
  if (v.kind === 'error') return 'var(--danger)'
  return 'var(--text)'
}

/** H1-2 + 4.05: Resolve unit mismatch, including inferred units from propagation. */
function useEdgeUnitMismatch(sourceId: string, targetId: string): UnitMismatch | null {
  const nodes = useNodes()
  const inferred = useInferredUnits()
  return useMemo(() => {
    const srcNode = nodes.find((n) => n.id === sourceId)
    const tgtNode = nodes.find((n) => n.id === targetId)
    // Use explicit unit first, fall back to inferred unit
    const srcUnit =
      (srcNode?.data as NodeData | undefined)?.unit ?? inferred.get(sourceId)?.unit
    const tgtUnit =
      (tgtNode?.data as NodeData | undefined)?.unit ?? inferred.get(targetId)?.unit
    return getUnitMismatch(srcUnit, tgtUnit)
  }, [nodes, sourceId, targetId, inferred])
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
  const sourceValue = useComputedValue(source)
  const { edgeBadgesEnabled } = useCanvasSettings()
  const edgeType = usePreferencesStore((s) => s.canvasEdgeType)
  const edgeWidth = usePreferencesStore((s) => s.canvasEdgeWidth)
  const mismatch = useEdgeUnitMismatch(source, target)
  const stroke = edgeStroke(sourceValue)
  const allNodes = useNodes()
  const edgeTitle = useMemo(() => {
    const srcNode = allNodes.find((n) => n.id === source)
    const tgtNode = allNodes.find((n) => n.id === target)
    const srcLabel = (srcNode?.data as NodeData | undefined)?.label ?? source
    const tgtLabel = (tgtNode?.data as NodeData | undefined)?.label ?? target
    return `${srcLabel} \u2192 ${tgtLabel}`
  }, [allNodes, source, target])

  // Edge color: white default, yellow warnings, red errors
  const effectiveStroke = mismatch
    ? mismatch.sameDimension
      ? 'var(--warning)' // yellow — same dimension, convertible
      : 'var(--danger)' // red — different dimensions, incompatible
    : selected
      ? 'var(--primary)'
      : stroke

  const [edgePath, labelX, labelY] =
    edgeType === 'straight'
      ? getStraightPath({ sourceX, sourceY, targetX, targetY })
      : edgeType === 'step'
        ? getSmoothStepPath({
            sourceX,
            sourceY,
            targetX,
            targetY,
            sourcePosition,
            targetPosition,
            borderRadius: 0,
          })
        : edgeType === 'smoothstep'
          ? getSmoothStepPath({
              sourceX,
              sourceY,
              targetX,
              targetY,
              sourcePosition,
              targetPosition,
            })
          : getBezierPath({
              sourceX,
              sourceY,
              targetX,
              targetY,
              sourcePosition,
              targetPosition,
            })

  return (
    <>
      {/* A11Y-02: title element for screen readers */}
      <title>{edgeTitle}</title>
      {/* Invisible wider hit area for easier clicking (G6-2) */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={16} />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: effectiveStroke,
          strokeWidth: selected ? 3 : mismatch ? 2 : (style?.strokeWidth ?? edgeWidth),
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
              background: 'var(--surface-2)',
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
