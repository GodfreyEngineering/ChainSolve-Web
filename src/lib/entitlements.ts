/**
 * entitlements.ts — plan-based feature gating for ChainSolve.
 *
 * Pure functions that map a user's `plan_status` to concrete limits.
 * No side effects, no Supabase calls — this module is imported by
 * both the workspace and the canvas editor.
 *
 * J3-1: Formal role hierarchy (separate from billing plan):
 *   developer       — is_developer flag; all features + dev tools
 *   enterprise_admin — is_admin + enterprise plan; org management
 *   admin           — is_admin flag; moderation tools
 *   enterprise      — enterprise billing plan
 *   pro             — pro or trialing billing plan
 *   student         — verified student (free plan + is_student)
 *   free            — default
 *   past_due        — payment overdue, read-only
 *   canceled        — subscription canceled, read-only
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type Plan =
  | 'free'
  | 'trialing'
  | 'pro'
  | 'student'
  | 'enterprise'
  | 'developer'
  | 'past_due'
  | 'canceled'

/**
 * J3-1: Formal role representing the user's authority level.
 * Unlike Plan (billing status), Role determines the user's effective
 * permissions and UI treatment.
 */
export type Role =
  | 'developer'
  | 'enterprise_admin'
  | 'admin'
  | 'enterprise'
  | 'pro'
  | 'student'
  | 'free'
  | 'past_due'
  | 'canceled'

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
  /** H3-2: Whether user can create custom materials. Pro + Enterprise only. */
  canCreateCustomMaterials: boolean
  /** H5-1: Whether user can create custom function blocks. Pro + Enterprise only. */
  canCreateCustomFunctions: boolean
  /** H8-1: Whether user can use list input blocks. Pro + Enterprise only. */
  canUseListBlocks: boolean
  /** H8-1: Whether user can use graph/table output blocks. Pro + Enterprise only. */
  canUseGraphTableOutputs: boolean
  /** H8-1: Whether user can import files into projects. Pro + Enterprise only. */
  canImportFiles: boolean
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
    canUseGroups: true,
    canEditThemes: true,
    canExport: false,
    canUseAi: false,
    canCreateCustomMaterials: false,
    canCreateCustomFunctions: false,
    canUseListBlocks: false,
    canUseGraphTableOutputs: false,
    canImportFiles: false,
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
    canCreateCustomMaterials: true,
    canCreateCustomFunctions: true,
    canUseListBlocks: true,
    canUseGraphTableOutputs: true,
    canImportFiles: true,
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
    canCreateCustomMaterials: true,
    canCreateCustomFunctions: true,
    canUseListBlocks: true,
    canUseGraphTableOutputs: true,
    canImportFiles: true,
  },
  student: {
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
    canCreateCustomMaterials: true,
    canCreateCustomFunctions: true,
    canUseListBlocks: true,
    canUseGraphTableOutputs: true,
    canImportFiles: true,
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
    canCreateCustomMaterials: true,
    canCreateCustomFunctions: true,
    canUseListBlocks: true,
    canUseGraphTableOutputs: true,
    canImportFiles: true,
  },
  developer: {
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
    canCreateCustomMaterials: true,
    canCreateCustomFunctions: true,
    canUseListBlocks: true,
    canUseGraphTableOutputs: true,
    canImportFiles: true,
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
    canCreateCustomMaterials: false,
    canCreateCustomFunctions: false,
    canUseListBlocks: false,
    canUseGraphTableOutputs: false,
    canImportFiles: false,
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
    canCreateCustomMaterials: false,
    canCreateCustomFunctions: false,
    canUseListBlocks: false,
    canUseGraphTableOutputs: false,
    canImportFiles: false,
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * V3-3.2: localStorage key for developer plan override.
 * When set by a developer user, getEntitlements() returns entitlements
 * for the overridden plan instead of the actual one.
 */
const DEV_PLAN_OVERRIDE_KEY = 'cs:devPlanOverride'

export function getDevPlanOverride(): Plan | null {
  try {
    const v = localStorage.getItem(DEV_PLAN_OVERRIDE_KEY)
    if (v && v in ENTITLEMENTS) return v as Plan
  } catch {
    // ignore
  }
  return null
}

export function setDevPlanOverride(plan: Plan | null): void {
  try {
    if (plan) {
      localStorage.setItem(DEV_PLAN_OVERRIDE_KEY, plan)
    } else {
      localStorage.removeItem(DEV_PLAN_OVERRIDE_KEY)
    }
  } catch {
    // ignore
  }
}

export function getEntitlements(plan: Plan): Entitlements {
  // V3-3.2: Developer plan override — only effective when actual plan is 'developer'
  if (plan === 'developer') {
    const override = getDevPlanOverride()
    if (override) return ENTITLEMENTS[override]
  }
  return ENTITLEMENTS[plan]
}

/**
 * Known developer emails — client-side fallback when the DB trigger
 * (fn_auto_developer_flag trigger in 0001_baseline.sql) hasn't been applied.
 * These emails always resolve to the 'developer' plan.
 */
const DEVELOPER_EMAILS: ReadonlySet<string> = new Set(['ben.godfrey@chainsolve.co.uk'])

/**
 * E2-6 / H8-1: Resolve the effective plan for a profile, accounting for
 * developer/admin overrides and student verification.
 * Developer and admin accounts are treated as enterprise (all features unlocked).
 * Verified students are treated as student plan (same entitlements as pro).
 */
export function resolveEffectivePlan(
  profile: {
    plan: Plan
    email?: string | null
    is_developer?: boolean
    is_admin?: boolean
    is_student?: boolean
  } | null,
): Plan {
  if (!profile) return 'free'
  if (profile.is_developer) return 'developer'
  // Client-side fallback: treat known dev emails as developer even if DB flag is missing
  if (profile.email && DEVELOPER_EMAILS.has(profile.email.toLowerCase())) return 'developer'
  if (profile.is_admin) return 'enterprise'
  if (profile.is_student && profile.plan === 'free') return 'student'
  return profile.plan
}

// ── J3-1: Role helpers ────────────────────────────────────────────────────────

interface ProfileLike {
  plan: Plan
  email?: string | null
  is_developer?: boolean
  is_admin?: boolean
  is_student?: boolean
}

/** True if the profile should be treated as developer (DB flag or email fallback). */
function isEffectiveDeveloper(profile: ProfileLike): boolean {
  if (profile.is_developer) return true
  if (profile.email && DEVELOPER_EMAILS.has(profile.email.toLowerCase())) return true
  return false
}

/**
 * J3-1: Resolve the user's formal role from their profile flags.
 * Role is distinct from Plan — it represents the user's authority level.
 */
export function resolveRole(profile: ProfileLike | null): Role {
  if (!profile) return 'free'
  if (isEffectiveDeveloper(profile)) return 'developer'
  if (profile.is_admin && profile.plan === 'enterprise') return 'enterprise_admin'
  if (profile.is_admin) return 'admin'
  if (profile.plan === 'enterprise') return 'enterprise'
  if (profile.plan === 'trialing' || profile.plan === 'pro') return 'pro'
  if (profile.is_student && profile.plan === 'free') return 'student'
  if (profile.plan === 'past_due') return 'past_due'
  if (profile.plan === 'canceled') return 'canceled'
  return 'free'
}

/** J3-1: True if the user has the developer flag or known dev email. */
export function isDeveloper(profile: ProfileLike | null): boolean {
  if (!profile) return false
  return isEffectiveDeveloper(profile)
}

/** J3-1: True if the user has the admin flag (moderation tools). */
export function isAdmin(profile: ProfileLike | null): boolean {
  return !!profile?.is_admin || !!profile?.is_developer
}

/** J3-1: True if the user is an enterprise admin (admin + enterprise plan). */
export function isEnterpriseAdmin(profile: ProfileLike | null): boolean {
  return !!profile?.is_admin && profile?.plan === 'enterprise'
}

/** True for trialing, pro, student, or enterprise (full access). */
export function isPro(plan: Plan): boolean {
  return (
    plan === 'trialing' ||
    plan === 'pro' ||
    plan === 'student' ||
    plan === 'enterprise' ||
    plan === 'developer'
  )
}

/** Past-due and canceled users get read-only access to existing projects. */
export function isReadOnly(plan: Plan): boolean {
  return plan === 'past_due' || plan === 'canceled'
}

/**
 * Whether the user can install an Explore item of the given category.
 *
 * V2-025 rules:
 * - past_due / canceled: never
 * - Pro / trialing / enterprise: always
 * - Free: cannot install from Explore (can browse only).
 *   Free users use built-in standard templates instead.
 */
export function canInstallExploreItem(plan: Plan, category: string, projectCount: number): boolean {
  void category
  void projectCount
  if (plan === 'past_due' || plan === 'canceled') return false
  return isPro(plan)
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

/**
 * Whether a free user at their project limit can still use scratch canvas.
 * Returns true when the user has hit their project limit but can still
 * work in an unsaved scratch canvas.
 */
export function isAtProjectLimit(plan: Plan, currentCount: number): boolean {
  if (isPro(plan)) return false
  return currentCount >= getEntitlements(plan).maxProjects
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
