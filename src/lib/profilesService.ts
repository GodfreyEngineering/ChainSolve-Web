/**
 * profilesService.ts — Supabase profiles table queries.
 *
 * Canonical location for the Profile type and all profiles DB access.
 */

import { supabase } from './supabase'
import type { Plan } from './entitlements'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  plan: Plan
  stripe_customer_id: string | null
  current_period_end: string | null
  created_at?: string
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,avatar_url,plan,stripe_customer_id,current_period_end')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as Profile
}

/** D12-1: Update the current user's profile display name. */
export async function updateDisplayName(name: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to update your profile')

  const trimmed = name.trim()
  if (trimmed.length > 100) throw new Error('Display name must be 100 characters or fewer')

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: trimmed || null })
    .eq('id', user.id)
  if (error) throw error
}

/** D12-1: Upload a profile avatar image. Max 2 MB, image/* only. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export async function uploadAvatar(file: File): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to upload an avatar')

  if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed for avatars')
  if (file.size > MAX_AVATAR_BYTES)
    throw new Error(`Avatar must be under ${MAX_AVATAR_BYTES / 1024 / 1024} MB`)

  const ext = file.name.split('.').pop() ?? 'jpg'
  const storagePath = `${user.id}/avatar_${Date.now()}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('uploads')
    .upload(storagePath, file, { upsert: true, contentType: file.type })
  if (uploadErr) throw uploadErr

  // Save path (not signed URL) to profile — signed URL is generated on read
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ avatar_url: storagePath })
    .eq('id', user.id)
  if (updateErr) throw updateErr

  return storagePath
}

/** D12-1: Get a short-lived signed URL for an avatar storage path. */
export async function getAvatarUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('uploads').createSignedUrl(storagePath, 3600) // 1 hour
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
