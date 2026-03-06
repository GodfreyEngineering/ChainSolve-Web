/**
 * planStyles.ts — Canonical plan colors and display-name styling helpers (J3-2).
 *
 * Separated from PlanBadge.tsx to satisfy react-refresh/only-export-components
 * (fast-refresh requires component-only files to export only components).
 */

import type { Plan } from './entitlements'

// ── Canonical plan colors (single source of truth) ───────────────────────────

export const PLAN_COLORS: Record<Plan, string> = {
  free: '#6b7280',
  trialing: '#3b82f6',
  pro: '#d4a017',
  student: '#0ea5e9',
  enterprise: '#8b5cf6',
  developer: '#10b981',
  past_due: '#f59e0b',
  canceled: '#ef4444',
}

// ── Display name style helper ────────────────────────────────────────────────

/**
 * Returns CSS properties for display name text based on plan tier.
 *   - Pro: bold weight
 *   - Enterprise: bold + slightly elevated letter spacing
 *   - All others: normal weight
 */
export function displayNameStyle(plan: Plan): React.CSSProperties {
  if (plan === 'pro') {
    return { fontWeight: 700 }
  }
  if (plan === 'enterprise' || plan === 'developer') {
    return { fontWeight: 700, letterSpacing: '0.02em' }
  }
  return { fontWeight: 400 }
}
