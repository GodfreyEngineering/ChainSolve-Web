/**
 * catalogSync.test.ts — F6-1: Catalog ↔ Registry sync test.
 *
 * Reads Rust catalog op_ids from catalog.rs source and compares against
 * the TS BLOCK_REGISTRY. Fails if either side has ops the other lacks
 * (excluding UI-only blocks like constant, and deprecated Rust ops).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { BLOCK_REGISTRY } from './registry'
import { registerAllBlocks } from './registerAllBlocks'

// Ensure domain block packs are loaded (UI-PERF-05: lazy by default)
registerAllBlocks()

// UI-only blocks have no Rust op — excluded from the sync check.
// sankeyPlot/surfacePlot render in the UI (bypassing Vega/Rust entirely).
// testBlock is remapped to 'display' in bridge.ts; test logic runs in the UI.
// 2.130: assertion is remapped to 'display' in bridge.ts; validation logic runs in the UI.
// 4.19: wsInput is remapped to 'number' in bridge.ts; WebSocket connection managed in the UI.
// 4.21: restInput is remapped to 'number' in bridge.ts; fetch() calls managed in the UI.
// 6.14: scope is remapped to 'display' in bridge.ts; ring-buffer chart renders in the UI.
// 2.131: timer is remapped to 'display' in bridge.ts; timing metrics rendered in the UI.
// 2.132: logger is remapped to 'display' in bridge.ts; data logging rendered in the UI.
// 2.133: mathSheet is remapped to 'number' in bridge.ts; spreadsheet computation runs in the UI.
// 2.67: ctrl.deadZone is remapped to 'number'; dead zone applied in UI.
// 2.67: ctrl.saturation is remapped to 'clamp' (existing Rust op) in bridge.ts.
// 2.68: ctrl.switch is remapped to 'ifthenelse' (existing Rust op) in bridge.ts.
// 2.68: ctrl.mux is remapped to 'vectorConcat' (existing Rust op) in bridge.ts.
// 2.9: fileInput is remapped to 'tableInput' in bridge.ts; file parsing runs in the UI.
// 4.20: sqlQuery is remapped to 'tableInput' in bridge.ts; SQL execution runs in the UI via sqlQueryService.
// 2.11: timeSeries is remapped to 'tableInput' in bridge.ts; CSV parsing and resampling run in the UI.
// 2.13: unitInput is remapped to 'number' in bridge.ts; SI conversion runs in the UI.
// 2.65: transferFunction is remapped to 'display' in bridge.ts; LTI computation runs in the UI.
// 2.66: stateSpace is remapped to 'display' in bridge.ts; state-space simulation runs in the UI.
// 2.70: ctrl.zoh is remapped to 'number' in bridge.ts; hold logic runs in the UI.
// 2.70: ctrl.rateTransition is remapped to 'number' in bridge.ts; rate conversion runs in the UI.
// 2.71: stateMachine is remapped to 'number' in bridge.ts; FSM state tracking runs in the UI.
// 9.15/2.134: codeBlock is remapped to 'number' in bridge.ts; JS evaluation runs in the UI.
// 4.14: tirFileInput is remapped to 'tableInput' in bridge.ts; .tir parsing runs in the UI.
// 2.96: nn.onnxInference is remapped to 'vector' in bridge.ts; ONNX inference runs in the UI via onnxruntime-web.
// 2.125: fmu.import is remapped to 'tableInput' in bridge.ts; FMU parsing runs in the UI.
// 2.127: scripting.python is remapped to 'number' in bridge.ts; Python runs in Pyodide worker in UI.
// 2.128: scripting.rust is remapped to 'number' in bridge.ts; Rust compilation/execution runs server-side.
// 4.7: data.hdf5Import is remapped to 'tableInput' in bridge.ts; HDF5 parsing runs in the UI via h5wasm.
// 4.11: data.stepImport is remapped to 'tableInput' in bridge.ts; STEP/IGES parsing runs in the UI.
// 4.15: data.openDriveImport is remapped to 'tableInput' in bridge.ts; .xodr parsing runs in the UI.
const UI_ONLY_BLOCKS = new Set(['constant', 'material', 'sankeyPlot', 'surfacePlot', 'testBlock', 'assertion', 'wsInput', 'restInput', 'scope', 'timer', 'logger', 'mathSheet', 'ctrl.deadZone', 'ctrl.saturation', 'ctrl.switch', 'ctrl.mux', 'fileInput', 'sqlQuery', 'timeSeries', 'unitInput', 'transferFunction', 'stateSpace', 'ctrl.zoh', 'ctrl.rateTransition', 'stateMachine', 'codeBlock', 'tirFileInput', 'viewport3d', 'nn.onnxInference', 'fmu.import', 'scripting.python', 'scripting.rust', 'data.hdf5Import', 'data.stepImport', 'data.openDriveImport'])

// Deprecated Rust ops: still in catalog.rs for backward compat but removed
// from the TS registry. BUG-12: material_full renamed → 'material'.
// BUG-13: vectorInput removed; projects migrate to tableInput on load.
const DEPRECATED_RUST_OPS = new Set(['material_full', 'vectorInput'])

function extractRustOpIds(): Set<string> {
  const catalogSrc = readFileSync(
    resolve(__dirname, '../../crates/engine-core/src/catalog.rs'),
    'utf-8',
  )
  const opIds = new Set<string>()
  // Match: op_id: "some.op.name" (old CatalogEntry literal format)
  for (const m of catalogSrc.matchAll(/op_id:\s*"([^"]+)"/g)) {
    opIds.add(m[1])
  }
  // Match: entry("some.op.name", ...) or variadic_entry("some.op.name", ...)
  for (const m of catalogSrc.matchAll(/(?:entry|variadic_entry)\("([^"]+)"/g)) {
    opIds.add(m[1])
  }
  return opIds
}

describe('Catalog ↔ Registry sync (F6-1)', () => {
  const rustOps = extractRustOpIds()
  const tsOps = new Set<string>()
  for (const [type] of BLOCK_REGISTRY) {
    if (!UI_ONLY_BLOCKS.has(type)) tsOps.add(type)
  }
  // Active Rust ops: exclude deprecated ones removed from TS registry
  const activeRustOps = new Set([...rustOps].filter((op) => !DEPRECATED_RUST_OPS.has(op)))

  it('Rust catalog has ops', () => {
    expect(rustOps.size).toBeGreaterThan(100)
  })

  it('TS registry has ops', () => {
    expect(tsOps.size).toBeGreaterThan(100)
  })

  it('every Rust op has a TS block definition', () => {
    const missingInTs = [...activeRustOps].filter((op) => !tsOps.has(op))
    expect(missingInTs).toEqual([])
  })

  it('every TS block (non-UI-only) has a Rust catalog entry', () => {
    const missingInRust = [...tsOps].filter((op) => !rustOps.has(op))
    expect(missingInRust).toEqual([])
  })

  it('counts match', () => {
    expect(tsOps.size).toBe(activeRustOps.size)
  })
})
