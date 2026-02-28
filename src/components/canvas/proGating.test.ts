/**
 * proGating.test.ts — Structural tests verifying Pro feature gating
 * consistency across block library and UI entrypoints.
 *
 * D6-2: Locked Pro features visible to Free users.
 * D6-3: Variable CRUD must not exist in block library.
 */

import { describe, it, expect } from 'vitest'
import { BLOCK_REGISTRY, CATEGORY_ORDER } from '../../blocks/registry'
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
