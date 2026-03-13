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
  resolveEffectivePlan,
  resolveRole,
  isDeveloper,
  isAdmin,
  isEnterpriseAdmin,
  type Plan,
  type Role,
  type Entitlements,
} from './entitlements'

// ── getEntitlements ────────────────────────────────────────────────────────────

describe('getEntitlements', () => {
  it('free plan: limited projects and canvases, groups+themes allowed, no other pro features', () => {
    const ent = getEntitlements('free')
    expect(ent.maxProjects).toBe(1)
    expect(ent.maxCanvases).toBe(2)
    expect(ent.canUploadCsv).toBe(false)
    expect(ent.canUseArrays).toBe(false)
    expect(ent.canUsePlots).toBe(false)
    expect(ent.canUseRules).toBe(false)
    expect(ent.canUseGroups).toBe(true)
    expect(ent.canEditThemes).toBe(true)
    expect(ent.canExport).toBe(false)
    expect(ent.canCreateCustomMaterials).toBe(false)
    expect(ent.canCreateCustomFunctions).toBe(false)
    expect(ent.canUseListBlocks).toBe(false)
    expect(ent.canUseGraphTableOutputs).toBe(false)
    expect(ent.canImportFiles).toBe(false)
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
    expect(ent.canExport).toBe(true)
    expect(ent.canCreateCustomMaterials).toBe(true)
    expect(ent.canCreateCustomFunctions).toBe(true)
    expect(ent.canUseListBlocks).toBe(true)
    expect(ent.canUseGraphTableOutputs).toBe(true)
    expect(ent.canImportFiles).toBe(true)
  })

  it('pro plan: identical to trialing', () => {
    expect(getEntitlements('pro')).toEqual(getEntitlements('trialing'))
  })

  it('student plan: same feature access as pro, different AI daily limit', () => {
    const student = getEntitlements('student')
    const pro = getEntitlements('pro')
    // Same feature access flags and limits
    expect(student.maxProjects).toBe(pro.maxProjects)
    expect(student.maxCanvases).toBe(pro.maxCanvases)
    expect(student.canUploadCsv).toBe(pro.canUploadCsv)
    expect(student.canUseArrays).toBe(pro.canUseArrays)
    expect(student.canUsePlots).toBe(pro.canUsePlots)
    expect(student.canUseRules).toBe(pro.canUseRules)
    expect(student.canExport).toBe(pro.canExport)
    expect(student.canUseAi).toBe(pro.canUseAi)
    expect(student.maxNNParameters).toBe(pro.maxNNParameters)
    expect(student.maxNNEpochs).toBe(pro.maxNNEpochs)
    // Student has lower AI daily request limit
    expect(student.aiDailyRequestLimit).toBe(10)
  })

  it('enterprise plan: same feature access as pro, higher AI daily limit', () => {
    const ent = getEntitlements('enterprise')
    const pro = getEntitlements('pro')
    expect(ent.maxProjects).toBe(pro.maxProjects)
    expect(ent.maxCanvases).toBe(pro.maxCanvases)
    expect(ent.canUploadCsv).toBe(pro.canUploadCsv)
    expect(ent.canUseArrays).toBe(pro.canUseArrays)
    expect(ent.canUsePlots).toBe(pro.canUsePlots)
    expect(ent.canUseRules).toBe(pro.canUseRules)
    expect(ent.canExport).toBe(pro.canExport)
    expect(ent.canUseAi).toBe(pro.canUseAi)
    expect(ent.maxNNParameters).toBe(pro.maxNNParameters)
    expect(ent.maxNNEpochs).toBe(pro.maxNNEpochs)
    // Enterprise has higher AI daily request limit
    expect(ent.aiDailyRequestLimit).toBe(1000)
  })

  it('developer plan: same feature access as pro, unlimited AI daily limit', () => {
    const dev = getEntitlements('developer')
    const pro = getEntitlements('pro')
    expect(dev.maxProjects).toBe(pro.maxProjects)
    expect(dev.maxCanvases).toBe(pro.maxCanvases)
    expect(dev.canUploadCsv).toBe(pro.canUploadCsv)
    expect(dev.canUseArrays).toBe(pro.canUseArrays)
    expect(dev.canUsePlots).toBe(pro.canUsePlots)
    expect(dev.canUseRules).toBe(pro.canUseRules)
    expect(dev.canExport).toBe(pro.canExport)
    expect(dev.canUseAi).toBe(pro.canUseAi)
    expect(dev.maxNNParameters).toBe(pro.maxNNParameters)
    expect(dev.maxNNEpochs).toBe(pro.maxNNEpochs)
    // Developer has unlimited AI daily requests
    expect(dev.aiDailyRequestLimit).toBe(Infinity)
  })

  it('past_due plan: restricted (no groups/themes unlike free)', () => {
    const ent = getEntitlements('past_due')
    expect(ent.maxProjects).toBe(1)
    expect(ent.maxCanvases).toBe(2)
    expect(ent.canUseGroups).toBe(false)
    expect(ent.canEditThemes).toBe(false)
    expect(ent.canExport).toBe(false)
    expect(ent.canUseListBlocks).toBe(false)
    expect(ent.canUseGraphTableOutputs).toBe(false)
    expect(ent.canImportFiles).toBe(false)
  })

  it('canceled plan: restricted (no groups/themes unlike free)', () => {
    const ent = getEntitlements('canceled')
    expect(ent.maxProjects).toBe(1)
    expect(ent.maxCanvases).toBe(2)
    expect(ent.canUseGroups).toBe(false)
    expect(ent.canEditThemes).toBe(false)
    expect(ent.canExport).toBe(false)
    expect(ent.canUseListBlocks).toBe(false)
    expect(ent.canUseGraphTableOutputs).toBe(false)
    expect(ent.canImportFiles).toBe(false)
  })
})

