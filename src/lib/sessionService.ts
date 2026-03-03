/**
 * sessionService.ts — Device session tracking (E2-5) + single-session enforcement (H9-1).
 *
 * Tracks active browser sessions in a `user_sessions` table so users
 * can view and revoke them from Security settings.
 *
 * H9-1: Single-session enforcement — when a user logs in on a new device,
 * all other sessions are revoked automatically. A periodic check detects
 * when the current session has been revoked (e.g. by another login) and
 * triggers a sign-out with clear messaging.
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

// ── H9-1: Single-session enforcement ─────────────────────────────────────────

/** How often (ms) to check if the current session is still valid. */
export const SESSION_CHECK_INTERVAL_MS = 60_000

/**
 * Revoke all existing sessions for the user, then register a new one.
 * Called during login to enforce the single-session policy.
 *
 * I8-1: when `singleSessionRequired` is true (org policy), all existing
 * sessions are revoked before registering the new one.  When false, the
 * new session is registered without revoking others.
 *
 * Returns the new session ID.
 */
export async function enforceAndRegisterSession(
  userId: string,
  singleSessionRequired = true,
): Promise<string | null> {
  if (singleSessionRequired) {
    // Delete all existing sessions for this user (across all devices)
    await supabase.from('user_sessions').delete().eq('user_id', userId)
  }
  // Register the new session for this device
  return registerSession(userId)
}

/**
 * Check whether the current session record still exists in the database.
 * Returns `true` if the session is still valid, `false` if it has been
 * revoked (e.g. by another device logging in).
 *
 * Returns `true` when no session ID is stored (unauthenticated) to avoid
 * false positives before login.
 */
export async function isSessionValid(): Promise<boolean> {
  const sessionId = getCurrentSessionId()
  if (!sessionId) return true // No session to validate

  const { data, error } = await supabase
    .from('user_sessions')
    .select('id')
    .eq('id', sessionId)
    .maybeSingle()

  if (error) return true // Network error — assume valid to avoid false lockouts
  return data !== null
}
