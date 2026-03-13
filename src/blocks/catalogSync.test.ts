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

// UI-only blocks have no Rust op — excluded from the sync check.
const UI_ONLY_BLOCKS = new Set([
  'constant',
  'material',
  // Optimization blocks — TS-only until Rust ops are implemented
  'optim.designVariable',
  'optim.objectiveFunction',
  'optim.gradientDescent',
  'optim.geneticAlgorithm',
  'optim.nelderMead',
  'optim.convergencePlot',
  'optim.resultsTable',
  'optim.parametricSweep',
  'optim.monteCarlo',
  'optim.sensitivity',
  'optim.doe',
  // Machine Learning blocks — TS-only until Rust ops are implemented
  'ml.trainTestSplit',
  'ml.linearRegression',
  'ml.polynomialRegression',
  'ml.knnClassifier',
  'ml.decisionTree',
  'ml.predict',
  'ml.mse',
  'ml.r2',
  'ml.confusionMatrix',
  // Neural Network blocks — TS-only until Rust ops are implemented
  'nn.input',
  'nn.dense',
  'nn.conv1d',
  'nn.dropout',
  'nn.activation',
  'nn.sequential',
  'nn.trainer',
  'nn.predict',
  'nn.export',
])

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
  // Match: op_id: "some.op.name"
  for (const m of catalogSrc.matchAll(/op_id:\s*"([^"]+)"/g)) {
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
