/**
 * heavy-compute — Supabase Edge Function (7.12).
 *
 * Receives a ChainSolve EngineSnapshotV1 payload, invokes a native Rust
 * engine binary (engine-core compiled to a native executable), and streams
 * back the full EngineEvalResult as JSON.
 *
 * Request body (application/json):
 *   { snapshot: EngineSnapshotV1 }
 *
 * Response body (application/json):
 *   EngineEvalResult | { error: string }
 *
 * Environment variables required:
 *   NATIVE_ENGINE_URL — base URL of the native Rust HTTP server
 *                       (e.g. http://localhost:3099, or a Fly.io / Railway URL)
 *
 * The native engine server exposes POST /evaluate accepting the same snapshot
 * shape. This Edge Function is intentionally thin: it validates the payload,
 * forwards to the native binary, and returns the result — keeping all
 * evaluation logic inside Rust.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

// ── Types (mirrored from src/engine/wasm-types.ts) ────────────────────────────

interface EngineSnapshotV1 {
  version: 1
  nodes: Array<{ id: string; blockType: string; data: Record<string, unknown> }>
  edges: Array<{
    id: string
    source: string
    sourceHandle: string
    target: string
    targetHandle: string
  }>
}

interface EngineEvalResult {
  values: Record<string, unknown>
  diagnostics: Array<{ nodeId?: string; level: string; code: string; message: string }>
  elapsedUs: number
  partial?: boolean
}

// ── CORS headers ──────────────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Validation ────────────────────────────────────────────────────────────────

function isValidSnapshot(v: unknown): v is EngineSnapshotV1 {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return s.version === 1 && Array.isArray(s.nodes) && Array.isArray(s.edges)
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: '[HEAVY_COMPUTE_PARSE] Invalid JSON body' }, 400)
  }

  const payload = body as Record<string, unknown>
  const snapshot = payload?.snapshot

  if (!isValidSnapshot(snapshot)) {
    return json({ error: '[HEAVY_COMPUTE_INVALID] snapshot must be EngineSnapshotV1' }, 400)
  }

  // Resolve native engine URL
  const nativeUrl = Deno.env.get('NATIVE_ENGINE_URL')
  if (!nativeUrl) {
    return json({ error: '[HEAVY_COMPUTE_CONFIG] NATIVE_ENGINE_URL not set' }, 503)
  }

  // Forward to native Rust engine
  let nativeResp: Response
  try {
    nativeResp = await fetch(`${nativeUrl}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    })
  } catch (err) {
    return json(
      { error: `[HEAVY_COMPUTE_UPSTREAM] Could not reach native engine: ${String(err)}` },
      502,
    )
  }

  if (!nativeResp.ok) {
    const text = await nativeResp.text().catch(() => '')
    return json(
      { error: `[HEAVY_COMPUTE_UPSTREAM] Native engine returned ${nativeResp.status}: ${text}` },
      502,
    )
  }

  let result: EngineEvalResult
  try {
    result = (await nativeResp.json()) as EngineEvalResult
  } catch {
    return json({ error: '[HEAVY_COMPUTE_DECODE] Native engine response is not valid JSON' }, 502)
  }

  return json(result)
})
