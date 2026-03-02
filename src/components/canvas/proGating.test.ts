/**
 * proGating.test.ts — Structural tests verifying Pro feature gating
 * consistency across block library and UI entrypoints.
 *
 * D6-2: Locked Pro features visible to Free users.
 * D6-3: Variable CRUD must not exist in block library.
 */

import { describe, it, expect } from 'vitest'
import {
  BLOCK_REGISTRY,
  CATEGORY_ORDER,
  BLOCK_TAXONOMY,
  getSubcategoryBlocks,
  getConstantsCatalog,
  getMaterialsCatalog,
} from '../../blocks/registry'
import { getEntitlements, isBlockEntitled } from '../../lib/entitlements'

/** Pro-only categories (must match BlockLibrary.tsx PRO_CATEGORIES). */
const PRO_CATEGORIES = new Set([
  'data',
  'vectorOps',
  'tableOps',
  'plot',
  'finTvm',
  'finReturns',
  'finDepr',
  'statsDesc',
  'statsRel',
  'probComb',
  'probDist',
  'utilCalc',
])

describe('Pro feature gating', () => {
  it('every block in a Pro category has proOnly: true', () => {
    const missing: string[] = []
    for (const def of BLOCK_REGISTRY.values()) {
      if (PRO_CATEGORIES.has(def.category) && !def.proOnly) {
        missing.push(`${def.type} (category: ${def.category})`)
      }
    }
    expect(
      missing,
      `Blocks in Pro categories missing proOnly flag:\n${missing.join('\n')}`,
    ).toEqual([])
  })

  it('no Free-category block has proOnly: true', () => {
    const wrongly: string[] = []
    for (const def of BLOCK_REGISTRY.values()) {
      if (!PRO_CATEGORIES.has(def.category) && def.proOnly) {
        wrongly.push(`${def.type} (category: ${def.category})`)
      }
    }
    expect(wrongly, `Blocks in Free categories with proOnly flag:\n${wrongly.join('\n')}`).toEqual(
      [],
    )
  })

  it('Free plan blocks all Pro-only blocks', () => {
    const freeEnt = getEntitlements('free')
    const leaking: string[] = []
    for (const def of BLOCK_REGISTRY.values()) {
      if (def.proOnly && isBlockEntitled(def, freeEnt)) {
        leaking.push(def.type)
      }
    }
    expect(leaking, `Pro blocks accessible on Free plan:\n${leaking.join('\n')}`).toEqual([])
  })

  it('Pro plan allows all Pro-only blocks', () => {
    const proEnt = getEntitlements('pro')
    const blocked: string[] = []
    for (const def of BLOCK_REGISTRY.values()) {
      if (def.proOnly && !isBlockEntitled(def, proEnt)) {
        blocked.push(def.type)
      }
    }
    expect(blocked, `Pro blocks blocked on Pro plan:\n${blocked.join('\n')}`).toEqual([])
  })

  it('all Pro categories are listed in CATEGORY_ORDER', () => {
    for (const cat of PRO_CATEGORIES) {
      expect(CATEGORY_ORDER).toContain(cat)
    }
  })
})

// ── D6-3: Variable CRUD separation ──────────────────────────────────────────

describe('Variable block separation (D6-3)', () => {
  it('only one variable-related block exists: variableSource', () => {
    const varBlocks = [...BLOCK_REGISTRY.values()].filter(
      (d) => d.type.toLowerCase().includes('variable') || d.type === 'variableSource',
    )
    expect(varBlocks).toHaveLength(1)
    expect(varBlocks[0].type).toBe('variableSource')
  })

  it('variableSource is a source node (no inputs — select-only)', () => {
    const def = BLOCK_REGISTRY.get('variableSource')
    expect(def).toBeDefined()
    expect(def!.nodeKind).toBe('csSource')
    expect(def!.inputs).toEqual([])
  })
})

// ── G3-1: Block taxonomy structure ──────────────────────────────────────────

