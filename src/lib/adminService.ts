/**
 * adminService.ts — E3-1: Admin "Danger Zone" operations.
 *
 * Provides destructive admin operations gated by is_developer / is_admin.
 * All operations run under the current user's session (no service_role key).
 * RLS ensures data access is scoped correctly.
 */

import { supabase } from './supabase'
import { deleteProject, listProjects } from './projects'

/**
 * Delete ALL projects owned by the current user.
 * Iterates through all projects and deletes each one (storage + DB).
 * Returns the count of deleted projects.
 */
export async function deleteAllUserProjects(): Promise<number> {
  const projects = await listProjects()
  let deleted = 0
  for (const project of projects) {
    await deleteProject(project.id)
    deleted++
  }
  return deleted
}

/**
 * Delete a single project by ID. Thin wrapper around deleteProject
 * that returns a boolean for UI convenience.
 */
export async function adminDeleteProject(projectId: string): Promise<void> {
  await deleteProject(projectId)
}

/** All localStorage keys used by ChainSolve. */
const CS_LOCAL_KEYS = [
  'cs:prefs',
  'cs:lang',
  'cs:onboarded',
  'cs:onboarding-checklist',
  'cs:favs',
  'cs:recent',
  'cs:window-geometry',
  'cs_obs_session_v1',
  'cs_diag',
] as const

/**
 * Reset all local caches (preferences, MRU, favourites, window geometry, etc.).
 * Returns the number of keys cleared.
 */
export function resetLocalCaches(): number {
  let cleared = 0
  for (const key of CS_LOCAL_KEYS) {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key)
      cleared++
    }
  }

  // Also clear debug console scopes (cs:debug.* keys)
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith('cs:debug.')) toRemove.push(k)
  }
  for (const k of toRemove) {
    localStorage.removeItem(k)
    cleared++
  }

  return cleared
}

/**
 * Validate that the current user has admin/developer privileges.
 * Throws if not authorized.
 */
export async function requireAdminRole(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('profiles')
    .select('is_developer,is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data) throw new Error('Could not verify admin role')
  if (!data.is_developer && !data.is_admin) throw new Error('Admin role required')
}

// ── 7.08: Admin user management ──────────────────────────────────────────────

interface AdminUserSummary {
  id: string
  display_name: string | null
  email: string | null
  plan: string
  is_admin: boolean
  is_developer: boolean
  is_student: boolean
  created_at: string
}

interface AdminUserDetail {
  profile: Record<string, unknown>
  email: string | null
  email_confirmed: boolean
  last_sign_in: string | null
  projects: Array<{
    id: string
    name: string
    created_at: string
    updated_at: string
    is_public: boolean
  }>
}

async function adminApiCall(body: Record<string, unknown>): Promise<{
  ok: boolean
  error?: string
  [key: string]: unknown
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Not signed in' }

  const resp = await fetch('/api/admin/manage-user', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return (await resp.json()) as { ok: boolean; error?: string; [key: string]: unknown }
}

export async function adminSearchUsers(query: string): Promise<AdminUserSummary[]> {
  const result = await adminApiCall({ action: 'search', query })
  if (!result.ok) throw new Error(result.error ?? 'Search failed')
  return result.users as AdminUserSummary[]
}

export async function adminGetUser(userId: string): Promise<AdminUserDetail> {
  const result = await adminApiCall({ action: 'get_user', user_id: userId })
  if (!result.ok) throw new Error(result.error ?? 'Get user failed')
  return result as unknown as AdminUserDetail
}

export async function adminOverridePlan(userId: string, plan: string): Promise<void> {
  const result = await adminApiCall({ action: 'override_plan', user_id: userId, plan })
  if (!result.ok) throw new Error(result.error ?? 'Override failed')
}

export async function adminResetPassword(userId: string): Promise<void> {
  const result = await adminApiCall({ action: 'reset_password', user_id: userId })
  if (!result.ok) throw new Error(result.error ?? 'Reset failed')
}

export async function adminToggleDisabled(userId: string, disabled: boolean): Promise<void> {
  const result = await adminApiCall({ action: 'toggle_disabled', user_id: userId, disabled })
  if (!result.ok) throw new Error(result.error ?? 'Toggle failed')
}
