/**
 * POST /api/student/request
 *
 * Initiates student verification by validating the university email
 * domain, generating a 6-digit OTP, and storing the hashed code in
 * student_verifications.
 *
 * The OTP must be delivered to the student via email.  In production
 * this would call an email delivery service (Resend, SendGrid, etc.).
 * The function stores the code hash server-side; the raw code is only
 * returned in development mode for testing.
 *
 * Request body: { universityEmail: string }
 * Response:     { ok: true } or { ok: false, error: string }
 */

import { createClient } from '@supabase/supabase-js'
import { jsonError } from '../stripe/_lib'

// ── University TLD patterns (server-side mirror) ────────────────────

const UNIVERSITY_TLDS: readonly string[] = [
  '.edu',
  '.ac.uk',
  '.edu.au',
  '.edu.ca',
  '.ac.ca',
  '.ac.jp',
  '.edu.cn',
  '.ac.in',
  '.edu.in',
  '.edu.br',
  '.ac.nz',
  '.edu.sg',
  '.ac.il',
  '.edu.mx',
  '.edu.ar',
  '.ac.za',
  '.edu.co',
  '.edu.hk',
  '.ac.kr',
  '.ac.de',
  '.edu.fr',
  '.edu.es',
  '.edu.it',
  '.ac.nl',
  '.ac.se',
  '.ac.no',
  '.ac.dk',
  '.ac.fi',
  '.ac.ch',
  '.ethz.ch',
  '.epfl.ch',
  '.edu.pl',
  '.ac.cz',
  '.ac.hu',
  '.edu.pt',
  '.edu.tr',
  '.edu.ru',
  '.ac.ru',
  '.ac.th',
  '.edu.my',
  '.ac.id',
  '.edu.ph',
  '.edu.tw',
  '.edu.pk',
  '.edu.eg',
  '.edu.ng',
  '.ac.ke',
  '.edu.cl',
  '.edu.pe',
  '.ac.ir',
  '.edu.sa',
  '.ac.ae',
  '.edu.',
  '.ac.',
]

function isUniversityDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return UNIVERSITY_TLDS.some((suffix) => {
    if (suffix.startsWith('.') && suffix.endsWith('-')) {
      return domain.includes(suffix.slice(1))
    }
    return domain.endsWith(suffix)
  })
}

/** Generate a cryptographically random 6-digit code. */
function generateCode(): string {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return String(arr[0] % 1_000_000).padStart(6, '0')
}

/** SHA-256 hash of the code for storage (never store raw codes). */
async function hashCode(code: string): Promise<string> {
  const encoded = new TextEncoder().encode(code)
  const buf = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
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

  // ── Check if already verified ──────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_student')
    .eq('id', userId)
    .single()

  if (profile?.is_student) {
    return jsonError('Already verified as a student', 400)
  }

  // ── Parse + validate ───────────────────────────────────────────────
  let body: { universityEmail?: string }
  try {
    body = await context.request.json()
  } catch {
    return jsonError('Invalid JSON body', 400)
  }

  const email = body.universityEmail?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError('Invalid email address', 400)
  }

  if (!isUniversityDomain(email)) {
    return jsonError('Not a recognised university email domain', 400)
  }

  // ── Rate limit: max 3 pending codes per user ──────────────────────
  const { count } = await supabase
    .from('student_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('confirmed_at', null)
    .gte('expires_at', new Date().toISOString())

  if ((count ?? 0) >= 3) {
    return jsonError('Too many pending verifications. Please wait and try again.', 429)
  }

  // ── Generate code + store hash ─────────────────────────────────────
  const code = generateCode()
  const codeHash = await hashCode(code)

  const { error: insertErr } = await supabase.from('student_verifications').insert({
    user_id: userId,
    university_email: email,
    code_hash: codeHash,
  })

  if (insertErr) {
    console.error('student_verifications insert error:', insertErr.message)
    return jsonError('Failed to create verification', 500)
  }

  // ── Send email ─────────────────────────────────────────────────────
  // Email delivery (Resend/SendGrid) is wired in before launch.
  // For now the code is logged server-side for manual delivery or
  // testing.  Never expose the raw code in the HTTP response in
  // production.
  console.log(`[student-verify] code=${code} email=${email} user=${userId}`)

  return Response.json({ ok: true })
}
