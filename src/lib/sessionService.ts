/**
 * sessionService.ts — Device session tracking (E2-5) + single-session enforcement (H9-1, L3-1).
 *
 * Tracks active browser sessions in a `user_sessions` table so users
 * can view and revoke them from Security settings.
 *
 * H9-1 / L3-1: Single-session enforcement is opt-in.  It is activated
 * only when the user's organization has `policy_single_session = true`.
 * Non-org users default to multi-session (no revocation on login).
 * `isSingleSessionRequired` checks the org policy at login time.
 */

import { supabase } from './supabase'

export interface UserSession {
  id: string
  user_id: string
  device_label: string
  user_agent: string | null
  last_active_at: string
  created_at: string
}

const SESSION_ID_KEY = 'cs:session_id'

/** Get the current session ID stored in this browser tab. */
export function getCurrentSessionId(): string | null {
  return localStorage.getItem(SESSION_ID_KEY)
}

/** Parse a User-Agent string into a human-readable device label. */
export function parseDeviceLabel(ua: string): string {
  if (!ua) return 'Unknown device'

  let browser = 'Browser'
  if (ua.includes('Firefox/')) browser = 'Firefox'
  else if (ua.includes('Edg/')) browser = 'Edge'
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome'
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari'

  let os = ''
  if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'

  return os ? `${browser} on ${os}` : browser
}

/**
 * Register a new session for the current browser.
 * Called on login. Returns the session record ID.
 */
export async function registerSession(userId: string): Promise<string | null> {
  const ua = navigator.userAgent
  const deviceLabel = parseDeviceLabel(ua)

  const { data, error } = await supabase
    .from('user_sessions')
    .insert({ user_id: userId, device_label: deviceLabel, user_agent: ua })
    .select('id')
    .single()

  if (error || !data) return null
  localStorage.setItem(SESSION_ID_KEY, data.id)
  return data.id
}

/** Update last_active_at for the current session (called on page load). */
export async function touchSession(): Promise<void> {
  const sessionId = getCurrentSessionId()
  if (!sessionId) return
  await supabase
    .from('user_sessions')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', sessionId)
}

/** List all sessions for a user. */
export async function listSessions(userId: string): Promise<UserSession[]> {
  const { data, error } = await supabase
    .from('user_sessions')
    .select('id,user_id,device_label,user_agent,last_active_at,created_at')
    .eq('user_id', userId)
    .order('last_active_at', { ascending: false })

  if (error || !data) return []
  return data as UserSession[]
}

/** Revoke (delete) a specific session. */
export async function revokeSession(sessionId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('user_sessions').delete().eq('id', sessionId)
  return { error: error?.message ?? null }
}

/** Revoke all sessions except the current one. */
export async function revokeAllOtherSessions(userId: string): Promise<{ error: string | null }> {
  const currentId = getCurrentSessionId()
  if (!currentId) return { error: 'No current session' }
  const { error } = await supabase
    .from('user_sessions')
    .delete()
    .eq('user_id', userId)
    .neq('id', currentId)
  return { error: error?.message ?? null }
}

/** Remove the current session record (called on sign-out). */
export async function removeCurrentSession(): Promise<void> {
  const sessionId = getCurrentSessionId()
  if (!sessionId) return
  await supabase.from('user_sessions').delete().eq('id', sessionId)
  localStorage.removeItem(SESSION_ID_KEY)
}

// ── H9-1 / L3-1: Single-session enforcement ─────────────────────────────────

/** How often (ms) to check if the current session is still valid. */
export const SESSION_CHECK_INTERVAL_MS = 60_000

/**
 * Register a new session, optionally revoking all others first.
 *
 * L3-1: defaults to `false` (multi-session).  Single-session enforcement
 * is only activated when the caller passes `true`, which happens when
 * the user's org has `policy_single_session = true`.
 *
 * Returns the new session ID.
 */
export async function enforceAndRegisterSession(
  userId: string,
  singleSessionRequired = false,
): Promise<string | null> {
  if (singleSessionRequired) {
    // Delete all existing sessions for this user (across all devices)
    await supabase.from('user_sessions').delete().eq('user_id', userId)
  }

  // Best-effort: clean up stale sessions and cap at 10 active
  try {
    await cleanupStaleSessions(userId)
  } catch {
    // Cleanup failures must not block login
  }

  // Register the new session for this device
  return registerSession(userId)
}

const STALE_SESSION_DAYS = 90
const MAX_ACTIVE_SESSIONS = 10

/**
 * Delete sessions older than 90 days, and cap active sessions at 10
 * (deleting the oldest if exceeded). Best-effort — errors are swallowed.
 */
async function cleanupStaleSessions(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Delete stale sessions (older than 90 days)
  await supabase.from('user_sessions').delete().eq('user_id', userId).lt('last_active_at', cutoff)

  // Cap at MAX_ACTIVE_SESSIONS — fetch all, delete oldest if over limit
  const { data } = await supabase
    .from('user_sessions')
    .select('id,last_active_at')
    .eq('user_id', userId)
    .order('last_active_at', { ascending: false })

  if (data && data.length > MAX_ACTIVE_SESSIONS) {
    const toDelete = data.slice(MAX_ACTIVE_SESSIONS).map((s: { id: string }) => s.id)
    await supabase.from('user_sessions').delete().in('id', toDelete)
  }
}

/**
 * L3-1: Check whether single-session enforcement is required for a user.
 *
 * Looks up the user's org membership and returns the org's
 * `policy_single_session` flag.  Returns `false` when the user has
 * no org, the query fails, or the policy is not set.
 */
export async function isSingleSessionRequired(userId: string): Promise<boolean> {
  // Find the user's org (if any) via org_members
  const { data: membership, error: memErr } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (memErr || !membership) return false

  // Fetch the org's single-session policy
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('policy_single_session')
    .eq('id', membership.org_id)
    .maybeSingle()

  if (orgErr || !org) return false
  return org.policy_single_session === true
}

/**
 * Track consecutive validation failures to avoid false revocations.
 * A single failed check (e.g. transient DB issue, table truncated) should
 * not immediately revoke — require 3 consecutive failures.
 */
let consecutiveFailures = 0
const MAX_FAILURES_BEFORE_REVOKE = 3

/**
 * Check whether the current session record still exists in the database.
 * Returns `true` if the session is still valid, `false` if it has been
 * revoked (e.g. by another device logging in).
 *
 * Returns `true` when no session ID is stored (unauthenticated) to avoid
 * false positives before login.
 *
 * Uses a consecutive-failure window: the session is only considered revoked
 * after MAX_FAILURES_BEFORE_REVOKE consecutive "not found" results, which
 * guards against transient DB issues and table wipes.
 */
export async function isSessionValid(): Promise<boolean> {
  const sessionId = getCurrentSessionId()
  if (!sessionId) return true // No session to validate

  const { data, error } = await supabase
    .from('user_sessions')
    .select('id')
    .eq('id', sessionId)
    .maybeSingle()

  if (error) {
    // Network error — assume valid to avoid false lockouts, reset counter
    consecutiveFailures = 0
    return true
  }

  if (data !== null) {
    // Session found — valid, reset counter
    consecutiveFailures = 0
    return true
  }

  // Session not found — increment failure counter
  consecutiveFailures++
  if (consecutiveFailures >= MAX_FAILURES_BEFORE_REVOKE) {
    return false // Confirmed revocation
  }

  // Not enough consecutive failures yet — try re-registering
  return true
}

/** Reset the failure counter (e.g. after fresh login or session registration). */
export function resetSessionFailures(): void {
  consecutiveFailures = 0
}
