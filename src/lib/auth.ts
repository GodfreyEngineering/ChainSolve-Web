/**
 * auth.ts — Thin service wrappers around Supabase auth.
 *
 * UI components and pages must ONLY call these functions,
 * never import the supabase client directly.
 */

import { supabase } from './supabase'
import type { AuthError, Session, User } from '@supabase/supabase-js'
import { invalidateProfileCache } from './profilesService'
import { clearCanvasCache } from './canvasCache'
import { registerSession, removeCurrentSession } from './sessionService'

export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

export async function signInWithPassword(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined,
  })
  return { error }
}

export interface SignUpMetadata {
  acceptedTermsVersion?: string
  marketingOptIn?: boolean
}

export async function signUp(
  email: string,
  password: string,
  captchaToken?: string,
  metadata?: SignUpMetadata,
): Promise<{ session: Session | null; error: AuthError | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      ...(captchaToken ? { captchaToken } : {}),
      ...(metadata
        ? {
            data: {
              accepted_terms_version: metadata.acceptedTermsVersion,
              marketing_opt_in: metadata.marketingOptIn ?? false,
            },
          }
        : {}),
    },
  })
  return { session: data.session ?? null, error }
}

export async function resetPasswordForEmail(
  email: string,
  captchaToken?: string,
): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    captchaToken,
  })
  return { error }
}

export async function resendConfirmation(email: string): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.resend({ type: 'signup', email })
  return { error }
}

export async function signOut(): Promise<void> {
  invalidateProfileCache()
  // Clear cached canvas snapshots so a different user doesn't see stale data
  void clearCanvasCache()
  await supabase.auth.signOut()
}

// ── Account deletion (ACCT-01) ───────────────────────────────────────────────

/**
 * Permanently delete the current user's account.
 * Calls POST /api/account/delete which cancels Stripe, purges storage,
 * deletes all DB rows, then removes the auth.users entry.
 *
 * On success: caller should sign out and redirect to the homepage.
 */
export async function deleteMyAccount(): Promise<{ error: string | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { error: 'Not signed in' }

  try {
    const resp = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!resp.ok) {
      const body = (await resp.json().catch(() => ({}))) as { error?: string }
      return { error: body.error ?? `Server error ${resp.status}` }
    }
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' }
  }
}

export async function refreshSession(): Promise<{
  session: Session | null
  error: AuthError | null
}> {
  const { data, error } = await supabase.auth.refreshSession()
  return { session: data.session, error }
}

/**
 * Re-authenticate the current user by verifying their password.
 * Used by billing-sensitive operations (SEC-4, AU-5).
 */
export async function reauthenticate(password: string): Promise<{ error: AuthError | null }> {
  const user = await getCurrentUser()
  if (!user?.email) return { error: null }
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password })
  return { error }
}

// ── Password change (ACCT-04) ─────────────────────────────────────────────

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4 // 0=very weak … 4=very strong
  label: 'very-weak' | 'weak' | 'fair' | 'strong' | 'very-strong'
}

/**
 * Estimate password strength: length + character class diversity.
 * Returns a 0–4 score and a human-readable label.
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 4) return { score: 0, label: 'very-weak' }
  let classes = 0
  if (/[a-z]/.test(password)) classes++
  if (/[A-Z]/.test(password)) classes++
  if (/[0-9]/.test(password)) classes++
  if (/[^a-zA-Z0-9]/.test(password)) classes++
  const score = Math.min(4, Math.floor(password.length / 8 + (classes - 1))) as 0 | 1 | 2 | 3 | 4
  const labels = ['very-weak', 'weak', 'fair', 'strong', 'very-strong'] as const
  return { score, label: labels[score] }
}

/**
 * Change password for the current user.
 * Requires re-authentication via the current password first.
 *
 * Validates: min 8 chars, at least 1 number.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ error: string | null }> {
  if (newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters.' }
  }
  if (!/[0-9]/.test(newPassword)) {
    return { error: 'New password must contain at least one number.' }
  }
  // Re-authenticate with current password
  const { error: reAuthError } = await reauthenticate(currentPassword)
  if (reAuthError) {
    return { error: 'Current password is incorrect.' }
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }

  // Session rotation: invalidate old device session and register a new one.
  // This ensures any compromised session token is no longer valid.
  const user = await getCurrentUser()
  if (user) {
    await removeCurrentSession()
    await registerSession(user.id)
  }

  return { error: null }
}

// ── Email change (ACCT-03) ───────────────────────────────────────────────────

/**
 * Request an email change for the current user.
 * Supabase sends a verification email to the new address.
 * The change is not applied until the user clicks the link.
 */
export async function requestEmailChange(newEmail: string): Promise<{ error: string | null }> {
  if (!newEmail.includes('@')) {
    return { error: 'Please enter a valid email address.' }
  }
  const { error } = await supabase.auth.updateUser({ email: newEmail })
  return { error: error?.message ?? null }
}

// ── MFA / TOTP (E2-4) ──────────────────────────────────────────────────────

export interface MfaFactor {
  id: string
  friendly_name?: string
  factor_type: string
  status: 'verified' | 'unverified'
  created_at: string
  updated_at: string
}

export interface TotpEnrollment {
  /** Factor ID — needed for verify/unenroll. */
  id: string
  /** otpauth:// URI for manual entry. */
  uri: string
  /** Data-URI SVG of the QR code. */
  qrCode: string
  /** Base32 secret for manual entry. */
  secret: string
}

/** Start TOTP enrolment. Returns QR code and secret for the user. */
export async function enrollTotp(): Promise<{
  enrollment: TotpEnrollment | null
  error: AuthError | null
}> {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error || !data) return { enrollment: null, error }
  return {
    enrollment: {
      id: data.id,
      uri: data.totp.uri,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    },
    error: null,
  }
}

/** Verify a TOTP code to complete enrolment or satisfy a login challenge. */
export async function verifyTotp(
  factorId: string,
  code: string,
): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  return { error }
}

/** Remove an enrolled TOTP factor (disable 2FA). */
export async function unenrollTotp(factorId: string): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  return { error }
}

/** List all MFA factors for the current user. */
export async function listMfaFactors(): Promise<{
  factors: MfaFactor[]
  error: AuthError | null
}> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error || !data) return { factors: [], error }
  const factors = (data.totp ?? []).map((f) => ({
    id: f.id,
    friendly_name: f.friendly_name ?? undefined,
    factor_type: f.factor_type,
    status: f.status as 'verified' | 'unverified',
    created_at: f.created_at,
    updated_at: f.updated_at,
  }))
  return { factors, error: null }
}
