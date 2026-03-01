/**
 * profilesService.ts — Supabase profiles table queries.
 *
 * Canonical location for the Profile type and all profiles DB access.
 */

import { supabase } from './supabase'
import type { Plan } from './entitlements'
import { redactString } from '../observability/redact'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  plan: Plan
  stripe_customer_id: string | null
  current_period_end: string | null
  created_at?: string
  /** E2-6: All features unlocked + admin tools + diagnostics. Set by service_role only. */
  is_developer: boolean
  /** E2-6: Moderation tools + admin panels. Set by service_role only. */
  is_admin: boolean
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id,email,full_name,avatar_url,plan,stripe_customer_id,current_period_end,is_developer,is_admin',
    )
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

// ── D12-2: Avatar moderation ──────────────────────────────────────────────────

export interface AvatarReport {
  id: string
  reporter_id: string
  target_id: string
  reason: string
  status: 'pending' | 'resolved' | 'dismissed'
  created_at: string
}

/** Report another user's avatar. One pending report per reporter/target pair. */
export async function reportAvatar(targetUserId: string, reason: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to report an avatar')
  if (user.id === targetUserId) throw new Error('Cannot report your own avatar')

  const trimmed = reason.trim()
  if (!trimmed) throw new Error('A reason is required')
  if (trimmed.length > 500) throw new Error('Reason must be 500 characters or fewer')

  const { error } = await supabase.from('avatar_reports').insert({
    reporter_id: user.id,
    target_id: targetUserId,
    reason: redactString(trimmed),
  })
  if (error) {
    if (error.code === '23505') throw new Error('You have already reported this avatar')
    throw error
  }
}

/** Moderator: list pending avatar reports. */
export async function listPendingAvatarReports(): Promise<AvatarReport[]> {
  const { data, error } = await supabase
    .from('avatar_reports')
    .select('id,reporter_id,target_id,reason,status,created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as AvatarReport[]
}

/** Moderator: resolve a report (removes the offending avatar). */
export async function resolveAvatarReport(reportId: string, targetUserId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in required')

  // Remove the offending avatar
  const { error: clearErr } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', targetUserId)
  if (clearErr) throw clearErr

  // Mark report resolved
  const { error: resolveErr } = await supabase
    .from('avatar_reports')
    .update({ status: 'resolved', resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq('id', reportId)
  if (resolveErr) throw resolveErr
}

/** Moderator: dismiss a report (avatar is fine). */
export async function dismissAvatarReport(reportId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in required')

  const { error } = await supabase
    .from('avatar_reports')
    .update({ status: 'dismissed', resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq('id', reportId)
  if (error) throw error
}
