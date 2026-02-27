/**
 * entitlements.ts — plan-based feature gating for ChainSolve.
 *
 * Pure functions that map a user's `plan_status` to concrete limits.
 * No side effects, no Supabase calls — this module is imported by
 * both the project browser (AppShell) and the canvas editor.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type Plan = 'free' | 'trialing' | 'pro' | 'past_due' | 'canceled'

export interface Entitlements {
  maxProjects: number
  maxCanvases: number
  canUploadCsv: boolean
  canUseArrays: boolean
  canUsePlots: boolean
  canUseRules: boolean
  canUseGroups: boolean
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
  },
  trialing: {
    maxProjects: Infinity,
    maxCanvases: Infinity,
    canUploadCsv: true,
    canUseArrays: true,
    canUsePlots: true,
    canUseRules: true,
    canUseGroups: true,
  },
  pro: {
    maxProjects: Infinity,
    maxCanvases: Infinity,
    canUploadCsv: true,
    canUseArrays: true,
    canUsePlots: true,
    canUseRules: true,
    canUseGroups: true,
  },
  past_due: {
    maxProjects: 1,
    maxCanvases: 2,
    canUploadCsv: false,
    canUseArrays: false,
    canUsePlots: false,
    canUseRules: false,
    canUseGroups: false,
  },
  canceled: {
    maxProjects: 1,
    maxCanvases: 2,
    canUploadCsv: false,
    canUseArrays: false,
    canUsePlots: false,
    canUseRules: false,
    canUseGroups: false,
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getEntitlements(plan: Plan): Entitlements {
  return ENTITLEMENTS[plan]
}

/** True for trialing or pro (full access). */
export function isPro(plan: Plan): boolean {
  return plan === 'trialing' || plan === 'pro'
}

/** Past-due and canceled users get read-only access to existing projects. */
export function isReadOnly(plan: Plan): boolean {
  return plan === 'past_due' || plan === 'canceled'
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
