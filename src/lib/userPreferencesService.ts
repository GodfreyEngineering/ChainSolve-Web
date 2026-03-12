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

/**
 * Update one or more preference fields for the current user.
 * Uses the upsert_my_preferences RPC (migration 0011) so the preferences row
 * is created if somehow missing (edge case: users created before the
 * handle_new_user trigger was deployed).
 */
export async function updateUserPreferences(
  patch: Partial<
    Pick<UserPreferences, 'locale' | 'theme' | 'region' | 'editor_layout' | 'sidebar_collapsed'>
  >,
): Promise<void> {
  const params: Record<string, unknown> = {}
  if ('locale' in patch) params.p_locale = patch.locale
  if ('theme' in patch) params.p_theme = patch.theme
  if ('region' in patch) params.p_region = patch.region
  if ('editor_layout' in patch) params.p_editor_layout = patch.editor_layout
  if ('sidebar_collapsed' in patch) params.p_sidebar_collapsed = patch.sidebar_collapsed

  const { error } = await supabase.rpc('upsert_my_preferences', params)

  if (error) {
    console.error('[userPreferencesService] updateUserPreferences failed', {
      patch,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    throw error
  }
}
