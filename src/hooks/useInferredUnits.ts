/**
 * useInferredUnits — React hook that runs unit propagation on the current graph.
 *
 * Returns a Map of nodeId → InferredUnit for display purposes.
 * Recalculates when nodes or edges change.
 */

import { useMemo } from 'react'
import { useNodes, useEdges } from '@xyflow/react'
import { propagateUnits, type UnitMap } from '../units/unitPropagation'

/** Run unit propagation on the current React Flow graph. */
export function useInferredUnits(): UnitMap {
  const nodes = useNodes()
  const edges = useEdges()

  return useMemo(() => propagateUnits(nodes, edges), [nodes, edges])
}
