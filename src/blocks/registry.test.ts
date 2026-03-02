/**
 * registry.test.ts — G0-6
 *
 * Tests for catalog validation and auto-registration of generic BlockDefs.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { CatalogEntry } from '../engine/wasm-types'
import { BLOCK_REGISTRY, UI_ONLY_BLOCKS, validateCatalog } from './registry'

// ── Structural: no console.warn in validateCatalog ──────────────────────────

describe('validateCatalog produces no warnings', () => {
  const registrySrc = fs.readFileSync(path.resolve(__dirname, 'registry.ts'), 'utf-8')

  // Extract just the validateCatalog function body
  const fnStart = registrySrc.indexOf('export function validateCatalog')
  const fnBody = registrySrc.slice(fnStart, registrySrc.indexOf('\n}', fnStart) + 2)

  it('validateCatalog does not call console.warn', () => {
    expect(fnBody).not.toContain('console.warn')
  })

  it('validateCatalog does not call console.error', () => {
    expect(fnBody).not.toContain('console.error')
  })
})

// ── Auto-registration of generic BlockDefs ──────────────────────────────────

describe('validateCatalog auto-registers missing catalog ops', () => {
  it('registers a generic BlockDef for a catalog op not in BLOCK_REGISTRY', () => {
    // Create a fake catalog entry that does not exist in the TS registry
    const fakeEntry: CatalogEntry = {
      opId: '__test_auto_reg_op__',
      label: 'Test Auto Reg',
      category: 'math',
      nodeKind: 'csOperation',
      inputs: [
        { id: 'x', label: 'X' },
        { id: 'y', label: 'Y' },
      ],
      proOnly: false,
    }

    // Ensure it does not exist before validation
    BLOCK_REGISTRY.delete(fakeEntry.opId)
    expect(BLOCK_REGISTRY.has(fakeEntry.opId)).toBe(false)

    // Run validation with the fake entry
    validateCatalog([fakeEntry])

    // It should now be auto-registered
    const def = BLOCK_REGISTRY.get(fakeEntry.opId)
    expect(def).toBeDefined()
    expect(def!.type).toBe('__test_auto_reg_op__')
    expect(def!.label).toBe('Test Auto Reg')
    expect(def!.category).toBe('math')
    expect(def!.nodeKind).toBe('csOperation')
    expect(def!.inputs).toEqual([
      { id: 'x', label: 'X' },
      { id: 'y', label: 'Y' },
    ])
    expect(def!.defaultData.blockType).toBe('__test_auto_reg_op__')
    expect(def!.proOnly).toBe(false)

    // Clean up
    BLOCK_REGISTRY.delete(fakeEntry.opId)
  })

  it('does not overwrite existing TS entries with catalog data', () => {
    // 'add' exists in both TS and Rust with TS-specific defaults
    const existingDef = BLOCK_REGISTRY.get('add')
    expect(existingDef).toBeDefined()
    const originalLabel = existingDef!.label

    const catalogEntry: CatalogEntry = {
      opId: 'add',
      label: 'Addition (from Rust)',
      category: 'math',
      nodeKind: 'csOperation',
      inputs: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      proOnly: false,
    }

    validateCatalog([catalogEntry])

    // TS entry should NOT be overwritten — bespoke defaults are preserved
    const afterDef = BLOCK_REGISTRY.get('add')
    expect(afterDef!.label).toBe(originalLabel)
  })
})

// ── UI-only blocks are not in the Rust catalog ──────────────────────────────

describe('UI-only blocks', () => {
  const catalogSrc = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'crates', 'engine-core', 'src', 'catalog.rs'),
    'utf-8',
  )

  // Extract all op_ids from the Rust catalog
  const rustOpIds = [...catalogSrc.matchAll(/op_id:\s*"([^"]+)"/g)].map((m) => m[1])

  for (const type of UI_ONLY_BLOCKS) {
    it(`"${type}" is not in the Rust catalog`, () => {
      expect(rustOpIds).not.toContain(type)
    })
  }
})

// ── Every TS registry entry (non-UI-only) has a Rust catalog counterpart ────

describe('TS / Rust catalog alignment', () => {
  const catalogSrc = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'crates', 'engine-core', 'src', 'catalog.rs'),
    'utf-8',
  )
  const rustOpIds = new Set([...catalogSrc.matchAll(/op_id:\s*"([^"]+)"/g)].map((m) => m[1]))

  it('every non-UI-only TS block has a Rust catalog entry', () => {
    const missingFromRust: string[] = []
    for (const [type] of BLOCK_REGISTRY) {
      if (UI_ONLY_BLOCKS.has(type)) continue
      if (!rustOpIds.has(type)) {
        missingFromRust.push(type)
      }
    }
    expect(missingFromRust).toEqual([])
  })

  it('every Rust catalog op has a TS registry entry', () => {
    const missingFromTs: string[] = []
    for (const opId of rustOpIds) {
      if (!BLOCK_REGISTRY.has(opId)) {
        missingFromTs.push(opId)
      }
    }
    expect(missingFromTs).toEqual([])
  })
})
