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
