/**
 * Webhook management — 10.8: Register, list, delete, and test webhooks.
 *
 * Webhooks fire a POST to a registered URL when a graph job transitions
 * to 'completed' or 'failed'. Useful for CI/CD pipelines, notifications,
 * and external integrations.
 *
 * Routes (all require Bearer JWT):
 *
 * POST /api/graph/webhooks        — register a webhook
 *   Body: { url, events?, secret? }
 *   events: array of 'job.completed' | 'job.failed' | 'job.all' (default: ['job.all'])
 *   secret: optional HMAC-SHA256 signing secret; if set, payloads are signed
 *   Returns: { webhookId, url, events, createdAt }
 *
 * GET /api/graph/webhooks         — list registered webhooks
 *   Returns: { webhooks: [...] }
 *
 * DELETE /api/graph/webhooks      — delete a webhook
 *   Body: { webhookId }
 *   Returns: { ok: true }
 *
 * POST /api/graph/webhooks?action=test — send a test ping to a webhook
 *   Body: { webhookId }
 *   Returns: { ok: true, status: number }
 *
 * Webhook payload format (POST to registered URL):
 *   {
 *     "event": "job.completed" | "job.failed",
 *     "jobId": "uuid",
 *     "userId": "uuid",
 *     "status": "completed" | "failed",
 *     "timestamp": "ISO8601",
 *     "result": {...} | null,
 *     "error": {...} | null
 *   }
 *   With X-ChainSolve-Signature: sha256=<HMAC-SHA256 hex> if secret is set.
 */

import { createClient } from '@supabase/supabase-js'

type Env = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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
  return 'sha256=' + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env, request } = context

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: '[CONFIG_INVALID] Missing Supabase credentials' }, 500)
  }

  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return json({ ok: false, error: '[UNAUTHORIZED] Bearer token required' }, 401)
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return json({ ok: false, error: '[UNAUTHORIZED] Invalid or expired token' }, 401)

  const url = new URL(request.url)
  const action = url.searchParams.get('action')

  // ── POST /api/graph/webhooks?action=test ───────────────────────────────────
  if (request.method === 'POST' && action === 'test') {
    const body = await request.json() as { webhookId?: string }
    if (!body.webhookId) return json({ ok: false, error: 'webhookId required' }, 400)

    const { data: webhook } = await admin
      .from('graph_webhooks')
      .select('id, url, secret_hash')
      .eq('id', body.webhookId)
      .eq('user_id', user.id)
      .single()

    if (!webhook) return json({ ok: false, error: '[NOT_FOUND] Webhook not found' }, 404)

    const payload = JSON.stringify({
      event: 'test.ping',
      webhookId: webhook.id,
      timestamp: new Date().toISOString(),
      message: 'ChainSolve webhook test — this is a test ping, not a real job event.',
    })

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (webhook.secret_hash) {
      headers['X-ChainSolve-Signature'] = await hmacSignature(webhook.secret_hash as string, payload)
    }

    let status = 0
    try {
      const resp = await fetch(webhook.url as string, { method: 'POST', body: payload, headers })
      status = resp.status
    } catch {
      return json({ ok: false, error: 'Failed to reach webhook URL' }, 502)
    }

    return json({ ok: status >= 200 && status < 300, status }, 200)
  }

  // ── POST /api/graph/webhooks — register ────────────────────────────────────
  if (request.method === 'POST') {
    const body = await request.json() as {
      url?: string
      events?: string[]
      secret?: string
    }

    if (!body.url || typeof body.url !== 'string') {
      return json({ ok: false, error: '[INVALID_BODY] url is required' }, 400)
    }
    try { new URL(body.url) } catch {
      return json({ ok: false, error: '[INVALID_URL] url must be a valid HTTPS URL' }, 400)
    }
    if (!body.url.startsWith('https://')) {
      return json({ ok: false, error: '[INVALID_URL] url must use HTTPS' }, 400)
    }

    const events = Array.isArray(body.events) ? body.events : ['job.all']
    const validEvents = new Set(['job.completed', 'job.failed', 'job.all'])
    for (const e of events) {
      if (!validEvents.has(e)) {
        return json({ ok: false, error: `[INVALID_EVENT] Unknown event: ${e}` }, 400)
      }
    }

    const { data: webhook, error: insertErr } = await admin
      .from('graph_webhooks')
      .insert({
        user_id: user.id,
        url: body.url,
        events,
        secret_hash: body.secret ?? null,
      })
      .select('id, url, events, created_at')
      .single()

    if (insertErr || !webhook) {
      return json({ ok: false, error: '[DB_ERROR] Failed to register webhook' }, 500)
    }

    return json({ ok: true, webhookId: webhook.id, url: webhook.url, events: webhook.events, createdAt: webhook.created_at }, 201)
  }

  // ── GET /api/graph/webhooks — list ─────────────────────────────────────────
  if (request.method === 'GET') {
    const { data: webhooks } = await admin
      .from('graph_webhooks')
      .select('id, url, events, created_at, last_fired_at, last_status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return json({ ok: true, webhooks: webhooks ?? [] }, 200)
  }

  // ── DELETE /api/graph/webhooks — delete ────────────────────────────────────
  if (request.method === 'DELETE') {
    const body = await request.json() as { webhookId?: string }
    if (!body.webhookId) return json({ ok: false, error: 'webhookId required' }, 400)

    const { error: deleteErr } = await admin
      .from('graph_webhooks')
      .delete()
      .eq('id', body.webhookId)
      .eq('user_id', user.id)

    if (deleteErr) return json({ ok: false, error: '[DB_ERROR] Failed to delete webhook' }, 500)

    return json({ ok: true }, 200)
  }

  return json({ ok: false, error: 'Method not allowed' }, 405)
}
