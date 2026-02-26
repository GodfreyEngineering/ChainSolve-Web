/**
 * Converts the React Flow graph representation used by the canvas
 * into the engine's EngineSnapshotV1 format.
 *
 * This is the sole translation layer between the UI graph model
 * and the engine input. When the TS engine is retired, only this
 * bridge and the WASM engine remain.
 */

import type { Node, Edge } from '@xyflow/react'
import type { InputBinding } from '../blocks/types.ts'
import type { VariablesMap } from '../lib/variables.ts'
import type { EngineSnapshotV1 } from './wasm-types.ts'
import { type ConstantsLookup, resolveNodeBindings } from './resolveBindings.ts'

/**
 * Build an EngineSnapshotV1 from React Flow nodes and edges.
 *
 * Group nodes (blockType === '__group__') are excluded since
 * they are purely visual containers and do not participate in
 * evaluation.
 */
export function toEngineSnapshot(
  nodes: Node[],
  edges: Edge[],
  constants?: ConstantsLookup,
  variables?: VariablesMap,
): EngineSnapshotV1 {
  const evalNodes = nodes.filter(
    (n) => (n.data as Record<string, unknown>).blockType !== '__group__',
  )

  const nodeIds = new Set(evalNodes.map((n) => n.id))

  return {
    version: 1,
    nodes: evalNodes.map((n) => {
      const data = n.data as Record<string, unknown>
      // W12.2: resolve inputBindings → manualValues before sending to Rust.
      if (constants && variables && data.inputBindings) {
        const resolved = resolveNodeBindings(
          data.inputBindings as Record<string, InputBinding>,
          data.manualValues as Record<string, number> | undefined,
          constants,
          variables,
        )
        return {
          id: n.id,
          blockType: data.blockType as string,
          data: { ...data, manualValues: resolved },
        }
      }
      return {
        id: n.id,
        blockType: data.blockType as string,
        data,
      }
    }),
    edges: edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle ?? 'out',
        target: e.target,
        targetHandle: e.targetHandle ?? 'in',
      })),
  }
}
