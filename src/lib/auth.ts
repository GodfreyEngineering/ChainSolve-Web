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
): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
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
