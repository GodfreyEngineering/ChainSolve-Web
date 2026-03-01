/**
 * commentModerationService.ts — E10-1: Moderation operations for marketplace comments.
 *
 * Provides moderator-only functions for viewing, unflagging, and deleting
 * flagged comments. All operations rely on RLS policies that require
 * is_moderator = true on the caller's profile.
 */

import { supabase } from './supabase'

export interface FlaggedComment {
  id: string
  item_id: string
  user_id: string
  content: string
  flag_reason: string | null
  created_at: string
}

/**
 * Moderator: list all flagged comments, newest first.
 * Returns at most `limit` rows (default 50).
 */
export async function listFlaggedComments(limit = 50): Promise<FlaggedComment[]> {
  const { data, error } = await supabase
    .from('marketplace_comments')
    .select('id,item_id,user_id,content,flag_reason,created_at')
    .eq('is_flagged', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as FlaggedComment[]
}

/**
 * Moderator: unflag a comment (restore to visible).
 * Clears is_flagged and flag_reason.
 */
export async function unflagComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from('marketplace_comments')
    .update({ is_flagged: false, flag_reason: null })
    .eq('id', commentId)

  if (error) throw error
}

/**
 * Moderator: delete a flagged comment permanently.
 * RLS enforces moderator role.
 */
export async function deleteFlaggedComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('marketplace_comments').delete().eq('id', commentId)

  if (error) throw error
}
