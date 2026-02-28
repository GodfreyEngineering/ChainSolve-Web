/**
 * entitlements.test.ts — Unit tests for the entitlement matrix.
 *
 * Covers all 5 plans × all 7 exported functions.
 * All functions are pure — no mocking required.
 */

import { describe, it, expect } from 'vitest'
import {
  getEntitlements,
  isPro,
  isReadOnly,
  canCreateProject,
  canCreateCanvas,
  showBillingBanner,
  isBlockEntitled,
  canInstallExploreItem,
  canUploadToExplore,
  type Plan,
  type Entitlements,
} from './entitlements'

// ── getEntitlements ────────────────────────────────────────────────────────────

describe('getEntitlements', () => {
  it('free plan: limited projects and canvases, no pro features', () => {
    const ent = getEntitlements('free')
    expect(ent.maxProjects).toBe(1)
    expect(ent.maxCanvases).toBe(2)
    expect(ent.canUploadCsv).toBe(false)
    expect(ent.canUseArrays).toBe(false)
    expect(ent.canUsePlots).toBe(false)
    expect(ent.canUseRules).toBe(false)
    expect(ent.canUseGroups).toBe(false)
    expect(ent.canEditThemes).toBe(false)
  })

  it('trialing plan: unlimited projects and canvases, all pro features', () => {
    const ent = getEntitlements('trialing')
    expect(ent.maxProjects).toBe(Infinity)
    expect(ent.maxCanvases).toBe(Infinity)
    expect(ent.canUploadCsv).toBe(true)
    expect(ent.canUseArrays).toBe(true)
    expect(ent.canUsePlots).toBe(true)
    expect(ent.canUseRules).toBe(true)
    expect(ent.canUseGroups).toBe(true)
    expect(ent.canEditThemes).toBe(true)
  })

  it('pro plan: identical to trialing', () => {
    expect(getEntitlements('pro')).toEqual(getEntitlements('trialing'))
  })

  it('enterprise plan: identical entitlements to pro', () => {
    expect(getEntitlements('enterprise')).toEqual(getEntitlements('pro'))
  })

  it('past_due plan: identical entitlements to free', () => {
    expect(getEntitlements('past_due')).toEqual(getEntitlements('free'))
  })

  it('canceled plan: identical entitlements to free', () => {
    expect(getEntitlements('canceled')).toEqual(getEntitlements('free'))
  })
})

// ── isPro ─────────────────────────────────────────────────────────────────────

describe('isPro', () => {
  const proCases: Plan[] = ['trialing', 'pro', 'enterprise']
  const nonProCases: Plan[] = ['free', 'past_due', 'canceled']

  for (const plan of proCases) {
    it(`returns true for ${plan}`, () => {
      expect(isPro(plan)).toBe(true)
    })
  }

  for (const plan of nonProCases) {
    it(`returns false for ${plan}`, () => {
      expect(isPro(plan)).toBe(false)
    })
  }
})

// ── isReadOnly ─────────────────────────────────────────────────────────────────

describe('isReadOnly', () => {
  it('returns true for canceled', () => {
    expect(isReadOnly('canceled')).toBe(true)
  })

  it('returns true for past_due', () => {
    expect(isReadOnly('past_due')).toBe(true)
  })

  const writablePlans: Plan[] = ['free', 'trialing', 'pro', 'enterprise']
  for (const plan of writablePlans) {
    it(`returns false for ${plan}`, () => {
      expect(isReadOnly(plan)).toBe(false)
    })
  }
})

// ── canCreateProject ───────────────────────────────────────────────────────────

