/**
 * profilesService.ts — Supabase profiles table queries.
 *
 * Canonical location for the Profile type and all profiles DB access.
 */

import { supabase } from './supabase'
import type { Plan } from './entitlements'
import { redactString } from '../observability/redact'
import { ServiceError } from './errors'
import { validateProjectName } from './validateProjectName'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  /** Unique handle/username: ^[a-zA-Z0-9_-]{3,50}$ (DB-04) */
  display_name: string | null
  avatar_url: string | null
  plan: Plan
  stripe_customer_id: string | null
  current_period_end: string | null
  created_at?: string
  /** E2-6: All features unlocked + admin tools + diagnostics. Set by service_role only. */
  is_developer: boolean
  /** E2-6: Moderation tools + admin panels. Set by service_role only. */
  is_admin: boolean
  /** H8-1: Verified student — unlocks student plan (same as Pro). Set by service_role only. */
  is_student: boolean
  /** E2-3: Semantic version of ToS the user has accepted (e.g. '1.0'). */
  accepted_terms_version: string | null
  /** E2-3: When the user accepted the current ToS. */
  accepted_terms_at: string | null
  /** E2-3: Whether the user opted in to marketing emails. */
  marketing_opt_in: boolean
  /** E2-3: When marketing opt-in was last changed. */
  marketing_opt_in_at: string | null
  /** Phase 2: When the signup wizard was completed. Null = incomplete. */
  onboarding_completed_at: string | null
}

// ── Profile cache (1-minute TTL) ──────────────────────────────────────────────

let _profileCache: { profile: Profile; fetchedAt: number; userId: string } | null = null
const PROFILE_CACHE_TTL_MS = 60_000

/** Invalidate the cached profile (call on sign-out or after mutations). */
export function invalidateProfileCache(): void {
  _profileCache = null
}

/** Safety-net: create the caller's profile row if the signup trigger failed. */
export async function ensureProfile(): Promise<void> {
  const { error } = await supabase.rpc('ensure_profile')
  if (error) {
    console.error('[profilesService] ensureProfile failed', {
      code: error.code,
      message: error.message,
      details: error.details,
    })
    throw new ServiceError('DB_ERROR', error.message, true)
  }
  invalidateProfileCache()
}

/**
 * Get the caller's profile via SECURITY DEFINER RPC (bypasses RLS).
 * Also creates the profile row if it doesn't exist.
 * @deprecated Use getOrCreateProfile() instead (migration 0008).
 */
export async function getMyProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.rpc('get_my_profile')
  if (error) throw new ServiceError('DB_ERROR', error.message, true)
  if (data && typeof data === 'object') {
    const profile = data as Profile
    _profileCache = { profile, fetchedAt: Date.now(), userId: profile.id }
    return profile
  }
  return null
}

// ── V6 RPC-based functions (bypass RLS, migration 0008) ─────────────────────

/**
 * Get or create the caller's profile via SECURITY DEFINER RPC.
 * This is the primary profile fetch for the auth flow — bypasses RLS entirely.
 */
