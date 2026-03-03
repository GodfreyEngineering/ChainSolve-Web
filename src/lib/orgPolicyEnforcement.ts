/**
 * orgPolicyEnforcement.ts — Enterprise org-policy overrides (I8-1).
 *
 * Org policies can only RESTRICT, never GRANT.  A free user in an org
 * with policy_ai_enabled=true still cannot use AI — their plan must
 * also allow it.
 */

import type { Entitlements } from './entitlements'
import type { OrgPolicy } from './orgsService'

/** AND-gate: restrict plan entitlements by org policy. Null policy = no-op. */
export function applyOrgPolicyOverrides(
  entitlements: Entitlements,
  orgPolicy: OrgPolicy | null,
): Entitlements {
  if (!orgPolicy) return entitlements

  return {
    ...entitlements,
    canUseAi: entitlements.canUseAi && orgPolicy.policy_ai_enabled,
    canExport: entitlements.canExport && orgPolicy.policy_export_enabled,
    canCreateCustomFunctions:
      entitlements.canCreateCustomFunctions && orgPolicy.policy_custom_fns_enabled,
  }
}

/**
 * Returns a human-readable list of features that are blocked by the
 * org policy.  Empty array if nothing is blocked.
 */
export function getBlockedFeatures(orgPolicy: OrgPolicy | null): string[] {
  if (!orgPolicy) return []
  const blocked: string[] = []
  if (!orgPolicy.policy_ai_enabled) blocked.push('ai')
  if (!orgPolicy.policy_export_enabled) blocked.push('export')
  if (!orgPolicy.policy_custom_fns_enabled) blocked.push('customFunctions')
  if (!orgPolicy.policy_explore_enabled) blocked.push('explore')
  if (!orgPolicy.policy_installs_allowed) blocked.push('installs')
  if (!orgPolicy.policy_comments_allowed) blocked.push('comments')
  return blocked
}
