/**
 * alignmentHelpers.ts — E7-2: Alignment and distribution helpers for canvas nodes.
 *
 * Given an array of nodes (with position + measured width/height),
 * compute updated positions for align-left, align-right, align-top,
 * align-bottom, distribute-horizontal, distribute-vertical.
 */

import type { Node } from '@xyflow/react'

/** Default dimensions when measured values are unavailable. */
const DEFAULT_W = 168
const DEFAULT_H = 60

function getW(n: Node): number {
  return n.measured?.width ?? (n.width as number | undefined) ?? DEFAULT_W
}

function getH(n: Node): number {
  return n.measured?.height ?? (n.height as number | undefined) ?? DEFAULT_H
}

export type AlignOp =
  | 'align-left'
  | 'align-right'
  | 'align-top'
  | 'align-bottom'
  | 'distribute-h'
  | 'distribute-v'

/**
 * Compute new positions for the given nodes based on the alignment operation.
 * Returns a Map<nodeId, {x, y}> with only the affected positions.
 * Requires at least 2 nodes for align ops, 3 for distribute ops.
 */
export function computeAlignment(
  selected: Node[],
  op: AlignOp,
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>()

  if (selected.length < 2) return result

  switch (op) {
    case 'align-left': {
      const minX = Math.min(...selected.map((n) => n.position.x))
      for (const n of selected) {
        result.set(n.id, { x: minX, y: n.position.y })
      }
      break
    }
    case 'align-right': {
      const maxRight = Math.max(...selected.map((n) => n.position.x + getW(n)))
      for (const n of selected) {
        result.set(n.id, { x: maxRight - getW(n), y: n.position.y })
      }
      break
    }
    case 'align-top': {
      const minY = Math.min(...selected.map((n) => n.position.y))
      for (const n of selected) {
        result.set(n.id, { x: n.position.x, y: minY })
      }
      break
    }
    case 'align-bottom': {
      const maxBottom = Math.max(...selected.map((n) => n.position.y + getH(n)))
      for (const n of selected) {
        result.set(n.id, { x: n.position.x, y: maxBottom - getH(n) })
      }
      break
    }
    case 'distribute-h': {
      if (selected.length < 3) return result
      const sorted = [...selected].sort((a, b) => a.position.x - b.position.x)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const totalSpan = last.position.x + getW(last) - first.position.x
      const totalNodeW = sorted.reduce((sum, n) => sum + getW(n), 0)
      const gap = (totalSpan - totalNodeW) / (sorted.length - 1)
      let x = first.position.x
      for (const n of sorted) {
        result.set(n.id, { x, y: n.position.y })
        x += getW(n) + gap
      }
      break
    }
    case 'distribute-v': {
      if (selected.length < 3) return result
      const sorted = [...selected].sort((a, b) => a.position.y - b.position.y)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const totalSpan = last.position.y + getH(last) - first.position.y
      const totalNodeH = sorted.reduce((sum, n) => sum + getH(n), 0)
      const gap = (totalSpan - totalNodeH) / (sorted.length - 1)
      let y = first.position.y
      for (const n of sorted) {
        result.set(n.id, { x: n.position.x, y })
        y += getH(n) + gap
      }
      break
    }
  }

  return result
}
