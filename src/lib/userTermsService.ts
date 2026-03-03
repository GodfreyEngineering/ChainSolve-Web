/**
 * userTermsService.ts — Terms acceptance audit log (J0-1).
 *
 * Supplements the existing acceptTerms() in profilesService.ts by
 * also writing to the immutable user_terms_log audit table.
 */

import { supabase } from './supabase'

// ── Types ────────────────────────────────────────────────────────────────────

export interface TermsLogEntry {
  id: string
  user_id: string
  terms_version: string
  accepted_at: string
  ip_address: string | null
  user_agent: string | null
}

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Record a ToS acceptance in the audit log.
 * Called alongside profilesService.acceptTerms().
 */
export async function logTermsAcceptance(
  termsVersion: string,
  metadata?: { ipAddress?: string },
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to accept terms')

  const { error } = await supabase.from('user_terms_log').insert({
    user_id: user.id,
    terms_version: termsVersion,
    ip_address: metadata?.ipAddress ?? null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  })

  if (error) throw error
}

/** Fetch the current user's terms acceptance history. */
export async function getTermsHistory(): Promise<TermsLogEntry[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('user_terms_log')
    .select('id,user_id,terms_version,accepted_at,ip_address,user_agent')
    .eq('user_id', user.id)
    .order('accepted_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as TermsLogEntry[]
}
