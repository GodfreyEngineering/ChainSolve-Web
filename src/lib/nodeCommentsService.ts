/**
 * nodeCommentsService — CRUD for node_comments table.
 *
 * Each comment belongs to a specific (canvas_id, node_id) pair.
 * RLS enforces owner-only access — only the comment author can see
 * their own comments (future: org-scoped when collaboration lands).
 */

import { supabase } from './supabase'

export type NodeComment = {
  id: string
  project_id: string
  canvas_id: string
  node_id: string
  owner_id: string
  content: string
  is_resolved: boolean
  created_at: string
  updated_at: string
}

/** Load all comments for a canvas. */
export async function listNodeComments(canvasId: string): Promise<NodeComment[]> {
  const { data, error } = await supabase
    .from('node_comments')
    .select('*')
    .eq('canvas_id', canvasId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as NodeComment[]
}

/** Add a new comment to a node. */
export async function addNodeComment(
  projectId: string,
  canvasId: string,
  nodeId: string,
  content: string,
): Promise<NodeComment> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data, error } = await supabase
    .from('node_comments')
    .insert({
      project_id: projectId,
      canvas_id: canvasId,
      node_id: nodeId,
      owner_id: user.id,
      content: content.trim(),
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as NodeComment
}

/** Toggle the resolved state of a comment. */
export async function resolveNodeComment(commentId: string, resolved: boolean): Promise<void> {
  const { error } = await supabase
    .from('node_comments')
    .update({ is_resolved: resolved })
    .eq('id', commentId)

  if (error) throw new Error(error.message)
}

/** Delete a comment. */
export async function deleteNodeComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('node_comments').delete().eq('id', commentId)

  if (error) throw new Error(error.message)
}

/** Edit the content of a comment. */
export async function editNodeComment(commentId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('node_comments')
    .update({ content: content.trim() })
    .eq('id', commentId)

  if (error) throw new Error(error.message)
}
