/**
 * auditLogService.ts — Enterprise audit log (P126).
 *
 * Append-only event stream for tracking key actions.
 * All metadata is deep-scrubbed via redactObject() before insertion (P128).
 *
 * appendAuditEvent() is intentionally best-effort: it never throws.
 * Callers must not depend on it for correctness — only for observability.
 */

import { supabase } from './supabase'
import { redactObject } from '../observability/redact'

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Supported audit event types.
 * Convention: "<domain>.<action>" in lowercase snake_case segments.
 */
export type AuditEventType =
  | 'auth.login'
  | 'auth.logout'
  | 'project.create'
  | 'project.delete'
  | 'canvas.create'
  | 'canvas.delete'
  | 'org.create'
  | 'org.dissolve'
  | 'org.member.invite'
  | 'org.member.remove'
  | 'marketplace.install'
  | 'marketplace.fork'
  | 'marketplace.purchase'

export interface AuditEvent {
  /** UUID of the acting user. Omit for anonymous / server-side events. */
  userId?: string | null
  /** UUID of the org this event belongs to. Omit for personal events. */
  orgId?: string | null
  /** Event type (see AuditEventType). */
  eventType: AuditEventType
  /** Category of the object this event affects. */
  objectType: string
  /** ID of the affected object (project ID, canvas ID, org ID, etc.). */
  objectId: string
  /**
   * Arbitrary metadata. WILL BE REDACTED before insertion:
   * secret-keyed fields → '[REDACTED]', strings scanned for tokens/emails.
   */
  metadata?: Record<string, unknown>
}

export interface AuditLogEntry {
  id: string
  user_id: string | null
  org_id: string | null
  event_type: string
  object_type: string
  object_id: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface AuditLogPage {
  entries: AuditLogEntry[]
  /** Pass as `cursor` in the next call for pagination. null = no more pages. */
  nextCursor: string | null
}

// ── Append (best-effort) ──────────────────────────────────────────────────────

/**
 * Append an audit event. Metadata is redacted before storage.
 *
 * This function is best-effort: it silently swallows all errors so that a
 * transient Supabase failure or RLS rejection does NOT break the caller.
 */
export async function appendAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const safeMetadata = redactObject(event.metadata ?? {}) as Record<string, unknown>

    await supabase.from('audit_log').insert({
      user_id: event.userId ?? null,
      org_id: event.orgId ?? null,
      event_type: event.eventType,
      object_type: event.objectType,
      object_id: event.objectId,
      metadata: safeMetadata,
    })
  } catch {
    // Best-effort — swallow silently.
  }
}

// ── Query ─────────────────────────────────────────────────────────────────────

export interface AuditLogQueryOptions {
  /** Filter by acting user ID. */
  userId?: string
  /** Filter by org ID. */
  orgId?: string
  /** Maximum number of entries to return (default 50, max 200). */
  limit?: number
  /**
   * ISO timestamp cursor for forward pagination.
   * Pass `nextCursor` from the previous page to fetch older events.
   */
  cursor?: string
}

/**
 * Fetch a page of audit log entries, newest first.
 * Caller must be authenticated; RLS limits results to own events + org events.
 */
export async function getAuditLog(opts: AuditLogQueryOptions = {}): Promise<AuditLogPage> {
  const pageSize = Math.min(opts.limit ?? 50, 200)

  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(pageSize + 1) // fetch one extra to detect next page

  if (opts.userId) query = query.eq('user_id', opts.userId)
  if (opts.orgId) query = query.eq('org_id', opts.orgId)
  if (opts.cursor) query = query.lt('created_at', opts.cursor)

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as AuditLogEntry[]
  const hasMore = rows.length > pageSize
  const entries = hasMore ? rows.slice(0, pageSize) : rows
  const nextCursor =
    hasMore && entries.length > 0 ? (entries[entries.length - 1].created_at ?? null) : null

  return { entries, nextCursor }
}