describe('canCreateProject', () => {
  it('canceled: always false regardless of count', () => {
    expect(canCreateProject('canceled', 0)).toBe(false)
    expect(canCreateProject('canceled', 1)).toBe(false)
    expect(canCreateProject('canceled', 99)).toBe(false)
  })

  it('past_due: always false regardless of count', () => {
    expect(canCreateProject('past_due', 0)).toBe(false)
    expect(canCreateProject('past_due', 1)).toBe(false)
    expect(canCreateProject('past_due', 99)).toBe(false)
  })

  it('free: true below limit (maxProjects=1), false at or above', () => {
    expect(canCreateProject('free', 0)).toBe(true)
    expect(canCreateProject('free', 1)).toBe(false)
    expect(canCreateProject('free', 2)).toBe(false)
  })

  it('trialing: always true (unlimited)', () => {
    expect(canCreateProject('trialing', 0)).toBe(true)
    expect(canCreateProject('trialing', 100)).toBe(true)
    expect(canCreateProject('trialing', 9999)).toBe(true)
  })

  it('pro: always true (unlimited)', () => {
    expect(canCreateProject('pro', 0)).toBe(true)
    expect(canCreateProject('pro', 100)).toBe(true)
  })

  it('enterprise: always true (unlimited)', () => {
    expect(canCreateProject('enterprise', 0)).toBe(true)
    expect(canCreateProject('enterprise', 100)).toBe(true)
  })
})

// ── canCreateCanvas ────────────────────────────────────────────────────────────

describe('canCreateCanvas', () => {
  it('canceled: always false regardless of count', () => {
    expect(canCreateCanvas('canceled', 0)).toBe(false)
    expect(canCreateCanvas('canceled', 1)).toBe(false)
  })

  it('past_due: always false regardless of count', () => {
    expect(canCreateCanvas('past_due', 0)).toBe(false)
    expect(canCreateCanvas('past_due', 1)).toBe(false)
    expect(canCreateCanvas('past_due', 99)).toBe(false)
  })

  it('free: true below limit (maxCanvases=2), false at or above', () => {
    expect(canCreateCanvas('free', 0)).toBe(true)
    expect(canCreateCanvas('free', 1)).toBe(true)
    expect(canCreateCanvas('free', 2)).toBe(false)
    expect(canCreateCanvas('free', 3)).toBe(false)
  })

  it('trialing: always true (unlimited)', () => {
    expect(canCreateCanvas('trialing', 0)).toBe(true)
    expect(canCreateCanvas('trialing', 100)).toBe(true)
  })

  it('pro: always true (unlimited)', () => {
    expect(canCreateCanvas('pro', 0)).toBe(true)
    expect(canCreateCanvas('pro', 100)).toBe(true)
  })

  it('enterprise: always true (unlimited)', () => {
    expect(canCreateCanvas('enterprise', 0)).toBe(true)
    expect(canCreateCanvas('enterprise', 100)).toBe(true)
  })
})

// ── showBillingBanner ──────────────────────────────────────────────────────────

describe('showBillingBanner', () => {
  it('returns "past_due" for past_due plan', () => {
    expect(showBillingBanner('past_due')).toBe('past_due')
  })

  it('returns "canceled" for canceled plan', () => {
    expect(showBillingBanner('canceled')).toBe('canceled')
  })

  const noBannerPlans: Plan[] = ['free', 'trialing', 'pro', 'enterprise']
  for (const plan of noBannerPlans) {
    it(`returns null for ${plan}`, () => {
      expect(showBillingBanner(plan)).toBeNull()
    })
  }
})

// ── isBlockEntitled ────────────────────────────────────────────────────────────

