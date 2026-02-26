/**
 * AnimatedEdge — custom edge that colours by source value kind
 * and optionally animates a flowing dash pattern.
 *
 * Colour map (when animated edges enabled):
 *   scalar → teal, vector → purple, table → orange, error → red, unknown → grey
 *
 * Animation is controlled via the `data-edges-animated` attribute on the
 * canvas wrapper — CSS handles the dash-offset keyframes.
 */

import { memo } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useComputed } from '../../../contexts/ComputedContext'
import { useCanvasSettings } from '../../../contexts/CanvasSettingsContext'
import type { Value } from '../../../engine/value'

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
}: EdgeProps) {
  const computed = useComputed()
  const { edgesAnimated } = useCanvasSettings()

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={{ ...style, stroke: edgeStroke(computed.get(source), edgesAnimated) }}
    />
  )
}

export const AnimatedEdge = memo(AnimatedEdgeInner)
