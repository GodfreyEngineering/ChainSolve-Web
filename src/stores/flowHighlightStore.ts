/**
 * flowHighlightStore.ts — 3.39: Data flow highlighting.
 *
 * When a user hovers over a port (handle) on any node, all upstream (feeding)
 * and downstream (consuming) connections are highlighted in accent colour.
 * Non-connected edges are dimmed to reveal the active data path.
 */

import { create } from 'zustand'
import type { Edge } from '@xyflow/react'

interface FlowHighlightState {
  /** Set of edge IDs that are currently highlighted. Empty when no port is hovered. */
  highlightedEdgeIds: ReadonlySet<string>
  /** Set of node IDs that are on the highlighted path (for potential future node dimming). */
  highlightedNodeIds: ReadonlySet<string>

  /**
   * Activate highlighting for a specific port.
   * @param nodeId       Node that owns the hovered port.
   * @param portId       The handle ID (e.g. 'out', 'in_0', 'a', 'b').
   * @param portType     'source' → traverse downstream; 'target' → traverse upstream.
   * @param allEdges     Current snapshot of all edges in the canvas.
   */
  setHighlightedPort(
    nodeId: string,
    portId: string,
    portType: 'source' | 'target',
    allEdges: readonly Edge[],
  ): void

  /** Deactivate highlighting (port unhovered). */
  clearHighlight(): void
}

/** BFS traversal collecting all edge IDs and node IDs on the connected path. */
function collectPath(
  startNodeId: string,
  startPortId: string,
  portType: 'source' | 'target',
  allEdges: readonly Edge[],
): { edgeIds: Set<string>; nodeIds: Set<string> } {
  const edgeIds = new Set<string>()
  const nodeIds = new Set<string>([startNodeId])

  // Queue items: [nodeId, portId (undefined = any port on that node)]
  const queue: Array<{ nodeId: string; portId: string | undefined }> = [
    { nodeId: startNodeId, portId: startPortId },
  ]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const { nodeId, portId } = queue.shift()!
    const key = `${nodeId}:${portId ?? '*'}`
    if (visited.has(key)) continue
    visited.add(key)

    for (const edge of allEdges) {
      if (portType === 'target') {
        // Traverse upstream — looking for edges whose target is this node/port
        if (
          edge.target === nodeId &&
          (portId === undefined || edge.targetHandle === portId || !edge.targetHandle)
        ) {
          edgeIds.add(edge.id)
          nodeIds.add(edge.source)
          // Continue upstream from the source node (any port)
          queue.push({ nodeId: edge.source, portId: undefined })
        }
      } else {
        // Traverse downstream — looking for edges whose source is this node/port
        if (
          edge.source === nodeId &&
          (portId === undefined || edge.sourceHandle === portId || !edge.sourceHandle)
        ) {
          edgeIds.add(edge.id)
          nodeIds.add(edge.target)
          // Continue downstream from the target node (any port)
          queue.push({ nodeId: edge.target, portId: undefined })
        }
      }
    }
  }

  return { edgeIds, nodeIds }
}

export const useFlowHighlightStore = create<FlowHighlightState>()((set) => ({
  highlightedEdgeIds: new Set(),
  highlightedNodeIds: new Set(),

  setHighlightedPort(nodeId, portId, portType, allEdges) {
    const { edgeIds, nodeIds } = collectPath(nodeId, portId, portType, allEdges)
    set({ highlightedEdgeIds: edgeIds, highlightedNodeIds: nodeIds })
  },

  clearHighlight() {
    set({ highlightedEdgeIds: new Set(), highlightedNodeIds: new Set() })
  },
}))
