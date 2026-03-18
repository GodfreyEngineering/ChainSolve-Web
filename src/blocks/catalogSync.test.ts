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
const UI_ONLY_BLOCKS = new Set(['constant', 'material', 'sankeyPlot', 'surfacePlot', 'testBlock', 'assertion', 'wsInput', 'restInput', 'scope', 'timer', 'logger', 'mathSheet', 'ctrl.deadZone', 'ctrl.saturation', 'ctrl.switch', 'ctrl.mux'])

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
