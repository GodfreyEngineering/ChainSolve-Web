/**
 * auth.ts — Thin service wrappers around Supabase auth.
 *
 * UI components and pages must ONLY call these functions,
 * never import the supabase client directly.
 */

import { supabase } from './supabase'
import type { AuthError, Session, User } from '@supabase/supabase-js'

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

export async function signUp(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<{ session: Session | null; error: AuthError | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined,
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
  await supabase.auth.signOut()
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
