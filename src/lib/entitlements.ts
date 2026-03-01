/**
 * entitlements.ts — plan-based feature gating for ChainSolve.
 *
 * Pure functions that map a user's `plan_status` to concrete limits.
 * No side effects, no Supabase calls — this module is imported by
 * both the project browser (AppShell) and the canvas editor.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type Plan = 'free' | 'trialing' | 'pro' | 'enterprise' | 'past_due' | 'canceled'

/** D11-1: Keys accepted by the checkout endpoint's plan_key parameter. */
export type PlanKey =
  | 'pro_monthly'
  | 'pro_annual'
  | 'ent_10_monthly'
  | 'ent_10_annual'
  | 'ent_unlimited_monthly'
  | 'ent_unlimited_annual'

export interface Entitlements {
  maxProjects: number
  maxCanvases: number
  canUploadCsv: boolean
  canUseArrays: boolean
  canUsePlots: boolean
  canUseRules: boolean
  canUseGroups: boolean
  canEditThemes: boolean
  /** D11-4: Whether user can export (PDF/XLSX/.chainsolvejson) and import. */
  canExport: boolean
  /** AI-1: Whether user can access the AI Copilot. Pro + Enterprise only. */
  canUseAi: boolean
}

// ── Entitlement map ──────────────────────────────────────────────────────────

const ENTITLEMENTS: Record<Plan, Entitlements> = {
  free: {
    maxProjects: 1,
    maxCanvases: 2,
    canUploadCsv: false,
    canUseArrays: false,
    canUsePlots: false,
    canUseRules: false,
    canUseGroups: false,
    canEditThemes: false,
    canExport: false,
    canUseAi: false,
  },
  trialing: {
    maxProjects: Infinity,
    maxCanvases: Infinity,
    canUploadCsv: true,
    canUseArrays: true,
    canUsePlots: true,
    canUseRules: true,
    canUseGroups: true,
    canEditThemes: true,
    canExport: true,
    canUseAi: true,
  },
  pro: {
    maxProjects: Infinity,
    maxCanvases: Infinity,
    canUploadCsv: true,
    canUseArrays: true,
    canUsePlots: true,
    canUseRules: true,
    canUseGroups: true,
    canEditThemes: true,
    canExport: true,
    canUseAi: true,
  },
  enterprise: {
    maxProjects: Infinity,
    maxCanvases: Infinity,
    canUploadCsv: true,
    canUseArrays: true,
    canUsePlots: true,
    canUseRules: true,
    canUseGroups: true,
    canEditThemes: true,
    canExport: true,
    canUseAi: true,
  },
  past_due: {
    maxProjects: 1,
    maxCanvases: 2,
    canUploadCsv: false,
    canUseArrays: false,
    canUsePlots: false,
    canUseRules: false,
    canUseGroups: false,
    canEditThemes: false,
    canExport: false,
    canUseAi: false,
  },
  canceled: {
    maxProjects: 1,
    maxCanvases: 2,
    canUploadCsv: false,
    canUseArrays: false,
    canUsePlots: false,
    canUseRules: false,
    canUseGroups: false,
    canEditThemes: false,
    canExport: false,
    canUseAi: false,
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getEntitlements(plan: Plan): Entitlements {
  return ENTITLEMENTS[plan]
}

/** True for trialing, pro, or enterprise (full access). */
export function isPro(plan: Plan): boolean {
  return plan === 'trialing' || plan === 'pro' || plan === 'enterprise'
}

/** Past-due and canceled users get read-only access to existing projects. */
export function isReadOnly(plan: Plan): boolean {
  return plan === 'past_due' || plan === 'canceled'
}

/**
 * Whether the user can install an Explore item of the given category.
 *
 * D9-3 rules:
 * - past_due / canceled: never
 * - Pro / trialing / enterprise: always
 * - Free: templates only, and only if projectCount < maxProjects (1)
 * - Free cannot install groups, themes, custom blocks, or block packs
 */
export function canInstallExploreItem(plan: Plan, category: string, projectCount: number): boolean {
  if (plan === 'past_due' || plan === 'canceled') return false
  if (isPro(plan)) return true
  // Free plan: templates only if project limit allows
  if (category === 'template') return projectCount < getEntitlements(plan).maxProjects
  return false
}

/** Whether the user can upload/publish content to Explore. Pro+ only. */
export function canUploadToExplore(plan: Plan): boolean {
  return isPro(plan)
}

/** Whether the user is allowed to create / duplicate / import a project. */
export function canCreateProject(plan: Plan, currentCount: number): boolean {
  if (plan === 'past_due' || plan === 'canceled') return false
  return currentCount < getEntitlements(plan).maxProjects
}

/** Whether the user is allowed to create a new canvas in a project. */
export function canCreateCanvas(plan: Plan, currentCount: number): boolean {
  if (plan === 'past_due' || plan === 'canceled') return false
  return currentCount < getEntitlements(plan).maxCanvases
}

/** Returns a banner kind when the plan requires a warning, or null. */
export function showBillingBanner(plan: Plan): 'past_due' | 'canceled' | null {
  if (plan === 'past_due') return 'past_due'
  if (plan === 'canceled') return 'canceled'
  return null
}

/**
 * Whether a block is usable under the given entitlements.
 * Free blocks always pass. Pro blocks are gated by category.
 */
export function isBlockEntitled(
  def: { proOnly?: boolean; category: string },
  ent: Entitlements,
): boolean {
  if (!def.proOnly) return true
  if (def.category === 'plot') return ent.canUsePlots
  return ent.canUseArrays
}