export async function getOrCreateProfile(): Promise<Profile> {
  const { data, error } = await supabase.rpc('get_or_create_profile')
  if (error) {
    console.error('[profilesService] getOrCreateProfile failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    throw new ServiceError('DB_ERROR', error.message, true)
  }
  if (!data || typeof data !== 'object') {
    console.error('[profilesService] getOrCreateProfile returned empty result', { data })
    throw new ServiceError('DB_ERROR', 'get_or_create_profile returned empty result')
  }
  const profile = data as Profile
  _profileCache = { profile, fetchedAt: Date.now(), userId: profile.id }
  return profile
}

/** Accept ToS via RPC (bypasses RLS UPDATE policy). */
export async function acceptTermsViaRpc(version: string): Promise<void> {
  const { error } = await supabase.rpc('accept_my_terms', { p_version: version })
  if (error) {
    console.error('[profilesService] acceptTermsViaRpc failed', {
      version,
      code: error.code,
      message: error.message,
      details: error.details,
    })
    throw new ServiceError('DB_ERROR', error.message, true)
  }
  invalidateProfileCache()
}

/** Mark onboarding complete via RPC (bypasses RLS UPDATE policy). */
export async function markOnboardingCompleteViaRpc(): Promise<void> {
  const { error } = await supabase.rpc('complete_my_onboarding')
  if (error) {
    console.error('[profilesService] markOnboardingCompleteViaRpc failed', {
      code: error.code,
      message: error.message,
      details: error.details,
    })
    throw new ServiceError('DB_ERROR', error.message, true)
  }
  invalidateProfileCache()
}

/**
 * Update full name, avatar URL, and/or display name via RPC (bypasses RLS UPDATE policy).
 * All parameters are optional — pass null to leave the field unchanged.
 *
 * Calls the 3-param update_my_profile(text, text, text) defined in migration 0009.
 * The 2-param overload from migration 0008 was removed in migration 0010 to
 * eliminate the PostgreSQL function-overload ambiguity that caused signup errors.
 */
export async function updateProfileViaRpc(
  fullName: string | null,
  avatarUrl: string | null,
  displayName?: string | null,
): Promise<void> {
  const params: Record<string, unknown> = {
    p_full_name: fullName,
    p_avatar_url: avatarUrl,
    p_display_name: displayName ?? null,
  }
  const { error } = await supabase.rpc('update_my_profile', params)
  if (error) {
    console.error('[profilesService] updateProfileViaRpc failed', {
      params: { fullName: fullName ? '[redacted]' : null, avatarUrl, displayName },
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    throw new ServiceError('DB_ERROR', error.message, true)
  }
  invalidateProfileCache()
}

/** Update marketing opt-in via RPC (bypasses RLS UPDATE policy). */
export async function updateMarketingOptInViaRpc(optIn: boolean): Promise<void> {
  const { error } = await supabase.rpc('update_my_marketing', { p_opt_in: optIn })
  if (error) {
    console.error('[profilesService] updateMarketingOptInViaRpc failed', {
      optIn,
      code: error.code,
      message: error.message,
      details: error.details,
    })
    throw new ServiceError('DB_ERROR', error.message, true)
  }
  invalidateProfileCache()
}

/** Upload avatar file to storage only (no profile table update). Returns storage path. */
export async function uploadAvatarFileOnly(file: File): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new ServiceError('NOT_AUTHENTICATED', 'Sign in to upload an avatar')

  if (!file.type.startsWith('image/'))
    throw new ServiceError('FILE_TOO_LARGE', 'Only image files are allowed for avatars')
  if (file.size > MAX_AVATAR_BYTES)
    throw new ServiceError(
      'FILE_TOO_LARGE',
      `Avatar must be under ${MAX_AVATAR_BYTES / 1024 / 1024} MB`,
    )

  const ext = file.name.split('.').pop() ?? 'jpg'
  const storagePath = `${user.id}/avatar_${Date.now()}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('uploads')
    .upload(storagePath, file, { upsert: true, contentType: file.type })
  if (uploadErr) throw new ServiceError('STORAGE_ERROR', uploadErr.message, true)

  return storagePath
}

export async function getProfile(userId: string): Promise<Profile | null> {
  if (
    _profileCache &&
    _profileCache.userId === userId &&
    Date.now() - _profileCache.fetchedAt < PROFILE_CACHE_TTL_MS
  ) {
    return _profileCache.profile
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id,email,full_name,avatar_url,plan,stripe_customer_id,current_period_end,is_developer,is_admin,is_student,accepted_terms_version,accepted_terms_at,marketing_opt_in,marketing_opt_in_at,onboarding_completed_at',
    )
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null

  const profile = data as Profile
  _profileCache = { profile, fetchedAt: Date.now(), userId }
  return profile
}

/** E2-3: Record that the user has accepted the given ToS version. */
export async function acceptTerms(version: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new ServiceError('NOT_AUTHENTICATED', 'Sign in to accept terms')

  const { data, error } = await supabase
    .from('profiles')
    .update({
      accepted_terms_version: version,
      accepted_terms_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .select('accepted_terms_version')
    .maybeSingle()
  if (error) throw new ServiceError('DB_ERROR', error.message, true)
  if (!data)
    throw new ServiceError('DB_ERROR', 'Profile not found. Please sign out and sign back in.')
  if (data.accepted_terms_version !== version)
    throw new ServiceError('DB_ERROR', 'Acceptance was not recorded. Please retry.', true)

  // 16.80: Append to GDPR consent audit log (best-effort — do not block acceptance on failure)
  await supabase
    .from('user_consents')
    .insert({
      user_id: user.id,
      consent_type: 'tos_accepted',
      granted: true,
      document_version: version,
    })
    .then(({ error: e }) => {
      if (e) console.warn('[profilesService] consent audit insert failed:', e.message)
    })

  invalidateProfileCache()
}

/** E2-3: Update the user's marketing opt-in preference. */
export async function updateMarketingOptIn(optIn: boolean): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new ServiceError('NOT_AUTHENTICATED', 'Sign in to update preferences')

  const { error } = await supabase
    .from('profiles')
    .update({
      marketing_opt_in: optIn,
      marketing_opt_in_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (error) throw new ServiceError('DB_ERROR', error.message, true)

  // 16.80: Append to GDPR consent audit log
  await supabase
    .from('user_consents')
    .insert({ user_id: user.id, consent_type: 'marketing_email', granted: optIn })
    .then(({ error: e }) => {
      if (e)
        console.warn('[profilesService] consent audit (marketing_email) insert failed:', e.message)
    })

  invalidateProfileCache()
}

/** Phase 2: Mark the signup wizard as completed. */
export async function markOnboardingComplete(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new ServiceError('NOT_AUTHENTICATED', 'Sign in to complete onboarding')

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) throw new ServiceError('DB_ERROR', error.message, true)
  invalidateProfileCache()
}

/** D12-1: Update the current user's profile display name. */
export async function updateDisplayName(name: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new ServiceError('NOT_AUTHENTICATED', 'Sign in to update your profile')

  const trimmed = name.trim()
  if (trimmed) {
    const validation = validateProjectName(trimmed)
    if (!validation.ok) throw new ServiceError('INVALID_PROJECT_NAME', validation.error!)
  }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: trimmed || null })
    .eq('id', user.id)
  if (error) throw new ServiceError('DB_ERROR', error.message, true)
  invalidateProfileCache()
}

// ── ACCT-06: Display name (unique handle, DB-04) ──────────────────────────────

const DISPLAY_NAME_PATTERN = /^[a-zA-Z0-9_-]{3,50}$/

/** Validate display name format client-side (matches DB-04 CHECK constraint). */
export function validateDisplayNameFormat(name: string): string | null {
  if (!name) return null // empty = clear (allowed)
  if (!DISPLAY_NAME_PATTERN.test(name)) {
    return 'Must be 3–50 characters: letters, numbers, _ or -'
  }
  return null
}

/**
 * Check whether a display name is available via the check_display_name_available RPC.
 * Returns true if available, false if taken, null if the RPC call failed.
 */
export async function checkDisplayNameAvailable(name: string): Promise<boolean | null> {
  if (!DISPLAY_NAME_PATTERN.test(name)) return null
  try {
    const { data, error } = await supabase.rpc('check_display_name_available', {
      p_name: name,
    })
    if (error) return null
    return data === true
  } catch {
    return null
  }
}

/**
 * Save a unique display name to the caller's profile.
 * Throws with message "already taken" if the unique constraint fires.
 */
export async function saveDisplayName(name: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new ServiceError('NOT_AUTHENTICATED', 'Sign in to update your profile')

  const trimmed = name.trim()
  if (trimmed) {
    const formatError = validateDisplayNameFormat(trimmed)
    if (formatError) throw new ServiceError('INVALID_PROJECT_NAME', formatError)
  }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: trimmed || null })
    .eq('id', user.id)

  if (error) {
    // Unique constraint violation → friendly message
    if (error.code === '23505') {
      throw new ServiceError('DB_ERROR', 'That display name is already taken')
    }
    // Check constraint violation (pattern mismatch)
    if (error.code === '23514') {
      throw new ServiceError('DB_ERROR', 'Must be 3–50 characters: letters, numbers, _ or -')
    }
    throw new ServiceError('DB_ERROR', error.message, true)
  }
  invalidateProfileCache()
}

/** D12-1 / ACCT-05: Upload a profile avatar image. Max 2 MB, JPEG/PNG/WebP only. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * Upload a pre-processed avatar File (should be 256×256 JPEG from resizeAndCropToSquare).
 * Validates MIME type and file size, uploads to storage, updates profile.avatar_url.
 */
export async function uploadAvatar(file: File): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new ServiceError('NOT_AUTHENTICATED', 'Sign in to upload an avatar')

  if (!ALLOWED_AVATAR_TYPES.has(file.type))
    throw new ServiceError('INVALID_FILE', 'Avatar must be a JPEG, PNG, or WebP image.')
  if (file.size > MAX_AVATAR_BYTES)
    throw new ServiceError(
      'FILE_TOO_LARGE',
      `Avatar must be under ${MAX_AVATAR_BYTES / 1024 / 1024} MB`,
    )

  // Always store as JPEG after resize (file.name already ends in .jpg from resizeAndCropToSquare)
  const storagePath = `${user.id}/avatar.jpg`

  const { error: uploadErr } = await supabase.storage
    .from('uploads')
    .upload(storagePath, file, { upsert: true, contentType: 'image/jpeg' })
  if (uploadErr) throw new ServiceError('STORAGE_ERROR', uploadErr.message, true)

  // Save path (not signed URL) to profile — signed URL is generated on read
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ avatar_url: storagePath })
    .eq('id', user.id)
  if (updateErr) throw new ServiceError('DB_ERROR', updateErr.message, true)
  invalidateProfileCache()

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
  if (!user) throw new ServiceError('NOT_AUTHENTICATED', 'Sign in to report an avatar')
  if (user.id === targetUserId)
    throw new ServiceError('INVALID_PROJECT_NAME', 'Cannot report your own avatar')

  const trimmed = reason.trim()
  if (!trimmed) throw new ServiceError('INVALID_PROJECT_NAME', 'A reason is required')
  if (trimmed.length > 500)
    throw new ServiceError('INVALID_PROJECT_NAME', 'Reason must be 500 characters or fewer')

  const { error } = await supabase.from('avatar_reports').insert({
    reporter_id: user.id,
    target_id: targetUserId,
    reason: redactString(trimmed),
  })
  if (error) {
    if (error.code === '23505')
      throw new ServiceError('DB_ERROR', 'You have already reported this avatar')
    throw new ServiceError('DB_ERROR', error.message, true)
  }
}

/** Moderator: list pending avatar reports. */
export async function listPendingAvatarReports(): Promise<AvatarReport[]> {
  const { data, error } = await supabase
    .from('avatar_reports')
    .select('id,reporter_id,target_id,reason,status,created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw new ServiceError('DB_ERROR', error.message, true)
  return (data ?? []) as AvatarReport[]
}

/** Moderator: resolve a report (removes the offending avatar). */
export async function resolveAvatarReport(reportId: string, targetUserId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new ServiceError('NOT_AUTHENTICATED', 'Sign in required')

  // Remove the offending avatar
  const { error: clearErr } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', targetUserId)
  if (clearErr) throw new ServiceError('DB_ERROR', clearErr.message, true)

  // Mark report resolved
  const { error: resolveErr } = await supabase
    .from('avatar_reports')
    .update({ status: 'resolved', resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq('id', reportId)
  if (resolveErr) throw new ServiceError('DB_ERROR', resolveErr.message, true)
}

/** Moderator: dismiss a report (avatar is fine). */
export async function dismissAvatarReport(reportId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new ServiceError('NOT_AUTHENTICATED', 'Sign in required')

  const { error } = await supabase
    .from('avatar_reports')
    .update({ status: 'dismissed', resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq('id', reportId)
  if (error) throw new ServiceError('DB_ERROR', error.message, true)
}
