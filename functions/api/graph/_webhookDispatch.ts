/**
 * _webhookDispatch.ts — 10.8: Fire registered webhooks when a job completes.
 *
 * Called by the job runner (or Supabase Realtime trigger) when a graph_job
 * transitions to 'completed' or 'failed'.
 *
 * This module exports a single function `dispatchWebhooks` that:
 *  1. Queries graph_webhooks for the user's registered endpoints
 *  2. Fires a POST to each matching URL with the job payload
 *  3. Records last_fired_at + last_status for each webhook (fire-and-forget)
 *
 * Signature: HMAC-SHA256 over JSON payload using the webhook's secret_hash
 * (if configured). Sent as X-ChainSolve-Signature: sha256=<hex>.
 */

import { createClient } from '@supabase/supabase-js'

export interface WebhookJobPayload {
  event: 'job.completed' | 'job.failed'
  jobId: string
  userId: string
  status: 'completed' | 'failed'
  timestamp: string
  result?: unknown
  error?: unknown
}

async function hmacSignature(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return (
    'sha256=' +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  )
}

/**
 * Fire all matching webhooks for the given job event.
 *
 * @param supabaseUrl - Supabase project URL
 * @param serviceRoleKey - Supabase service role key for admin queries
 * @param payload - The webhook payload to deliver
 */
export async function dispatchWebhooks(
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: WebhookJobPayload,
): Promise<void> {
  const admin = createClient(supabaseUrl, serviceRoleKey)

  // Fetch webhooks matching this event for the user
  const { data: webhooks } = await admin
    .from('graph_webhooks')
    .select('id, url, events, secret_hash')
    .eq('user_id', payload.userId)

  if (!webhooks || webhooks.length === 0) return

  const payloadJson = JSON.stringify(payload)
  const now = new Date().toISOString()

  await Promise.allSettled(
    webhooks
      .filter((wh) => {
        const events = wh.events as string[]
        return events.includes('job.all') || events.includes(payload.event)
      })
      .map(async (wh) => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (wh.secret_hash) {
          headers['X-ChainSolve-Signature'] = await hmacSignature(
            wh.secret_hash as string,
            payloadJson,
          )
        }

        let status = 0
        try {
          const resp = await fetch(wh.url as string, {
            method: 'POST',
            body: payloadJson,
            headers,
            // Cloudflare Workers: no keep-alive needed, short timeout
            signal: AbortSignal.timeout(15_000),
          })
          status = resp.status
        } catch {
          status = 0
        }

        // Record delivery result (fire-and-forget — don't let failures block)
        admin
          .from('graph_webhooks')
          .update({ last_fired_at: now, last_status: status })
          .eq('id', wh.id)
          .then(() => {
            /* fire-and-forget */
          }, () => {
            /* non-fatal */
          })
      }),
  )
}