describe('Block taxonomy structure (G3-1)', () => {
  it('has exactly 3 main categories', () => {
    expect(BLOCK_TAXONOMY).toHaveLength(3)
    expect(BLOCK_TAXONOMY.map((m) => m.id)).toEqual([
      'inputBlocks',
      'functionBlocks',
      'outputBlocks',
    ])
  })

  it('covers every block in BLOCK_REGISTRY', () => {
    const coveredTypes = new Set<string>()
    for (const main of BLOCK_TAXONOMY) {
      for (const sub of main.subcategories) {
        for (const def of getSubcategoryBlocks(sub)) {
          coveredTypes.add(def.type)
        }
      }
    }
    const missing = [...BLOCK_REGISTRY.keys()].filter((t) => !coveredTypes.has(t))
    expect(missing, `Blocks not in any taxonomy subcategory:\n${missing.join('\n')}`).toEqual([])
  })

  it('no block appears in multiple subcategories', () => {
    const seen = new Map<string, string>()
    const dupes: string[] = []
    for (const main of BLOCK_TAXONOMY) {
      for (const sub of main.subcategories) {
        for (const def of getSubcategoryBlocks(sub)) {
          if (seen.has(def.type)) {
            dupes.push(`${def.type} in both ${seen.get(def.type)} and ${sub.id}`)
          }
          seen.set(def.type, sub.id)
        }
      }
    }
    expect(dupes).toEqual([])
  })

  it('each subcategory has a unique id', () => {
    const ids = BLOCK_TAXONOMY.flatMap((m) => m.subcategories.map((s) => s.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('each subcategory has at least one block', () => {
    for (const main of BLOCK_TAXONOMY) {
      for (const sub of main.subcategories) {
        expect(getSubcategoryBlocks(sub).length, `${sub.id} has no blocks`).toBeGreaterThan(0)
      }
    }
  })

  it('Input Blocks has the required subcategories', () => {
    const input = BLOCK_TAXONOMY.find((m) => m.id === 'inputBlocks')!
    const subLabels = input.subcategories.map((s) => s.label)
    expect(subLabels).toEqual([
      'Standard number input',
      'Slider input',
      'Material input',
      'Constant input',
      'Variable input',
      'List input',
    ])
  })

  it('Output Blocks has the required subcategories', () => {
    const output = BLOCK_TAXONOMY.find((m) => m.id === 'outputBlocks')!
    const subLabels = output.subcategories.map((s) => s.label)
    expect(subLabels).toEqual(['Display', 'Graph blocks'])
  })
})

// ── D7-3: Unified Constant node catalog ─────────────────────────────────────

describe('Constants catalog (D7-3)', () => {
  it('unified constant block is registered', () => {
    const def = BLOCK_REGISTRY.get('constant')
    expect(def).toBeDefined()
    expect(def!.nodeKind).toBe('csSource')
    expect(def!.category).toBe('constants')
    expect(def!.inputs).toEqual([])
  })

  it('catalog contains all constant blocks except the unified one', () => {
    const catalog = getConstantsCatalog()
    const catalogTypes = new Set(catalog.map((c) => c.type))
    // Should NOT include the unified 'constant' block itself
    expect(catalogTypes.has('constant')).toBe(false)
    // Should include known constants
    expect(catalogTypes.has('pi')).toBe(true)
    expect(catalogTypes.has('const.physics.g0')).toBe(true)
    expect(catalogTypes.has('const.math.sqrt2')).toBe(true)
  })

  it('catalog does not include material/fluid presets', () => {
    const catalog = getConstantsCatalog()
    const materialTypes = catalog.filter(
      (c) => c.type.startsWith('preset.materials.') || c.type.startsWith('preset.fluids.'),
    )
    expect(materialTypes).toEqual([])
  })

  it('catalog has at least 20 entries', () => {
    const catalog = getConstantsCatalog()
    expect(catalog.length).toBeGreaterThanOrEqual(20)
  })
})

// ── D7-4: Unified Material node catalog ─────────────────────────────────────

describe('Materials catalog (D7-4)', () => {
  it('unified material block is registered', () => {
    const def = BLOCK_REGISTRY.get('material')
    expect(def).toBeDefined()
    expect(def!.nodeKind).toBe('csSource')
    expect(def!.category).toBe('presetMaterials')
    expect(def!.inputs).toEqual([])
  })

  it('catalog contains all material/fluid presets except the unified one', () => {
    const catalog = getMaterialsCatalog()
    const catalogTypes = new Set(catalog.map((c) => c.type))
    expect(catalogTypes.has('material')).toBe(false)
    expect(catalogTypes.has('preset.materials.steel_rho')).toBe(true)
    expect(catalogTypes.has('preset.fluids.water_rho_20c')).toBe(true)
  })

  it('catalog does not include physics/math constants', () => {
    const catalog = getMaterialsCatalog()
    const constTypes = catalog.filter(
      (c) => c.type.startsWith('const.') || ['pi', 'euler', 'tau', 'phi'].includes(c.type),
    )
    expect(constTypes).toEqual([])
  })

  it('catalog has at least 10 entries', () => {
    const catalog = getMaterialsCatalog()
    expect(catalog.length).toBeGreaterThanOrEqual(10)
  })
})
