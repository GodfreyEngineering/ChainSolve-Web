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
  LIBRARY_FAMILIES,
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

// ── D6-4: Library families structure ────────────────────────────────────────

describe('Library families structure (D6-4)', () => {
  it('LIBRARY_FAMILIES covers all categories in CATEGORY_ORDER', () => {
    const familyCats = new Set(LIBRARY_FAMILIES.flatMap((f) => f.categories))
    const missing = CATEGORY_ORDER.filter((c) => !familyCats.has(c))
    expect(missing, `Categories not in any family:\n${missing.join('\n')}`).toEqual([])
  })

  it('no category appears in multiple families', () => {
    const seen = new Map<string, string>()
    const dupes: string[] = []
    for (const fam of LIBRARY_FAMILIES) {
      for (const cat of fam.categories) {
        if (seen.has(cat)) dupes.push(`${cat} in both ${seen.get(cat)} and ${fam.id}`)
        seen.set(cat, fam.id)
      }
    }
    expect(dupes).toEqual([])
  })

  it('each family has a unique id', () => {
    const ids = LIBRARY_FAMILIES.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('each family has at least one category', () => {
    for (const fam of LIBRARY_FAMILIES) {
      expect(fam.categories.length, `${fam.id} has no categories`).toBeGreaterThan(0)
    }
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
