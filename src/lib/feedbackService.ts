/**
 * feedbackService.ts — Service layer for the feedback system.
 *
 * Handles inserting feedback into the `feedback` table and triggering
 * the confirmation email edge function. Components should use this
 * instead of importing supabase directly.
 */

import { supabase } from './supabase'
import { SUPABASE_URL } from './env'
import { BUILD_VERSION } from './build-info'

export interface FeedbackPayload {
  userId: string
  type: 'bug' | 'improvement' | 'question'
  category: string
  title: string
  description: string
  errorLogs: string | null
  browserInfo: Record<string, string>
  route: string
}

export interface FeedbackResult {
  ticketId: string
  shortId: string
}

/** Insert feedback into the database and return the ticket ID. */
export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResult> {
  // Table created by migration 0024. After `supabase db push && npm run db:types`,
  // remove the @ts-expect-error — the type will be auto-generated.
  const { data, error } = await supabase
    // @ts-expect-error feedback table not yet in database.types.ts
    .from('feedback')
    .insert({
      user_id: payload.userId,
      type: payload.type,
      category: payload.category,
      title: payload.title,
      description: payload.description,
      error_logs: payload.errorLogs,
      browser_info: payload.browserInfo,
      app_version: BUILD_VERSION,
      route: payload.route,
    })
    .select('id')
    .single()

  if (error) throw error

  const ticketId: string = data.id
  return {
    ticketId,
    shortId: ticketId.substring(0, 8).toUpperCase(),
  }
}

/** Fire-and-forget: send a confirmation email via the edge function. */
export function sendFeedbackConfirmation(
  userEmail: string,
  ticketId: string,
  feedbackType: string,
  title: string,
): void {
  fetch(`${SUPABASE_URL}/functions/v1/send-feedback-confirmation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_email: userEmail,
      ticket_id: ticketId,
      feedback_type: feedbackType,
      title,
    }),
  }).catch(() => {
    // Best-effort — email failure should not affect UX
  })
}

/** Get the current authenticated user ID and email (null if not logged in). */
export async function getFeedbackUser(): Promise<{ id: string; email: string | null } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { id: user.id, email: user.email ?? null }
}
