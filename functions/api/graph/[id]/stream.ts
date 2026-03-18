/**
 * GET /api/graph/{id}/stream — 10.4: Server-Sent Events stream for job progress.
 *
 * Streams execution progress and intermediate results for a graph job as
 * Server-Sent Events (SSE). SSE is used instead of WebSocket because
 * Cloudflare Pages Functions support SSE natively via ReadableStream but
 * do not provide persistent WebSocket Durable Objects in the standard tier.
 *
 * The client should use:
 *   const es = new EventSource('/api/graph/{id}/stream', {
 *     headers: { Authorization: `Bearer ${token}` }
 *   })
 *   es.onmessage = (e) => console.log(JSON.parse(e.data))
 *
 * Events emitted:
 *   - { type: 'status',   status: 'pending' | 'running' | 'completed' | 'failed' }
 *   - { type: 'progress', iteration: number, total: number, elapsedMs: number }
 *   - { type: 'result',   values: Record<string, Value> }
 *   - { type: 'error',    code: string, message: string }
 *   - { type: 'done' }     — final event, connection will close
 *
 * Polling interval: 500ms until job is completed or failed.
 * Max stream duration: 60s (Cloudflare limit is 100s).
 *
 * Authorization: Bearer JWT in Authorization header (passed as query param
 * `token` for EventSource compatibility since headers are not available in
 * basic EventSource implementations).
 */

import { createClient } from '@supabase/supabase-js'

type Env = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

const POLL_INTERVAL_MS = 500
const MAX_DURATION_MS = 60_000

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context
  const jobId = params.id as string

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response('Missing Supabase credentials', { status: 500 })
  }

  // ── Auth: accept Bearer header or ?token= query param ────────────────────
  const url = new URL(request.url)
  const authHeader = request.headers.get('Authorization') ?? ''
  const token =
    (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) ??
    url.searchParams.get('token')

  if (!token) {
    return new Response('Bearer token required', { status: 401 })
  }

  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) {
    return new Response('Invalid or expired token', { status: 401 })
  }

  // ── Create SSE stream ────────────────────────────────────────────────────
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  const write = async (event: unknown) => {
    await writer.write(encoder.encode(sseEvent(event)))
  }

  // Run the polling loop in the background.
  ;(async () => {
    const start = Date.now()
    let lastStatus = ''

    try {
      while (Date.now() - start < MAX_DURATION_MS) {
        const { data: job, error } = await admin
          .from('graph_jobs')
          .select('status, result_json, error_json, submitted_at, completed_at')
          .eq('id', jobId)
          .eq('user_id', user.id)
          .single()

        if (error || !job) {
          await write({ type: 'error', code: 'NOT_FOUND', message: 'Job not found' })
          break
        }

        // Emit status change events
        if (job.status !== lastStatus) {
          await write({ type: 'status', status: job.status })
          lastStatus = job.status as string
        }

        if (job.status === 'completed') {
          let result = null
          try {
            if (job.result_json) result = JSON.parse(job.result_json as string)
          } catch {
            result = null
          }
          await write({ type: 'result', values: result })
          await write({ type: 'done' })
          break
        }

        if (job.status === 'failed') {
          let errorData = null
          try {
            if (job.error_json) errorData = JSON.parse(job.error_json as string)
          } catch {
            errorData = null
          }
          await write({ type: 'error', ...(errorData ?? { code: 'EVAL_FAILED', message: 'Evaluation failed' }) })
          await write({ type: 'done' })
          break
        }

        // Emit keep-alive with elapsed time
        await write({
          type: 'progress',
          elapsedMs: Date.now() - start,
          status: job.status,
        })

        // Wait before next poll
        await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS))
      }

      // Timeout reached
      if (Date.now() - start >= MAX_DURATION_MS) {
        await write({ type: 'error', code: 'STREAM_TIMEOUT', message: 'Stream timed out after 60s' })
        await write({ type: 'done' })
      }
    } catch (err) {
      await write({
        type: 'error',
        code: 'INTERNAL',
        message: err instanceof Error ? err.message : 'Internal error',
      })
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable Nginx buffering
    },
  })
}
