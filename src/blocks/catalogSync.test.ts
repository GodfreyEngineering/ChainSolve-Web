/**
 * catalogSync.test.ts — F6-1: Catalog ↔ Registry sync test.
 *
 * Reads Rust catalog op_ids from catalog.rs source and compares against
 * the TS BLOCK_REGISTRY. Fails if either side has ops the other lacks
 * (excluding UI-only blocks like constant, material, annotations).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { BLOCK_REGISTRY } from './registry'

// UI-only blocks have no Rust op — excluded from the sync check.
const UI_ONLY_BLOCKS = new Set([
  'constant',
  'material',
  'annotation_text',
  'annotation_callout',
  'annotation_highlight',
])

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

  it('Rust catalog has ops', () => {
    expect(rustOps.size).toBeGreaterThan(100)
  })

  it('TS registry has ops', () => {
    expect(tsOps.size).toBeGreaterThan(100)
  })

  it('every Rust op has a TS block definition', () => {
    const missingInTs = [...rustOps].filter((op) => !tsOps.has(op))
    expect(missingInTs).toEqual([])
  })

  it('every TS block (non-UI-only) has a Rust catalog entry', () => {
    const missingInRust = [...tsOps].filter((op) => !rustOps.has(op))
    expect(missingInRust).toEqual([])
  })

  it('counts match', () => {
    expect(tsOps.size).toBe(rustOps.size)
  })
})
