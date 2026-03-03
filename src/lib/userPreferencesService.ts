/**
 * userPreferencesService.ts — User preferences CRUD (J0-1).
 *
 * Wraps the user_preferences table. Auto-created on signup via
 * the handle_new_user trigger.
 */

import { supabase } from './supabase'

// ── Types ────────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark' | 'system'
export type EditorLayout = 'default' | 'compact' | 'wide'

export interface UserPreferences {
  user_id: string
  locale: string
  theme: Theme
  region: string | null
  editor_layout: EditorLayout
  sidebar_collapsed: boolean
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** Fetch the current user's preferences. Returns null if not found. */
export async function getUserPreferences(): Promise<UserPreferences | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_preferences')
    .select('user_id,locale,theme,region,editor_layout,sidebar_collapsed')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  return data as UserPreferences | null
}

/** Update one or more preference fields for the current user. */
export async function updateUserPreferences(
  patch: Partial<
    Pick<UserPreferences, 'locale' | 'theme' | 'region' | 'editor_layout' | 'sidebar_collapsed'>
  >,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to update preferences')

  const { error } = await supabase
    .from('user_preferences')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (error) throw error
}
