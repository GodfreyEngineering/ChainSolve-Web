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
