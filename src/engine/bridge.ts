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
 * Trig block types whose inputs are angles (forward trig).
 * When angleUnit === 'deg', the engine expects these to receive degrees
 * via an `angleUnit` data field that the Rust ops read to convert.
 */
const FORWARD_TRIG_OPS = new Set(['sin', 'cos', 'tan'])

/**
 * Inverse trig block types whose outputs are angles.
 * When angleUnit === 'deg', they should output in degrees via the
 * `angleUnit` data field that the Rust ops read to convert.
 */
const INVERSE_TRIG_OPS = new Set(['asin', 'acos', 'atan', 'atan2'])

/**
 * All trig block types affected by the angle unit preference (SCI-06).
 * degToRad / radToDeg are pass-through converters; when in deg mode they
 * are effectively no-ops (the engine handles them as-is in radians).
 */
const ANGLE_UNIT_OPS = new Set([...FORWARD_TRIG_OPS, ...INVERSE_TRIG_OPS])

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
  /** H7-1: Published channel values for subscribe block resolution. */
  publishedOutputs?: Record<string, number>,
  /** SCI-06: Angle unit preference — injected into trig node data. */
  angleUnit?: 'rad' | 'deg',
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
      // V2-006: Probe removed from UI; legacy graphs still remap to display.
      // H4-1: Unified constant block resolves to 'number' with the looked-up
      // value. No Rust catalog entries needed for new constants.
      // 11.14: testBlock is a display pass-through in the engine; test logic runs in the UI.
      // 2.130: assertion is a UI-only validation block; engine treats it as pass-through display.
      // 4.19: wsInput is remapped to 'number' — node.data.value is the live WebSocket value.
      // 6.14: scope is a UI-only visualization block; engine treats it as pass-through display.
      // 2.131: timer is a UI-only timing measurement block; engine treats it as pass-through display.
      // 2.132: logger is a UI-only data recording block; engine treats it as pass-through display.
      // 2.65: transferFunction is a UI-computed LTI block; engine treats it as pass-through display.
      // 2.66: stateSpace is a UI-computed LTI block; engine treats it as pass-through display.
      // 2.133: mathSheet is a UI-computed spreadsheet; engine treats it as a number source.
      // 2.67: ctrl.saturation → clamp, ctrl.deadZone → number (UI-computed)
      // 2.68: ctrl.switch → ifthenelse, ctrl.mux → vectorConcat
      let blockType = (data.blockType === 'probe' || data.blockType === 'testBlock' || data.blockType === 'assertion' || data.blockType === 'scope' || data.blockType === 'timer' || data.blockType === 'logger' || data.blockType === 'transferFunction' || data.blockType === 'stateSpace'
        ? 'display'
        : data.blockType === 'wsInput'
          ? 'number'
          : data.blockType === 'restInput'
            ? 'number'
            : data.blockType === 'mathSheet'
              ? 'number'
              : data.blockType === 'ctrl.deadZone'
                ? 'number'
                : data.blockType === 'ctrl.saturation'
                  ? 'clamp'
                  : data.blockType === 'ctrl.switch'
                    ? 'ifthenelse'
                    : data.blockType === 'ctrl.mux'
                      ? 'vectorConcat'
                      // 2.9: fileInput is a drag-drop UI block; engine treats as tableInput.
                      : data.blockType === 'fileInput'
                        ? 'tableInput'
                        // 4.20: sqlQuery caches results as tableData; engine treats as tableInput.
                        : data.blockType === 'sqlQuery'
                          ? 'tableInput'
                          // 2.11: timeSeries caches resampled data as tableData; engine treats as tableInput.
                          : data.blockType === 'timeSeries'
                            ? 'tableInput'
                            // 2.13: unitInput converts to SI value and outputs as 'number'.
                            : data.blockType === 'unitInput'
                              ? 'number'
                              : data.blockType) as string
      if (blockType === 'constant') {
        const constId = data.selectedConstantId
        if (typeof constId === 'string' && constId in CONSTANT_VALUES) {
          blockType = 'number'
          data = { ...data, value: CONSTANT_VALUES[constId] }
        } else {
          // No selection or unknown constant — fall back to number(0)
          blockType = 'number'
          data = { ...data, value: data.value ?? 0 }
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
      // H7-1: Subscribe blocks inject the published channel value into data.
      if (
        blockType === 'subscribe' &&
        typeof data.subscribeChannelName === 'string' &&
        publishedOutputs
      ) {
        const pubVal = publishedOutputs[data.subscribeChannelName]
        if (pubVal !== undefined) {
          data = { ...data, value: pubVal }
        }
      }
      // SCI-06: Inject angleUnit into trig node data so Rust can auto-convert.
      // Only inject when deg mode is active — rad is the engine default.
      if (angleUnit === 'deg' && ANGLE_UNIT_OPS.has(blockType)) {
        data = { ...data, angleUnit: 'deg' }
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
      // 2.133: mathSheet and 2.67 ctrl.deadZone compute in the UI; exclude their input edges.
      .filter((e) => {
        const tgt = evalNodes.find((n) => n.id === e.target)
        const bt = (tgt?.data as Record<string, unknown> | undefined)?.blockType
        return bt !== 'mathSheet' && bt !== 'ctrl.deadZone'
      })
      .map((e) => {
        const tgtNode = evalNodes.find((n) => n.id === e.target)
        const tgtBlockType = (tgtNode?.data as Record<string, unknown> | undefined)?.blockType
        // 11.14: testBlock maps 'actual' input port → 'value' for the engine display pass-through.
        const targetHandle =
          tgtBlockType === 'testBlock' && e.targetHandle === 'actual'
            ? 'value'
            : (e.targetHandle ?? 'in')
        return {
          id: e.id,
          source: e.source,
          sourceHandle: e.sourceHandle ?? 'out',
          target: e.target,
          targetHandle,
        }
      }),
  }
}