// ── isPro ─────────────────────────────────────────────────────────────────────

describe('isPro', () => {
  const proCases: Plan[] = ['trialing', 'pro', 'student', 'enterprise', 'developer']
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

  const writablePlans: Plan[] = ['free', 'trialing', 'pro', 'student', 'enterprise', 'developer']
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

  it('student: always true (unlimited)', () => {
    expect(canCreateProject('student', 0)).toBe(true)
    expect(canCreateProject('student', 100)).toBe(true)
  })

  it('enterprise: always true (unlimited)', () => {
    expect(canCreateProject('enterprise', 0)).toBe(true)
    expect(canCreateProject('enterprise', 100)).toBe(true)
  })

  it('developer: always true (unlimited)', () => {
    expect(canCreateProject('developer', 0)).toBe(true)
    expect(canCreateProject('developer', 100)).toBe(true)
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

  it('student: always true (unlimited)', () => {
    expect(canCreateCanvas('student', 0)).toBe(true)
    expect(canCreateCanvas('student', 100)).toBe(true)
  })

  it('enterprise: always true (unlimited)', () => {
    expect(canCreateCanvas('enterprise', 0)).toBe(true)
    expect(canCreateCanvas('enterprise', 100)).toBe(true)
  })

  it('developer: always true (unlimited)', () => {
    expect(canCreateCanvas('developer', 0)).toBe(true)
    expect(canCreateCanvas('developer', 100)).toBe(true)
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

  const noBannerPlans: Plan[] = ['free', 'trialing', 'pro', 'student', 'enterprise', 'developer']
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

  it('student entitlements allow all pro features', () => {
    const studentEnt = getEntitlements('student')
    expect(isBlockEntitled({ proOnly: true, category: 'plot' }, studentEnt)).toBe(true)
    expect(isBlockEntitled({ proOnly: true, category: 'array' }, studentEnt)).toBe(true)
  })

  it('enterprise entitlements allow all pro features', () => {
    const entEnt = getEntitlements('enterprise')
    expect(isBlockEntitled({ proOnly: true, category: 'plot' }, entEnt)).toBe(true)
    expect(isBlockEntitled({ proOnly: true, category: 'array' }, entEnt)).toBe(true)
  })

  it('developer entitlements allow all pro features', () => {
    const devEnt = getEntitlements('developer')
    expect(isBlockEntitled({ proOnly: true, category: 'plot' }, devEnt)).toBe(true)
    expect(isBlockEntitled({ proOnly: true, category: 'array' }, devEnt)).toBe(true)
  })
})

// ── canInstallExploreItem (V2-025) ───────────────────────────────────────────

describe('canInstallExploreItem', () => {
  it('pro/trialing/student/enterprise can install any category', () => {
    const proCases: Plan[] = ['pro', 'trialing', 'student', 'enterprise', 'developer']
    for (const plan of proCases) {
      expect(canInstallExploreItem(plan, 'template', 0)).toBe(true)
      expect(canInstallExploreItem(plan, 'block_pack', 5)).toBe(true)
      expect(canInstallExploreItem(plan, 'theme', 10)).toBe(true)
      expect(canInstallExploreItem(plan, 'group', 0)).toBe(true)
      expect(canInstallExploreItem(plan, 'custom_block', 0)).toBe(true)
    }
  })

  it('free cannot install anything from Explore (browse only)', () => {
    expect(canInstallExploreItem('free', 'template', 0)).toBe(false)
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
  it('returns true for pro/trialing/student/enterprise', () => {
    expect(canUploadToExplore('pro')).toBe(true)
    expect(canUploadToExplore('trialing')).toBe(true)
    expect(canUploadToExplore('student')).toBe(true)
    expect(canUploadToExplore('enterprise')).toBe(true)
    expect(canUploadToExplore('developer')).toBe(true)
  })

  it('returns false for free/past_due/canceled', () => {
    expect(canUploadToExplore('free')).toBe(false)
    expect(canUploadToExplore('past_due')).toBe(false)
    expect(canUploadToExplore('canceled')).toBe(false)
  })
})

// ── resolveEffectivePlan (E2-6) ──────────────────────────────────────────────

describe('resolveEffectivePlan', () => {
  it('returns "free" for null profile', () => {
    expect(resolveEffectivePlan(null)).toBe('free')
  })

  it('returns the profile plan when no developer/admin flags', () => {
    expect(resolveEffectivePlan({ plan: 'free', is_developer: false, is_admin: false })).toBe(
      'free',
    )
    expect(resolveEffectivePlan({ plan: 'pro', is_developer: false, is_admin: false })).toBe('pro')
    expect(resolveEffectivePlan({ plan: 'canceled', is_developer: false, is_admin: false })).toBe(
      'canceled',
    )
  })

  it('returns "developer" for developer accounts regardless of plan', () => {
    expect(resolveEffectivePlan({ plan: 'free', is_developer: true, is_admin: false })).toBe(
      'developer',
    )
    expect(resolveEffectivePlan({ plan: 'canceled', is_developer: true, is_admin: false })).toBe(
      'developer',
    )
  })

  it('returns "enterprise" for admin accounts regardless of plan', () => {
    expect(resolveEffectivePlan({ plan: 'free', is_developer: false, is_admin: true })).toBe(
      'enterprise',
    )
    expect(resolveEffectivePlan({ plan: 'past_due', is_developer: false, is_admin: true })).toBe(
      'enterprise',
    )
  })

  it('handles missing flags gracefully (defaults to plan)', () => {
    expect(resolveEffectivePlan({ plan: 'free' })).toBe('free')
    expect(resolveEffectivePlan({ plan: 'pro' })).toBe('pro')
  })

  it('developer + admin both set still returns developer (developer takes precedence)', () => {
    expect(resolveEffectivePlan({ plan: 'free', is_developer: true, is_admin: true })).toBe(
      'developer',
    )
  })

  it('developer entitlements unlock all features', () => {
    const plan = resolveEffectivePlan({ plan: 'free', is_developer: true })
    const ent = getEntitlements(plan)
    expect(ent.maxProjects).toBe(Infinity)
    expect(ent.maxCanvases).toBe(Infinity)
    expect(ent.canUploadCsv).toBe(true)
    expect(ent.canUseArrays).toBe(true)
    expect(ent.canUsePlots).toBe(true)
    expect(ent.canExport).toBe(true)
    expect(ent.canUseAi).toBe(true)
    expect(ent.canCreateCustomMaterials).toBe(true)
    expect(ent.canEditThemes).toBe(true)
  })

  it('V2-026: canEditThemes uses entitlements, not isPro', () => {
    // Free users can edit themes (canEditThemes = true for free plan)
    expect(getEntitlements('free').canEditThemes).toBe(true)
    // past_due and canceled cannot
    expect(getEntitlements('past_due').canEditThemes).toBe(false)
    expect(getEntitlements('canceled').canEditThemes).toBe(false)
    // Developer (enterprise) can
    const devPlan = resolveEffectivePlan({ plan: 'free', is_developer: true })
    expect(getEntitlements(devPlan).canEditThemes).toBe(true)
  })

  it('returns "student" for verified student with free plan', () => {
    expect(
      resolveEffectivePlan({
        plan: 'free',
        is_developer: false,
        is_admin: false,
        is_student: true,
      }),
    ).toBe('student')
  })

  it('student flag does not override pro plan', () => {
    expect(
      resolveEffectivePlan({ plan: 'pro', is_developer: false, is_admin: false, is_student: true }),
    ).toBe('pro')
  })

  it('developer takes precedence over student', () => {
    expect(resolveEffectivePlan({ plan: 'free', is_developer: true, is_student: true })).toBe(
      'developer',
    )
  })

  it('student entitlements unlock all pro features', () => {
    const plan = resolveEffectivePlan({ plan: 'free', is_student: true })
    const ent = getEntitlements(plan)
    expect(ent.maxProjects).toBe(Infinity)
    expect(ent.maxCanvases).toBe(Infinity)
    expect(ent.canUploadCsv).toBe(true)
    expect(ent.canUseAi).toBe(true)
    expect(ent.canExport).toBe(true)
    expect(ent.canCreateCustomMaterials).toBe(true)
    expect(ent.canCreateCustomFunctions).toBe(true)
    expect(ent.canUseListBlocks).toBe(true)
    expect(ent.canUseGraphTableOutputs).toBe(true)
    expect(ent.canImportFiles).toBe(true)
  })
})

// ── resolveRole (J3-1) ──────────────────────────────────────────────────────

describe('resolveRole', () => {
  it('returns "free" for null profile', () => {
    expect(resolveRole(null)).toBe('free')
  })

  it('returns "developer" for is_developer regardless of plan', () => {
    expect(resolveRole({ plan: 'free', is_developer: true })).toBe('developer')
    expect(resolveRole({ plan: 'pro', is_developer: true })).toBe('developer')
    expect(resolveRole({ plan: 'enterprise', is_developer: true })).toBe('developer')
    expect(resolveRole({ plan: 'canceled', is_developer: true })).toBe('developer')
  })

  it('returns "enterprise_admin" for is_admin + enterprise plan', () => {
    expect(resolveRole({ plan: 'enterprise', is_admin: true })).toBe('enterprise_admin')
  })

  it('returns "admin" for is_admin without enterprise plan', () => {
    expect(resolveRole({ plan: 'free', is_admin: true })).toBe('admin')
    expect(resolveRole({ plan: 'pro', is_admin: true })).toBe('admin')
  })

  it('returns "enterprise" for enterprise plan without admin', () => {
    expect(resolveRole({ plan: 'enterprise' })).toBe('enterprise')
    expect(resolveRole({ plan: 'enterprise', is_admin: false })).toBe('enterprise')
  })

  it('returns "pro" for pro and trialing plans', () => {
    expect(resolveRole({ plan: 'pro' })).toBe('pro')
    expect(resolveRole({ plan: 'trialing' })).toBe('pro')
  })

  it('returns "student" for verified student with free plan', () => {
    expect(resolveRole({ plan: 'free', is_student: true })).toBe('student')
  })

  it('returns "free" for plain free plan', () => {
    expect(resolveRole({ plan: 'free' })).toBe('free')
  })

  it('returns "past_due" for past_due plan', () => {
    expect(resolveRole({ plan: 'past_due' })).toBe('past_due')
  })

  it('returns "canceled" for canceled plan', () => {
    expect(resolveRole({ plan: 'canceled' })).toBe('canceled')
  })

  it('developer takes precedence over admin', () => {
    expect(resolveRole({ plan: 'enterprise', is_developer: true, is_admin: true })).toBe(
      'developer',
    )
  })

  it('developer takes precedence over student', () => {
    expect(resolveRole({ plan: 'free', is_developer: true, is_student: true })).toBe('developer')
  })

  it('all roles are valid Role type values', () => {
    const allRoles: Role[] = [
      'developer',
      'enterprise_admin',
      'admin',
      'enterprise',
      'pro',
      'student',
      'free',
      'past_due',
      'canceled',
    ]
    expect(allRoles).toHaveLength(9)
  })
})

// ── isDeveloper (J3-1) ──────────────────────────────────────────────────────

describe('isDeveloper', () => {
  it('returns true for is_developer=true', () => {
    expect(isDeveloper({ plan: 'free', is_developer: true })).toBe(true)
  })

  it('returns false for is_developer=false or missing', () => {
    expect(isDeveloper({ plan: 'free', is_developer: false })).toBe(false)
    expect(isDeveloper({ plan: 'free' })).toBe(false)
    expect(isDeveloper(null)).toBe(false)
  })

  it('returns false for admin-only accounts', () => {
    expect(isDeveloper({ plan: 'enterprise', is_admin: true, is_developer: false })).toBe(false)
  })
})

// ── isAdmin (J3-1) ──────────────────────────────────────────────────────────

describe('isAdmin', () => {
  it('returns true for is_admin=true', () => {
    expect(isAdmin({ plan: 'free', is_admin: true })).toBe(true)
  })

  it('returns true for is_developer=true (developers are admins)', () => {
    expect(isAdmin({ plan: 'free', is_developer: true })).toBe(true)
  })

  it('returns false for regular users', () => {
    expect(isAdmin({ plan: 'free' })).toBe(false)
    expect(isAdmin({ plan: 'pro' })).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })
})

// ── isEnterpriseAdmin (J3-1) ────────────────────────────────────────────────

describe('isEnterpriseAdmin', () => {
  it('returns true for is_admin + enterprise plan', () => {
    expect(isEnterpriseAdmin({ plan: 'enterprise', is_admin: true })).toBe(true)
  })

  it('returns false for is_admin without enterprise plan', () => {
    expect(isEnterpriseAdmin({ plan: 'free', is_admin: true })).toBe(false)
    expect(isEnterpriseAdmin({ plan: 'pro', is_admin: true })).toBe(false)
  })

  it('returns false for enterprise without admin', () => {
    expect(isEnterpriseAdmin({ plan: 'enterprise' })).toBe(false)
    expect(isEnterpriseAdmin({ plan: 'enterprise', is_admin: false })).toBe(false)
  })

  it('returns false for null profile', () => {
    expect(isEnterpriseAdmin(null)).toBe(false)
  })
})

// ── Role i18n keys (J3-1) ───────────────────────────────────────────────────

describe('Role i18n keys', () => {
  it('en.json has all role labels', async () => {
    const en = (await import('../i18n/locales/en.json')).default
    const roles = en.roles as Record<string, string>
    expect(roles).toBeDefined()
    const expected: Role[] = [
      'developer',
      'enterprise_admin',
      'admin',
      'enterprise',
      'pro',
      'student',
      'free',
      'past_due',
      'canceled',
    ]
    for (const key of expected) {
      expect(roles[key], `missing roles.${key}`).toBeTruthy()
    }
  })

  it('all locales have roles section', async () => {
    const locales = ['de', 'fr', 'es', 'it', 'he'] as const
    for (const locale of locales) {
      const mod = await import(`../i18n/locales/${locale}.json`)
      const json = mod.default as Record<string, unknown>
      expect(json.roles, `${locale}.json missing roles section`).toBeDefined()
    }
  })
})
