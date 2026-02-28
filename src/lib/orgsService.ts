/**
 * orgsService.ts — Organizations service layer (P124).
 *
 * All Supabase queries for organizations and org_members live here.
 * UI components MUST NOT import supabase directly.
 */

import { supabase } from './supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

export type OrgRole = 'owner' | 'admin' | 'member'

export interface Org {
  id: string
  name: string
  owner_id: string
  /** D10-2: enterprise policy flags */
  policy_explore_enabled: boolean
  policy_installs_allowed: boolean
  policy_comments_allowed: boolean
  created_at: string
  updated_at: string
}

/** D10-2: subset of Org fields for policy checks. */
export interface OrgPolicy {
  policy_explore_enabled: boolean
  policy_installs_allowed: boolean
  policy_comments_allowed: boolean
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: OrgRole
  invited_by: string | null
  created_at: string
}

// ── Organization CRUD ─────────────────────────────────────────────────────────

/**
 * Create a new organization owned by the current user.
 * Also inserts an 'owner' row into org_members for the creator.
 */
export async function createOrg(name: string): Promise<Org> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to create an organization')

  const trimmed = name.trim()
  if (!trimmed) throw new Error('Organization name is required')
  if (trimmed.length > 80) throw new Error('Organization name must be 80 characters or fewer')

  const { data, error } = await supabase
    .from('organizations')
    .insert({ name: trimmed, owner_id: user.id })
    .select('*')
    .single()

  if (error) throw error

  const org = data as Org

  // Insert the creator as 'owner' member (best-effort — RLS allows this).
  await supabase.from('org_members').insert({
    org_id: org.id,
    user_id: user.id,
    role: 'owner' as OrgRole,
  })

  return org
}

/**
 * List all organizations the current user belongs to (any role).
 * Returns [] if unauthenticated.
 */
export async function listMyOrgs(): Promise<Org[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  // Fetch org IDs via membership table, then get org details.
  const { data: memberships, error: mErr } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)

  if (mErr) throw mErr
  if (!memberships || memberships.length === 0) return []

  const orgIds = (memberships as { org_id: string }[]).map((m) => m.org_id)

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .in('id', orgIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Org[]
}

/**
 * List all members of an organization.
 * Caller must be a member of the org (enforced by RLS).
 */
export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from('org_members')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as OrgMember[]
}

/**
 * Invite a user (by their user ID) to an organization.
 * Caller must be an owner or admin (enforced by RLS).
 */
export async function inviteOrgMember(
  orgId: string,
  userId: string,
  role: OrgRole = 'member',
): Promise<OrgMember> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to invite members')

  const { data, error } = await supabase
    .from('org_members')
    .insert({ org_id: orgId, user_id: userId, role, invited_by: user.id })
    .select('*')
    .single()

  if (error) throw error
  return data as OrgMember
}

/**
 * Update a member's role.
 * Caller must be an owner (or admin updating 'member' rows) — enforced by RLS.
 */
export async function updateMemberRole(memberId: string, role: OrgRole): Promise<void> {
  const { error } = await supabase.from('org_members').update({ role }).eq('id', memberId)

  if (error) throw error
}

/**
 * Remove a member from an org, or leave an org (remove self).
 * Caller must be an owner/admin, or removing themselves — enforced by RLS.
 */
export async function removeOrgMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('org_members').delete().eq('id', memberId)

  if (error) throw error
}

/**
 * Rename an organization.
 * Caller must be the org owner (enforced by RLS).
 */
export async function renameOrg(orgId: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Organization name is required')
  if (trimmed.length > 80) throw new Error('Organization name must be 80 characters or fewer')

  const { error } = await supabase
    .from('organizations')
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq('id', orgId)

  if (error) throw error
}

/**
 * Delete (dissolve) an organization.
 * Caller must be the org owner (enforced by RLS).
 * Cascades to org_members; projects get org_id = NULL.
 */
export async function deleteOrg(orgId: string): Promise<void> {
  const { error } = await supabase.from('organizations').delete().eq('id', orgId)

  if (error) throw error
}

// ── D10-2: Enterprise policy flags ────────────────────────────────────────────

/**
 * Fetch policy flags for an organization.
 * Caller must be a member of the org (enforced by RLS).
 */
export async function getOrgPolicy(orgId: string): Promise<OrgPolicy> {
  const { data, error } = await supabase
    .from('organizations')
    .select('policy_explore_enabled,policy_installs_allowed,policy_comments_allowed')
    .eq('id', orgId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Organization not found')

  return data as OrgPolicy
}

/**
 * Update policy flags for an organization.
 * Caller must be the org owner (enforced by RLS update policy).
 */
export async function updateOrgPolicy(orgId: string, policy: Partial<OrgPolicy>): Promise<void> {
  const { error } = await supabase.from('organizations').update(policy).eq('id', orgId)

  if (error) throw error
}
