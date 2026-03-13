/**
 * POST /api/student/confirm
 *
 * Confirms a student verification code.  On success, sets
 * is_student=true + student_email + student_verified_at on the
 * user's profile, and marks the verification row as confirmed.
 *
 * Student licenses expire after 1 year (student_expires_at).
 *
 * Brute-force protection: max 5 failed attempts per user per hour.
 * After 5 failures the endpoint returns 429 for 1 hour.
 * Hash comparison uses constant-time comparison.
 *
 * Request body: { code: string }
 * Response:     { ok: true } or { ok: false, error: string }
 */

import { createClient } from '@supabase/supabase-js'
import { jsonError } from '../stripe/_lib'

/** SHA-256 hash of the code for comparison. */
async function hashCode(code: string): Promise<string> {
  const encoded = new TextEncoder().encode(code)
  const buf = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Both strings must be the same length (which they are — SHA-256 hex).
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)
  let result = 0
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i]
  }
  return result === 0
}

// ── Brute-force protection ────────────────────────────────────────────

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 60 * 60 * 1000 // 1 hour

interface AttemptEntry {
  count: number
  firstAttempt: number
}

/** Per-user attempt tracking (per-isolate, resets on worker restart). */
const attempts = new Map<string, AttemptEntry>()

function checkBruteForce(userId: string): Response | null {
  const now = Date.now()
  const entry = attempts.get(userId)

  if (!entry) return null

  // Reset if the lockout window has expired
  if (now - entry.firstAttempt > LOCKOUT_MS) {
    attempts.delete(userId)
    return null
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((entry.firstAttempt + LOCKOUT_MS - now) / 1000)
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Too many failed attempts. Please try again later.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.max(retryAfter, 1)),
        },
      },
    )
  }

  return null
}

function recordFailure(userId: string): void {
  const now = Date.now()
  const entry = attempts.get(userId)

  if (!entry || now - entry.firstAttempt > LOCKOUT_MS) {
    attempts.set(userId, { count: 1, firstAttempt: now })
  } else {
    entry.count++
  }
}

function clearAttempts(userId: string): void {
  attempts.delete(userId)
}

// ── Types ────────────────────────────────────────────────────────────

type Env = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

// ── Handler ──────────────────────────────────────────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = context.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError('Server misconfigured', 500)
  }

  // ── Auth ────────────────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const authHeader = context.request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return jsonError('Missing Authorization Bearer token', 401)

  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user) return jsonError('Authentication failed', 401)

  const userId = userData.user.id

  // ── Brute-force check ───────────────────────────────────────────────
  const blocked = checkBruteForce(userId)
  if (blocked) return blocked

  // ── Parse ──────────────────────────────────────────────────────────
  let body: { code?: string }
  try {
    body = await context.request.json()
  } catch {
    return jsonError('Invalid JSON body', 400)
  }

  const code = body.code?.trim()
  if (!code || !/^\d{6}$/.test(code)) {
    return jsonError('Code must be exactly 6 digits', 400)
  }

  // ── Look up pending verifications for this user ────────────────────
  const { data: pending, error: fetchErr } = await supabase
    .from('student_verifications')
    .select('id, university_email, code_hash')
    .eq('user_id', userId)
    .is('confirmed_at', null)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (fetchErr || !pending || pending.length === 0) {
    return jsonError('No pending verification found. Request a new code.', 400)
  }

  // ── Verify code hash against all pending rows (constant-time) ──────
  const submittedHash = await hashCode(code)
  const match = pending.find((row) => timingSafeEqual(row.code_hash, submittedHash))

  if (!match) {
    recordFailure(userId)
    return jsonError('Invalid verification code', 400)
  }

  // ── Success: clear attempt counter ──────────────────────────────────
  clearAttempts(userId)

  // ── Mark verification confirmed ────────────────────────────────────
  const now = new Date().toISOString()
  const { error: confirmErr } = await supabase
    .from('student_verifications')
    .update({ confirmed_at: now })
    .eq('id', match.id)

  if (confirmErr) {
    console.error('student_verifications confirm error:', confirmErr.message)
    return jsonError('Failed to confirm verification', 500)
  }

  // ── Update profile: is_student + metadata ──────────────────────────
  // Student license expires in 1 year from verification.
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      is_student: true,
      student_email: match.university_email,
      student_verified_at: now,
      student_expires_at: expiresAt,
    })
    .eq('id', userId)

  if (profileErr) {
    console.error('profile student update error:', profileErr.message)
    return jsonError('Failed to update student status', 500)
  }

  return Response.json({ ok: true })
}
