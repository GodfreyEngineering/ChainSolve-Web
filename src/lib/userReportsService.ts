/**
 * userReportsService.ts — Unified content reporting (J0-1).
 *
 * Handles reports for offensive display names, avatars, comments,
 * and marketplace items. Replaces ad-hoc reporting in individual
 * service files with a single, consistent API.
 */

import { supabase } from './supabase'

// ── Types ────────────────────────────────────────────────────────────────────

export type ReportTargetType = 'display_name' | 'avatar' | 'comment' | 'marketplace_item'
export type ReportStatus = 'pending' | 'resolved' | 'dismissed'

export interface UserReport {
  id: string
  reporter_id: string
  target_type: ReportTargetType
  target_id: string
  reason: string
  status: ReportStatus
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

// ── User-facing ──────────────────────────────────────────────────────────────

/** Submit a content report. Max 1000 chars for reason. */
export async function submitReport(
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to submit a report')

  const trimmed = reason.trim()
  if (!trimmed) throw new Error('A reason is required')
  if (trimmed.length > 1000) throw new Error('Reason must be 1000 characters or fewer')

  const { error } = await supabase.from('user_reports').insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason: trimmed,
  })

  if (error) {
    if (error.code === '23P01') throw new Error('You already have a pending report for this item')
    throw error
  }
}

/** List reports submitted by the current user. */
export async function listMyReports(): Promise<UserReport[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('user_reports')
    .select('id,reporter_id,target_type,target_id,reason,status,resolved_by,resolved_at,created_at')
    .eq('reporter_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as UserReport[]
}

// ── Moderator/admin ──────────────────────────────────────────────────────────

/** List all pending reports. Requires admin or developer role. */
export async function listPendingReports(): Promise<UserReport[]> {
  const { data, error } = await supabase
    .from('user_reports')
    .select('id,reporter_id,target_type,target_id,reason,status,resolved_by,resolved_at,created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as UserReport[]
}

/** Resolve a report (action taken). Requires admin or developer role. */
export async function resolveReport(reportId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in required')

  const { error } = await supabase
    .from('user_reports')
    .update({
      status: 'resolved' as ReportStatus,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', reportId)

  if (error) throw error
}

/** Dismiss a report (no action needed). Requires admin or developer role. */
export async function dismissReport(reportId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in required')

  const { error } = await supabase
    .from('user_reports')
    .update({
      status: 'dismissed' as ReportStatus,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', reportId)

  if (error) throw error
}
