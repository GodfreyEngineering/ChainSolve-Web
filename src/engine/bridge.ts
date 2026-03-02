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
import { MATERIAL_VALUES } from '../blocks/materialCatalog.ts'
import { CONSTANT_VALUES } from '../blocks/constantsCatalog.ts'

/**
 * Build an EngineSnapshotV1 from React Flow nodes and edges.
 *
 * Group nodes (blockType === '__group__') and annotation nodes
 * (blockType starts with 'annotation_') are excluded since they
 * are purely visual and do not participate in evaluation.
 */
export function toEngineSnapshot(
  nodes: Node[],
  edges: Edge[],
  constants?: ConstantsLookup,
  variables?: VariablesMap,
): EngineSnapshotV1 {
  const evalNodes = nodes.filter((n) => {
    const bt = (n.data as Record<string, unknown>).blockType as string
    return bt !== '__group__' && !bt.startsWith('annotation_')
  })

  const nodeIds = new Set(evalNodes.map((n) => n.id))

  return {
    version: 1,
    nodes: evalNodes.map((n) => {
      let data = n.data as Record<string, unknown>
      // W12.4: Probe maps to display for the engine (no Rust changes needed).
      // H4-1: Unified constant block resolves to 'number' with the looked-up
      // value. No Rust catalog entries needed for new constants.
      let blockType = (data.blockType === 'probe' ? 'display' : data.blockType) as string
      if (blockType === 'constant' && typeof data.selectedConstantId === 'string') {
        const constId = data.selectedConstantId
        if (constId in CONSTANT_VALUES) {
          blockType = 'number'
          data = { ...data, value: CONSTANT_VALUES[constId] }
        } else {
          blockType = constId
        }
      }
      // H3-1: Unified material block resolves all presets and custom materials
      // to 'number' with the looked-up value. No Rust catalog entries needed.
      if (blockType === 'material' && typeof data.selectedMaterialId === 'string') {
        const matId = data.selectedMaterialId
        blockType = 'number'
        if (matId.startsWith('custom:')) {
          // Custom materials: value already set by SourceNode sync
        } else if (matId in MATERIAL_VALUES) {
          data = { ...data, value: MATERIAL_VALUES[matId] }
        }
      }
      // H5-1: Custom function blocks map to 'math_expr' for the Rust engine.
      // The formula and input values are passed via data.
      if (blockType.startsWith('cfb:') && typeof data.formula === 'string') {
        blockType = 'math_expr'
      }
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
          blockType,
          data: { ...data, manualValues: resolved },
        }
      }
      return {
        id: n.id,
        blockType,
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
