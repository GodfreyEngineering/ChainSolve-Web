/**
 * useBlockSnapping — magnetic snap detection for block-to-block alignment.
 *
 * When dragging a node near another node, computes snap targets:
 * - Right edge → left edge (horizontal chain)
 * - Bottom edge → top edge (vertical stack)
 * - Center-align horizontal (same Y center)
 * - Center-align vertical (same X center)
 *
 * Returns adjusted position and guide line metadata for rendering.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { Node } from '@xyflow/react'

const DEFAULT_THRESHOLD = 20 // px
const HORIZONTAL_GAP = 12 // px gap between snapped blocks

export interface SnapGuide {
  /** Orientation of the guide line. */
  axis: 'x' | 'y'
  /** Position (in flow coordinates) of the guide line. */
  position: number
  /** Start/end extent of the guide line for rendering. */
  from: number
  to: number
}

export interface SnapResult {
  /** Adjusted position for the dragged node (snapped). */
  x: number
  y: number
  /** Whether any snap was applied. */
  snapped: boolean
  /** Guide lines to render on the canvas. */
  guides: SnapGuide[]
}

/** Estimate node dimensions from measured or default sizes. */
function getNodeRect(node: Node): { x: number; y: number; w: number; h: number } {
  const x = node.position?.x ?? 0
  const y = node.position?.y ?? 0
  const w = node.measured?.width ?? (node.width as number | undefined) ?? 160
  const h = node.measured?.height ?? (node.height as number | undefined) ?? 60
  return { x, y, w, h }
}

/**
 * Hook that provides a snap computation function.
 * Call `computeSnap` during onNodeDrag to get adjusted position + guides.
 */
export function useBlockSnapping(threshold = DEFAULT_THRESHOLD) {
  const thresholdRef = useRef(threshold)
  useEffect(() => {
    thresholdRef.current = threshold
  }, [threshold])

  const computeSnap = useCallback(
    (draggedId: string, dragX: number, dragY: number, allNodes: Node[]): SnapResult => {
      const t = thresholdRef.current
      const guides: SnapGuide[] = []
      let snapX = dragX
      let snapY = dragY
      let snappedX = false
      let snappedY = false

      // Get dragged node dimensions
      const draggedNode = allNodes.find((n) => n.id === draggedId)
      if (!draggedNode) return { x: dragX, y: dragY, snapped: false, guides: [] }

      const dw = draggedNode.measured?.width ?? (draggedNode.width as number | undefined) ?? 160
      const dh = draggedNode.measured?.height ?? (draggedNode.height as number | undefined) ?? 60

      const dragRight = dragX + dw
      const dragBottom = dragY + dh
      const dragCenterX = dragX + dw / 2
      const dragCenterY = dragY + dh / 2

      let bestDx = t + 1
      let bestDy = t + 1

      for (const node of allNodes) {
        if (node.id === draggedId) continue
        // Skip annotations and groups
        const bt = (node.data as Record<string, unknown>)?.blockType as string | undefined
        if (bt === '__group__' || bt?.startsWith('annotation_')) continue

        const r = getNodeRect(node)
        const nRight = r.x + r.w
        const nBottom = r.y + r.h
        const nCenterX = r.x + r.w / 2
        const nCenterY = r.y + r.h / 2

        // Horizontal chain: dragged left edge → target right edge (with gap)
        const dxChainRight = Math.abs(dragX - (nRight + HORIZONTAL_GAP))
        if (dxChainRight < bestDx) {
          bestDx = dxChainRight
          snapX = nRight + HORIZONTAL_GAP
          snappedX = true
        }

        // Horizontal chain: dragged right edge → target left edge (with gap)
        const dxChainLeft = Math.abs(dragRight - (r.x - HORIZONTAL_GAP))
        if (dxChainLeft < bestDx) {
          bestDx = dxChainLeft
          snapX = r.x - HORIZONTAL_GAP - dw
          snappedX = true
        }

        // Center-align X (vertical alignment)
        const dxCenter = Math.abs(dragCenterX - nCenterX)
        if (dxCenter < bestDx) {
          bestDx = dxCenter
          snapX = nCenterX - dw / 2
          snappedX = true
        }

        // Vertical stack: dragged top → target bottom (with gap)
        const dyStackBelow = Math.abs(dragY - (nBottom + HORIZONTAL_GAP))
        if (dyStackBelow < bestDy) {
          bestDy = dyStackBelow
          snapY = nBottom + HORIZONTAL_GAP
          snappedY = true
        }

        // Vertical stack: dragged bottom → target top
        const dyStackAbove = Math.abs(dragBottom - (r.y - HORIZONTAL_GAP))
        if (dyStackAbove < bestDy) {
          bestDy = dyStackAbove
          snapY = r.y - HORIZONTAL_GAP - dh
          snappedY = true
        }

        // Center-align Y (horizontal alignment)
        const dyCenter = Math.abs(dragCenterY - nCenterY)
        if (dyCenter < bestDy) {
          bestDy = dyCenter
          snapY = nCenterY - dh / 2
          snappedY = true
        }
      }

      // Only apply snaps within threshold
      if (bestDx > t) {
        snapX = dragX
        snappedX = false
      }
      if (bestDy > t) {
        snapY = dragY
        snappedY = false
      }

      // Generate guide lines for active snaps
      if (snappedX) {
        const guideX = snapX + dw / 2
        guides.push({
          axis: 'x',
          position: guideX,
          from: Math.min(snapY, dragY) - 50,
          to: Math.max(snapY + dh, dragY + dh) + 50,
        })
      }
      if (snappedY) {
        const guideY = snapY + dh / 2
        guides.push({
          axis: 'y',
          position: guideY,
          from: Math.min(snapX, dragX) - 50,
          to: Math.max(snapX + dw, dragX + dw) + 50,
        })
      }

      return { x: snapX, y: snapY, snapped: snappedX || snappedY, guides }
    },
    [],
  )

  return { computeSnap }
}
