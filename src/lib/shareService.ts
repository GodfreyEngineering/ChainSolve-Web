/**
 * shareService — CRUD for share_links table.
 *
 * Share links allow read-only access to a project by anyone with the token
 * (including unauthenticated users). The server-side CF Function validates
 * the token and serves the project data.
 */

import { supabase } from './supabase'

export type ShareLink = {
  id: string
  project_id: string
  token: string
  created_by: string
  created_at: string
  expires_at: string | null
  view_count: number
  is_active: boolean
}

/** Create a share link for a project. Expires in 30 days by default. */
export async function createShareLink(projectId: string, expiresInDays = 30): Promise<ShareLink> {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + expiresInDays)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data, error } = await supabase
    .from('share_links')
    .insert({
      project_id: projectId,
      created_by: user.id,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as ShareLink
}

/** List all share links for a project. */
export async function listShareLinks(projectId: string): Promise<ShareLink[]> {
  const { data, error } = await supabase
    .from('share_links')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as ShareLink[]
}

/** Deactivate a share link (soft-delete). */
export async function revokeShareLink(linkId: string): Promise<void> {
  const { error } = await supabase.from('share_links').update({ is_active: false }).eq('id', linkId)

  if (error) throw new Error(error.message)
}

/** Build the public share URL for a given token. */
export function buildShareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`
}