describe('isBlockEntitled', () => {
  const freeEnt: Entitlements = getEntitlements('free')
  const proEnt: Entitlements = getEntitlements('pro')

  it('free blocks (proOnly=false) are always entitled', () => {
    expect(isBlockEntitled({ proOnly: false, category: 'math' }, freeEnt)).toBe(true)
    expect(isBlockEntitled({ proOnly: false, category: 'math' }, proEnt)).toBe(true)
    expect(isBlockEntitled({ proOnly: undefined, category: 'math' }, freeEnt)).toBe(true)
  })

  it('pro plot blocks require canUsePlots', () => {
    expect(isBlockEntitled({ proOnly: true, category: 'plot' }, proEnt)).toBe(true)
    expect(isBlockEntitled({ proOnly: true, category: 'plot' }, freeEnt)).toBe(false)
  })

  it('pro non-plot blocks require canUseArrays', () => {
    expect(isBlockEntitled({ proOnly: true, category: 'array' }, proEnt)).toBe(true)
    expect(isBlockEntitled({ proOnly: true, category: 'array' }, freeEnt)).toBe(false)
  })

  it('past_due and canceled entitlements block pro features', () => {
    const pastDueEnt = getEntitlements('past_due')
    const canceledEnt = getEntitlements('canceled')
    expect(isBlockEntitled({ proOnly: true, category: 'plot' }, pastDueEnt)).toBe(false)
    expect(isBlockEntitled({ proOnly: true, category: 'array' }, canceledEnt)).toBe(false)
  })

  it('trialing entitlements allow all pro features', () => {
    const trialingEnt = getEntitlements('trialing')
    expect(isBlockEntitled({ proOnly: true, category: 'plot' }, trialingEnt)).toBe(true)
    expect(isBlockEntitled({ proOnly: true, category: 'array' }, trialingEnt)).toBe(true)
  })

  it('enterprise entitlements allow all pro features', () => {
    const entEnt = getEntitlements('enterprise')
    expect(isBlockEntitled({ proOnly: true, category: 'plot' }, entEnt)).toBe(true)
    expect(isBlockEntitled({ proOnly: true, category: 'array' }, entEnt)).toBe(true)
  })
})

// ── canInstallExploreItem (D9-3) ─────────────────────────────────────────────

describe('canInstallExploreItem', () => {
  it('pro/trialing/enterprise can install any category', () => {
    const proCases: Plan[] = ['pro', 'trialing', 'enterprise']
    for (const plan of proCases) {
      expect(canInstallExploreItem(plan, 'template', 0)).toBe(true)
      expect(canInstallExploreItem(plan, 'block_pack', 5)).toBe(true)
      expect(canInstallExploreItem(plan, 'theme', 10)).toBe(true)
      expect(canInstallExploreItem(plan, 'group', 0)).toBe(true)
      expect(canInstallExploreItem(plan, 'custom_block', 0)).toBe(true)
    }
  })

  it('free can install template when projectCount < maxProjects', () => {
    expect(canInstallExploreItem('free', 'template', 0)).toBe(true)
  })

  it('free cannot install template when projectCount >= maxProjects', () => {
    expect(canInstallExploreItem('free', 'template', 1)).toBe(false)
    expect(canInstallExploreItem('free', 'template', 5)).toBe(false)
  })

  it('free cannot install non-template categories', () => {
    expect(canInstallExploreItem('free', 'block_pack', 0)).toBe(false)
    expect(canInstallExploreItem('free', 'theme', 0)).toBe(false)
    expect(canInstallExploreItem('free', 'group', 0)).toBe(false)
    expect(canInstallExploreItem('free', 'custom_block', 0)).toBe(false)
  })

  it('past_due and canceled cannot install anything', () => {
    for (const plan of ['past_due', 'canceled'] as Plan[]) {
      expect(canInstallExploreItem(plan, 'template', 0)).toBe(false)
      expect(canInstallExploreItem(plan, 'block_pack', 0)).toBe(false)
      expect(canInstallExploreItem(plan, 'theme', 0)).toBe(false)
    }
  })
})

// ── canUploadToExplore (D9-3) ────────────────────────────────────────────────

describe('canUploadToExplore', () => {
  it('returns true for pro/trialing/enterprise', () => {
    expect(canUploadToExplore('pro')).toBe(true)
    expect(canUploadToExplore('trialing')).toBe(true)
    expect(canUploadToExplore('enterprise')).toBe(true)
  })

  it('returns false for free/past_due/canceled', () => {
    expect(canUploadToExplore('free')).toBe(false)
    expect(canUploadToExplore('past_due')).toBe(false)
    expect(canUploadToExplore('canceled')).toBe(false)
  })
})
