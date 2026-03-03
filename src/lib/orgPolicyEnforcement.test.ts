import { describe, it, expect } from 'vitest'
import { applyOrgPolicyOverrides, getBlockedFeatures } from './orgPolicyEnforcement'
import type { Entitlements } from './entitlements'
import type { OrgPolicy } from './orgsService'

/** Minimal pro entitlements with all capabilities enabled. */
const proEntitlements: Entitlements = {
  maxProjects: 50,
  maxCanvases: 20,
  canUploadCsv: true,
  canUseArrays: true,
  canUsePlots: true,
  canUseRules: true,
  canUseGroups: true,
  canEditThemes: true,
  canExport: true,
  canUseAi: true,
  canCreateCustomMaterials: true,
  canCreateCustomFunctions: true,
  canUseListBlocks: true,
  canUseGraphTableOutputs: true,
  canImportFiles: true,
}

/** Minimal free entitlements with restricted capabilities. */
const freeEntitlements: Entitlements = {
  maxProjects: 3,
  maxCanvases: 1,
  canUploadCsv: false,
  canUseArrays: false,
  canUsePlots: false,
  canUseRules: false,
  canUseGroups: false,
  canEditThemes: false,
  canExport: false,
  canUseAi: false,
  canCreateCustomMaterials: false,
  canCreateCustomFunctions: false,
  canUseListBlocks: false,
  canUseGraphTableOutputs: false,
  canImportFiles: false,
}

/** Default org policy — everything allowed. */
const openPolicy: OrgPolicy = {
  policy_explore_enabled: true,
  policy_installs_allowed: true,
  policy_comments_allowed: true,
  policy_single_session: false,
  policy_ai_enabled: true,
  policy_export_enabled: true,
  policy_custom_fns_enabled: true,
  policy_data_retention_days: null,
}

/** Restrictive org policy — AI, export, custom fns all disabled. */
const restrictivePolicy: OrgPolicy = {
  policy_explore_enabled: false,
  policy_installs_allowed: false,
  policy_comments_allowed: false,
  policy_single_session: true,
  policy_ai_enabled: false,
  policy_export_enabled: false,
  policy_custom_fns_enabled: false,
  policy_data_retention_days: 90,
}

describe('applyOrgPolicyOverrides', () => {
  it('returns entitlements unchanged when orgPolicy is null', () => {
    const result = applyOrgPolicyOverrides(proEntitlements, null)
    expect(result).toEqual(proEntitlements)
  })

  it('returns entitlements unchanged when all policies are enabled', () => {
    const result = applyOrgPolicyOverrides(proEntitlements, openPolicy)
    expect(result).toEqual(proEntitlements)
  })

  it('restricts AI, export, and custom fns when policy disables them', () => {
    const result = applyOrgPolicyOverrides(proEntitlements, restrictivePolicy)
    expect(result.canUseAi).toBe(false)
    expect(result.canExport).toBe(false)
    expect(result.canCreateCustomFunctions).toBe(false)
  })

  it('preserves non-policy entitlements when restricting', () => {
    const result = applyOrgPolicyOverrides(proEntitlements, restrictivePolicy)
    expect(result.maxProjects).toBe(50)
    expect(result.canUploadCsv).toBe(true)
    expect(result.canUsePlots).toBe(true)
    expect(result.canUseGroups).toBe(true)
  })

  it('does not grant capabilities to free users even with open policy', () => {
    const result = applyOrgPolicyOverrides(freeEntitlements, openPolicy)
    expect(result.canUseAi).toBe(false)
    expect(result.canExport).toBe(false)
    expect(result.canCreateCustomFunctions).toBe(false)
  })

  it('restricts already-disabled entitlements (AND semantics)', () => {
    const result = applyOrgPolicyOverrides(freeEntitlements, restrictivePolicy)
    expect(result.canUseAi).toBe(false)
    expect(result.canExport).toBe(false)
    expect(result.canCreateCustomFunctions).toBe(false)
  })

  it('selectively restricts only AI when only AI is disabled', () => {
    const aiOnlyRestricted: OrgPolicy = { ...openPolicy, policy_ai_enabled: false }
    const result = applyOrgPolicyOverrides(proEntitlements, aiOnlyRestricted)
    expect(result.canUseAi).toBe(false)
    expect(result.canExport).toBe(true)
    expect(result.canCreateCustomFunctions).toBe(true)
  })
})

describe('getBlockedFeatures', () => {
  it('returns empty array when orgPolicy is null', () => {
    expect(getBlockedFeatures(null)).toEqual([])
  })

  it('returns empty array when all policies are enabled', () => {
    expect(getBlockedFeatures(openPolicy)).toEqual([])
  })

  it('lists all blocked features for restrictive policy', () => {
    const blocked = getBlockedFeatures(restrictivePolicy)
    expect(blocked).toContain('ai')
    expect(blocked).toContain('export')
    expect(blocked).toContain('customFunctions')
    expect(blocked).toContain('explore')
    expect(blocked).toContain('installs')
    expect(blocked).toContain('comments')
    expect(blocked).toHaveLength(6)
  })

  it('lists only specific blocked features', () => {
    const partial: OrgPolicy = {
      ...openPolicy,
      policy_ai_enabled: false,
      policy_export_enabled: false,
    }
    const blocked = getBlockedFeatures(partial)
    expect(blocked).toEqual(['ai', 'export'])
  })
})
