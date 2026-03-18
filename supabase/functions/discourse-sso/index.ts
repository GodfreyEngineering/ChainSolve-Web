/**
 * discourse-sso/index.ts — Supabase Edge Function
 *
 * Implements Discourse DiscourseConnect (SSO) protocol so users can log into
 * the ChainSolve community forum with their existing Supabase account.
 *
 * Flow:
 *   1. User clicks "Join Community" in-app → browser navigates to
 *      https://forum.chainsolve.dev/session/sso_provider
 *   2. Discourse redirects to this function with `sso` and `sig` params
 *   3. Function validates the signature, reads the Supabase JWT from the
 *      Authorization header (sent by the in-app link), fetches user profile,
 *      builds a DiscourseConnect response payload, signs it, and redirects back
 *      to Discourse.
 *
 * Environment variables required (set in Supabase Dashboard → Edge Functions):
 *   DISCOURSE_SECRET      — shared secret configured in Discourse Admin → SSO
 *   DISCOURSE_URL         — e.g. https://forum.chainsolve.dev
 *   SUPABASE_URL          — injected automatically by Supabase
 *   SUPABASE_ANON_KEY     — injected automatically by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — needed to read user profiles server-side
 *
 * References:
 *   https://meta.discourse.org/t/discourseconnect-official-single-sign-on-for-discourse/13045
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// HMAC-SHA256 helpers (Web Crypto API — available in Deno)
// ---------------------------------------------------------------------------

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function verifyHmac(secret: string, message: string, expected: string): Promise<boolean> {
  const computed = await hmacSha256Hex(secret, message)
  // Constant-time comparison
  if (computed.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url)

  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    })
  }

  // Read required env vars
  const discourseSecret = Deno.env.get('DISCOURSE_SECRET')
  const discourseUrl = Deno.env.get('DISCOURSE_URL')
  if (!discourseSecret || !discourseUrl) {
    return new Response(
      JSON.stringify({ error: '[DISCOURSE_SSO_CONFIG] Missing DISCOURSE_SECRET or DISCOURSE_URL' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── GET /discourse-sso  — initiate SSO from in-app ──────────────────────────
  // Builds and returns the Discourse SSO redirect URL so the browser can follow it.
  if (req.method === 'GET' && url.pathname.endsWith('/discourse-sso')) {
    const returnPath = url.searchParams.get('return') ?? '/latest'
    const nonce = crypto.randomUUID().replace(/-/g, '')
    const payload = btoa(`nonce=${nonce}&return_sso_url=${returnPath}`)
    const sig = await hmacSha256Hex(discourseSecret, payload)
    const forumUrl = new URL('/session/sso_provider', discourseUrl)
    forumUrl.searchParams.set('sso', payload)
    forumUrl.searchParams.set('sig', sig)
    return new Response(JSON.stringify({ url: forumUrl.toString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  // ── GET /discourse-sso/callback — Discourse redirects here after login ──────
  if (req.method === 'GET' && url.pathname.endsWith('/callback')) {
    const sso = url.searchParams.get('sso')
    const sig = url.searchParams.get('sig')

    if (!sso || !sig) {
      return new Response('[DISCOURSE_SSO_PARAMS] Missing sso or sig parameter', { status: 400 })
    }

    // 1. Verify signature
    const valid = await verifyHmac(discourseSecret, sso, sig)
    if (!valid) {
      return new Response('[DISCOURSE_SSO_SIG] Invalid signature', { status: 403 })
    }

    // 2. Decode payload and extract nonce
    let nonce: string
    try {
      const decoded = atob(sso)
      const params = new URLSearchParams(decoded)
      nonce = params.get('nonce') ?? ''
      if (!nonce) throw new Error('missing nonce')
    } catch {
      return new Response('[DISCOURSE_SSO_PAYLOAD] Failed to decode payload', { status: 400 })
    }

    // 3. Authenticate with Supabase JWT from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        '[DISCOURSE_SSO_AUTH] Missing Authorization header — user must be logged in',
        { status: 401 },
      )
    }
    const jwt = authHeader.slice(7)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt)
    if (userErr || !user) {
      return new Response('[DISCOURSE_SSO_USER] Failed to verify user JWT', { status: 401 })
    }

    // 4. Build return payload for Discourse
    const email = user.email ?? ''
    const externalId = user.id
    const username = (
      user.user_metadata?.username as string | undefined
      ?? email.split('@')[0]
    ).replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 20)
    const name = (user.user_metadata?.full_name as string | undefined) ?? username
    const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? ''
    const isModerator = (user.user_metadata?.role as string | undefined) === 'moderator'
    const isAdmin = (user.user_metadata?.role as string | undefined) === 'admin'

    const returnParams = new URLSearchParams({
      nonce,
      external_id: externalId,
      email,
      username,
      name,
      ...(avatarUrl ? { avatar_url: avatarUrl, avatar_force_update: 'false' } : {}),
      ...(isModerator ? { moderator: 'true' } : {}),
      ...(isAdmin ? { admin: 'true' } : {}),
      require_activation: 'false',
      suppress_welcome_message: 'false',
    })

    const returnPayload = btoa(returnParams.toString())
    const returnSig = await hmacSha256Hex(discourseSecret, returnPayload)

    const redirectUrl = new URL('/session/sso_login', discourseUrl)
    redirectUrl.searchParams.set('sso', returnPayload)
    redirectUrl.searchParams.set('sig', returnSig)

    return Response.redirect(redirectUrl.toString(), 302)
  }

  return new Response('[DISCOURSE_SSO_ROUTE] Not found', { status: 404 })
})
